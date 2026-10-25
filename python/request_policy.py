"""Bounded request controls, not a substitute for the host's semantic reasoning.

Exact copy is data, never a command source. Explicit controls and detected constraints
must agree. Unknown requests stay scoped; conflicting requests stop before rendering.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

POLICY = json.loads((Path(__file__).parent / 'data/request_policy.json').read_text())
MODES = {'create', 'adapt', 'identity_exploration', 'advice', 'exercise', 'plan'}
# Vocabulary is release data shared by both runtimes and the exercise planner.
NUMBERS = POLICY['quantity']['number_words']


def quantity_pattern(nouns: list[str]) -> str:
    number = r'[+-]?[0-9]+(?:[.,][0-9]+)?|' + '|'.join(NUMBERS)
    return r'(?<![\w.,])(' + number + r')\s+(?:(?:seul|seule|single)\s+)?(?:' + '|'.join(nouns) + r')\b'


COUNT_RE = quantity_pattern(POLICY['quantity']['variant_nouns'] + POLICY['quantity']['deliverable_nouns'])
VARIANT_COUNT_RE = quantity_pattern(POLICY['quantity']['variant_nouns'])


def quantity_value(token: str) -> int | None:
    """Do not truncate a decimal or an oversized digit sequence into a new count."""
    token = token.lower()
    if token in NUMBERS:
        return NUMBERS[token]
    return int(token) if re.fullmatch(r'[+-]?[0-9]+', token) else None


def normalized(value: Any) -> str:
    text = unicodedata.normalize('NFKD', str(value or '')).lower()
    return ''.join(c for c in text if not unicodedata.combining(c)).replace('’', "'")


def has(pattern: str, value: str) -> bool:
    return bool(re.search(pattern, normalized(value)))


def negative_prefix(text: str, start: int) -> bool:
    clause = re.split(r'[.!?;,\n]|\b(?:mais|but|rather|plutot)\b', text[:start])[-1]
    return has(r'\b(?:pas|ni|sans|no|not|without|avoid|eviter|interdit|exclude)\b|don\x27t', clause)


def positive(pattern: str, text: str) -> bool:
    value = normalized(text)
    return any(not negative_prefix(value, m.start()) for m in re.finditer(pattern, value))


def resolve_request(brief: dict[str, Any], *, coaching: bool = False) -> dict[str, Any]:
    execution = brief.get('execution') or {}
    if not isinstance(execution, dict) or set(execution) - {'mode','variant_count','workflow_depth','locked_elements','allowed_changes'}:
        raise ValueError('execution contains unsupported controls.')
    if 'mode' in execution and execution['mode'] not in MODES:
        raise ValueError('Unsupported execution.mode.')
    if 'variant_count' in execution and (type(execution['variant_count']) is not int or not 1 <= execution['variant_count'] <= 6):
        raise ValueError('execution.variant_count must be an integer from 1 to 6.')
    if execution.get('workflow_depth','none') not in {'none','full'}:
        raise ValueError('execution.workflow_depth must be none or full.')
    for key in ('locked_elements','allowed_changes'):
        values = execution.get(key, [])
        if not isinstance(values, list) or len(values) > 16 or any(not isinstance(v,str) or not v.strip() or len(v)>1000 for v in values):
            raise ValueError(f'execution.{key} must contain at most 16 nonempty strings, each at most 1000 characters.')
    context = brief.get('design_context') or {}
    # Do not parse message/exact copy, cultural context, or filenames as instructions.
    text = '\n'.join(str(v) for v in [brief.get('request',''), brief.get('question',''), context.get('task','')])
    if len(str(brief.get('request',''))) > 4000:
        raise ValueError('request must not exceed 4000 characters; it is never silently truncated.')
    exclusions = [str(v) for v in brief.get('must_avoid', [])]
    locks = list(execution.get('locked_elements', []))
    declared = normalized(text)
    errors = []
    counts, forbidden = set(), set()
    for match in re.finditer(COUNT_RE, declared):
        token = match.group(1)
        value = quantity_value(token)
        if value is None:
            errors.append('Clarifier le nombre de livrables : une quantité entière est requise.')
            continue
        if not negative_prefix(declared, match.start()) and has(r"(?:\d+|un|une|one|deux|two|trois|three|quatre|four)\s*(?:[-–—]|a|to|ou|or|et|and)\s*$|\b(?:au plus|au moins|maximum|minimum|at most|at least|up to)\s*$", declared[:match.start()]):
            errors.append('Clarifier la plage de quantités; ne pas la convertir en un nombre exact.')
        (forbidden if negative_prefix(declared, match.start()) else counts).add(value)
    for exclusion in exclusions:
        for match in re.finditer(COUNT_RE, normalized(exclusion)):
            token = match.group(1)
            value = quantity_value(token)
            if value is None:
                errors.append('Clarifier la quantité exclue : une quantité entière est requise.')
            else:
                forbidden.add(value)
    if 'variant_count' in execution:
        counts.add(execution['variant_count'])
    if len(counts)>1 or any(c<1 or c>6 or c in forbidden for c in counts):
        errors.append('Clarifier le nombre de livrables : les quantités déclarées sont incompatibles ou hors de la plage 1–6.')
    count = next(iter(counts)) if len(counts)==1 else 1
    if not counts and count in forbidden:
        errors.append('Préciser le nombre souhaité; aucune quantité compatible n’a été déclarée.')
    preserve_identity = has(POLICY['patterns']['preserve_identity'], text) or any(
        has(POLICY['patterns']['identity_change'], item) for item in exclusions
    ) or any(has(r'\b(?:logo|identite|wordmark|monogramme|mot-signe)\b', item) for item in locks)
    no_variants = has(POLICY['patterns']['no_variants'],text)
    advice_only = has(POLICY['patterns']['advice_only'],text) or (coaching and no_variants)
    inferred = 'advice' if coaching else 'create'
    if coaching and (positive(POLICY['patterns']['exercise'],text) or counts):
        inferred = 'exercise'
    if positive(POLICY['patterns']['full_workflow'],text):
        inferred = 'plan' if coaching else inferred
    if not coaching and positive(POLICY['patterns']['identity_exploration'],text):
        inferred = 'identity_exploration'
    if preserve_identity and not coaching:
        inferred = 'adapt'
    if advice_only:
        inferred = 'advice'
    mode = execution.get('mode', inferred)
    if advice_only and mode not in {'advice'}:
        errors.append('La demande de conseil seul contredit le mode de production ou de planification.')
    if preserve_identity and mode=='identity_exploration':
        errors.append('Une identité approuvée est verrouillée; préciser ce qui peut être rouvert avant de proposer une nouvelle identité.')
    if no_variants and (count>1 or mode=='exercise'):
        errors.append('La demande exclut les variantes; ne pas lancer un exercice de variantes.')
    full = execution.get('workflow_depth')=='full' or mode=='plan' or positive(POLICY['patterns']['full_workflow'],text)
    no_workflow = has(POLICY['patterns']['no_workflow'],text)
    if 'workflow_depth' in execution and execution['workflow_depth']=='none' and full:
        errors.append('La profondeur de parcours déclarée contredit la demande de plan complet.')
    if full and no_workflow:
        errors.append('La demande contient à la fois un plan complet et son exclusion; clarifier la portée.')
    identity = mode=='identity_exploration' and not preserve_identity and not errors
    return {
        'status':'clarification_required' if errors else 'resolved',
        'mode':mode, 'variant_count':0 if errors or mode in {'advice','plan'} else count,
        'workflow_depth':'full' if full and not errors else 'none',
        'identity_exploration':identity,
        'preserve_identity':preserve_identity,
        'locked_elements':locks, 'allowed_changes':list(execution.get('allowed_changes',[])),
        'clarifications':errors,
        'source':'host_declared' if execution else 'bounded_request_rules',
        'method_note':'Le modèle hôte interprète l’intention et transmet les contrôles explicites. Le serveur valide leur cohérence; ses règles FR/EN bornées ne sont pas une compréhension générale du langage.',
    }


def request_routes(brief: dict[str, Any], resolution: dict[str, Any], archetypes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    context = brief.get('design_context') or {}
    count = resolution['variant_count']
    if not count:
        return []
    if resolution['identity_exploration'] and count>len(archetypes):
        # Identity archetypes are finite; do not duplicate one while claiming distinct routes.
        raise ValueError('Identity exploration supports at most three structural routes; request layout variations separately.')
    families = POLICY['identity_routes'] if resolution['identity_exploration'] else POLICY['composition_routes']
    medium = context.get('medium') or 'visuel demandé'
    routes = []
    for i, family in enumerate(families[:count]):
        selected = count>1
        architecture = family['architecture'] if selected or resolution['identity_exploration'] else 'Réaliser la demande actuelle, sans ajouter une nouvelle direction artistique ni rouvrir les décisions approuvées.'
        parts = [
            'Create only the requested deliverable for this selected direction. Do not turn it into a branding presentation or add unrequested mockups, reduction strips, grids, or variants.',
            'Exact required text and supplied names must remain verbatim, including case, accents and punctuation. Negative constraints are exclusions, not text to render.',
        ]
        for key,label in [('request','Current user request'),('name','Supplied name (verbatim; render it only when requested)'),('sector','Declared context'),('promise','Declared purpose'),('audience','Declared audience')]:
            if brief.get(key):parts.append(label+': '+str(brief[key]))
        for key,value in context.items():
            parts.append('Declared '+key+': '+str(value))
        if selected or resolution['identity_exploration']:
            parts.append('Selected approach: '+architecture)
        if resolution['identity_exploration']:
            parts.append('Identity exploration is explicitly requested. Do not copy the signatures of third-party precedents. Preserve all supplied locked elements.')
        else:
            parts.append('Do not design a new logo, monogram or brand system. Preserve approved identity assets, palette, typography and motifs exactly unless the current request explicitly authorizes changing them.')
        if resolution['preserve_identity'] or resolution['locked_elements']:
            parts.append('Reuse the actual supplied approved assets. Never invent or redraw a claimed approved asset. If a necessary reference is unavailable in the conversation, ask for it before image editing.')
        for value in resolution['locked_elements']:
            parts.append('Locked element (verbatim): '+value)
        if resolution['allowed_changes']:
            parts.append('Only these changes are authorized: '+'; '.join(resolution['allowed_changes']))
        for value in brief.get('must_avoid',[]):
            parts.append('Declared exclusion (verbatim): '+str(value))
        if brief.get('traits'):
            parts.append('Requested traits: '+'; '.join(brief['traits']))
        if context.get('final_size'):
            parts.append('Respect the declared format and aspect ratio. Do not add desktop/mobile/print views unless requested. A generated preview does not certify final export dimensions.')
        if has(r'\b(?:web|responsive|interface|application|ecran)\b',medium):
            parts.append('For the declared web/interface medium, compose the actual page and its content, navigation and requested actions; preserve the existing identity. Show responsive states only when requested.')
        parts.append('Use only the native image-generation capability available in the host conversation. A prepared prompt is not a rendered image or a completed visual verification.')
        routes.append({
            'id':family['key'], 'name':family['name'] if selected or resolution['identity_exploration'] else 'Réalisation ciblée',
            'thesis':brief.get('request') or context.get('task') or brief.get('promise') or medium,
            'architecture':architecture,
            'geometry':'Respecter le format demandé et les relations existantes; ne pas imposer de grille ou de proportion non demandée.',
            'typography':'Conserver la typographie approuvée et les textes exacts; n’en changer que ce qui est autorisé.',
            'palette_logic':'Conserver les couleurs déclarées; ne pas imposer un passage au monochrome.',
            'assets':family['assets'] if resolution['identity_exploration'] else [medium],
            'stress_tests':[], 'traits_to_express':brief.get('traits',[]), 'must_avoid':brief.get('must_avoid',[]),
            'precedents':[], 'transferable_principles':[],
            'anti_copy_rule':'Utiliser les références externes comme principes, pas comme formes à copier. Les éléments approuvés fournis restent conservés.',
            'fit':{'audience':context.get('audience') or brief.get('audience',''),'sector':brief.get('sector','')},
            'concept_board_prompt':'\n'.join(parts),
            'board_evaluation_focus':['Vérification proposée, non effectuée : correspondance avec la demande actuelle, les éléments verrouillés et le format déclaré.'],
        })
    return routes


def direct_advice(question: str) -> dict[str, Any]:
    alignment = has(r'\b(?:alignement|align|aligned|alignment|centr[eé]|centred|centered)\b',question)
    if alignment:
        answer = 'Pour un sous-titre rattaché à un texte ou à une liste, l’aligner sur le bord gauche de ce contenu donne un repère commun. Le centrage convient plutôt à un bloc court, autonome et déjà centré. Sans voir la composition, c’est une recommandation conditionnelle, pas une validation du visuel.'
    else:
        answer = None
    if answer and has(r'\b(?:should|subtitle|left|centred|centered|only advice)\b', question) and not has(r'\b(?:gauche|sous-titre|alignement)\b', question):
        answer = 'For a subtitle attached to body text or a list, align it to the left edge of that content. Centring is more appropriate for a short, independent block that is already centred. Without seeing the composition, this is conditional advice, not a visual validation.'
    return {
        'answer':answer, 'requires_host_reasoning':answer is None,
        'host_guidance':'Répondre directement à la décision demandée à partir du contexte et des images réellement accessibles. Ne pas proposer de variantes, protocole ou refonte non demandés. Poser seulement une clarification indispensable; ne pas prétendre avoir inspecté une image absente.',
        'evidence_status':'recommandation_conditionnelle' if answer else 'raisonnement_hote_requis',
    }
