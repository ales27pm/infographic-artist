// Bounded controls, shared acceptance fixtures and vocabulary with Python.
// The host interprets intent; the server checks scope/constraints, not arbitrary semantics.
import { REQUEST_POLICY as POLICY } from 'lib/request-policy-data.js';
const MODES = new Set(['create','adapt','identity_exploration','advice','exercise','plan']);
// One vocabulary for public directions and the exercise planner in both runtimes.
const NUMBERS = POLICY.quantity.number_words;
const quantityPattern=nouns=>String.raw`(?<![\w.,])([+-]?[0-9]+(?:[.,][0-9]+)?|${Object.keys(NUMBERS).join('|')})\s+(?:(?:seul|seule|single)\s+)?(?:${nouns.join('|')})\b`;
const COUNT=quantityPattern([...POLICY.quantity.variant_nouns,...POLICY.quantity.deliverable_nouns]);
export const VARIANT_COUNT_PATTERN=quantityPattern(POLICY.quantity.variant_nouns);
export function quantityValue(token){
 token=token.toLowerCase();
 return Object.hasOwn(NUMBERS,token)?NUMBERS[token]:/^[+-]?[0-9]+$/.test(token)?Number(token):null;
}
const normalized = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/’/g,"'");
const has = (pattern,value) => new RegExp(pattern).test(normalized(value));
function negativePrefix(text,start){
 const clause=text.slice(0,start).split(/[.!?;,\n]|\b(?:mais|but|rather|plutot)\b/).at(-1);
 return has(String.raw`\b(?:pas|ni|sans|no|not|without|avoid|eviter|interdit|exclude)\b|don\x27t`,clause);
}
const positive=(pattern,text)=>{const value=normalized(text);return [...value.matchAll(new RegExp(pattern,'g'))].some(m=>!negativePrefix(value,m.index));};
export function resolveRequest(brief,{coaching=false}={}){
 const execution=brief.execution??{};
 if(typeof execution!=='object'||Array.isArray(execution)||Object.keys(execution).some(k=>!['mode','variant_count','workflow_depth','locked_elements','allowed_changes'].includes(k)))throw new Error('execution contains unsupported controls.');
 if(execution.mode!==undefined&&!MODES.has(execution.mode))throw new Error('Unsupported execution.mode.');
 if(execution.variant_count!==undefined&&(!Number.isInteger(execution.variant_count)||execution.variant_count<1||execution.variant_count>6))throw new Error('execution.variant_count must be an integer from 1 to 6.');
 if(!['none','full'].includes(execution.workflow_depth??'none'))throw new Error('execution.workflow_depth must be none or full.');
 for(const key of ['locked_elements','allowed_changes']){
  const values=execution[key]??[];
  if(!Array.isArray(values)||values.length>16||values.some(v=>typeof v!=='string'||!v.trim()||[...v].length>1000))throw new Error(`execution.${key} must contain at most 16 nonempty strings, each at most 1000 characters.`);
 }
 const context=brief.design_context??{},text=[brief.request??'',brief.question??'',context.task??''].join('\n');
 if([...String(brief.request??'')].length>4000)throw new Error('request must not exceed 4000 characters; it is never silently truncated.');
 const exclusions=(brief.must_avoid??[]).map(String),locks=[...(execution.locked_elements??[])],declared=normalized(text),errors=[],counts=new Set(),forbidden=new Set();
 for(const m of declared.matchAll(new RegExp(COUNT,'g'))){
  const value=quantityValue(m[1]);
  if(value===null){errors.push('Clarifier le nombre de livrables : une quantité entière est requise.');continue;}
  if(!negativePrefix(declared,m.index)&&has(String.raw`(?:\d+|un|une|one|deux|two|trois|three|quatre|four)\s*(?:[-–—]|a|to|ou|or|et|and)\s*$|\b(?:au plus|au moins|maximum|minimum|at most|at least|up to)\s*$`,declared.slice(0,m.index)))errors.push('Clarifier la plage de quantités; ne pas la convertir en un nombre exact.');
  (negativePrefix(declared,m.index)?forbidden:counts).add(value);
 }
 for(const exclusion of exclusions)for(const m of normalized(exclusion).matchAll(new RegExp(COUNT,'g'))){
  const value=quantityValue(m[1]);
  if(value===null)errors.push('Clarifier la quantité exclue : une quantité entière est requise.');else forbidden.add(value);
 }
 if(execution.variant_count!==undefined)counts.add(execution.variant_count);
 if(counts.size>1||[...counts].some(c=>c<1||c>6||forbidden.has(c)))errors.push('Clarifier le nombre de livrables : les quantités déclarées sont incompatibles ou hors de la plage 1–6.');
 const count=counts.size===1?[...counts][0]:1;
 if(!counts.size&&forbidden.has(count))errors.push('Préciser le nombre souhaité; aucune quantité compatible n’a été déclarée.');
 const preserveIdentity=has(POLICY.patterns.preserve_identity,text)||exclusions.some(x=>has(POLICY.patterns.identity_change,x))||locks.some(x=>has(String.raw`\b(?:logo|identite|wordmark|monogramme|mot-signe)\b`,x));
 const noVariants=has(POLICY.patterns.no_variants,text),adviceOnly=has(POLICY.patterns.advice_only,text)||(coaching&&noVariants);
 let inferred=coaching?'advice':'create';
 if(coaching&&(positive(POLICY.patterns.exercise,text)||counts.size))inferred='exercise';
 if(positive(POLICY.patterns.full_workflow,text)&&coaching)inferred='plan';
 if(!coaching&&positive(POLICY.patterns.identity_exploration,text))inferred='identity_exploration';
 if(preserveIdentity&&!coaching)inferred='adapt';
 if(adviceOnly)inferred='advice';
 const mode=execution.mode??inferred;
 if(adviceOnly&&mode!=='advice')errors.push('La demande de conseil seul contredit le mode de production ou de planification.');
 if(preserveIdentity&&mode==='identity_exploration')errors.push('Une identité approuvée est verrouillée; préciser ce qui peut être rouvert avant de proposer une nouvelle identité.');
 if(noVariants&&(count>1||mode==='exercise'))errors.push('La demande exclut les variantes; ne pas lancer un exercice de variantes.');
 const full=execution.workflow_depth==='full'||mode==='plan'||positive(POLICY.patterns.full_workflow,text),noWorkflow=has(POLICY.patterns.no_workflow,text);
 if(execution.workflow_depth==='none'&&full)errors.push('La profondeur de parcours déclarée contredit la demande de plan complet.');
 if(full&&noWorkflow)errors.push('La demande contient à la fois un plan complet et son exclusion; clarifier la portée.');
 return {status:errors.length?'clarification_required':'resolved',mode,variant_count:errors.length||['advice','plan'].includes(mode)?0:count,workflow_depth:full&&!errors.length?'full':'none',identity_exploration:mode==='identity_exploration'&&!preserveIdentity&&!errors.length,preserve_identity:preserveIdentity,locked_elements:locks,allowed_changes:[...(execution.allowed_changes??[])],clarifications:errors,source:Object.keys(execution).length?'host_declared':'bounded_request_rules',method_note:'Le modèle hôte interprète l’intention et transmet les contrôles explicites. Le serveur valide leur cohérence; ses règles FR/EN bornées ne sont pas une compréhension générale du langage.'};
}
export function requestRoutes(brief,resolution,archetypes){
 const context=brief.design_context??{},count=resolution.variant_count;
 if(!count)return [];
 if(resolution.identity_exploration&&count>archetypes.length)throw new Error('Identity exploration supports at most three structural routes; request layout variations separately.');
 const families=resolution.identity_exploration?POLICY.identity_routes:POLICY.composition_routes,medium=context.medium||'visuel demandé';
 return families.slice(0,count).map(family=>{
  const selected=count>1,architecture=selected||resolution.identity_exploration?family.architecture:'Réaliser la demande actuelle, sans ajouter une nouvelle direction artistique ni rouvrir les décisions approuvées.';
  const parts=['Create only the requested deliverable for this selected direction. Do not turn it into a branding presentation or add unrequested mockups, reduction strips, grids, or variants.','Exact required text and supplied names must remain verbatim, including case, accents and punctuation. Negative constraints are exclusions, not text to render.'];
  for(const [key,label] of [['request','Current user request'],['name','Supplied name (verbatim; render it only when requested)'],['sector','Declared context'],['promise','Declared purpose'],['audience','Declared audience']])if(brief[key])parts.push(label+': '+brief[key]);
  for(const [key,value]of Object.entries(context))parts.push('Declared '+key+': '+value);
  if(selected||resolution.identity_exploration)parts.push('Selected approach: '+architecture);
  parts.push(resolution.identity_exploration?'Identity exploration is explicitly requested. Do not copy the signatures of third-party precedents. Preserve all supplied locked elements.':'Do not design a new logo, monogram or brand system. Preserve approved identity assets, palette, typography and motifs exactly unless the current request explicitly authorizes changing them.');
  if(resolution.preserve_identity||resolution.locked_elements.length)parts.push('Reuse the actual supplied approved assets. Never invent or redraw a claimed approved asset. If a necessary reference is unavailable in the conversation, ask for it before image editing.');
  for(const value of resolution.locked_elements)parts.push('Locked element (verbatim): '+value);
  if(resolution.allowed_changes.length)parts.push('Only these changes are authorized: '+resolution.allowed_changes.join('; '));
  for(const value of brief.must_avoid??[])parts.push('Declared exclusion (verbatim): '+value);
  if(brief.traits?.length)parts.push('Requested traits: '+brief.traits.join('; '));
  if(context.final_size)parts.push('Respect the declared format and aspect ratio. Do not add desktop/mobile/print views unless requested. A generated preview does not certify final export dimensions.');
  if(has(String.raw`\b(?:web|responsive|interface|application|ecran)\b`,medium))parts.push('For the declared web/interface medium, compose the actual page and its content, navigation and requested actions; preserve the existing identity. Show responsive states only when requested.');
  parts.push('Use only the native image-generation capability available in the host conversation. A prepared prompt is not a rendered image or a completed visual verification.');
  return {id:family.key,name:selected||resolution.identity_exploration?family.name:'Réalisation ciblée',thesis:brief.request||context.task||brief.promise||medium,architecture,geometry:'Respecter le format demandé et les relations existantes; ne pas imposer de grille ou de proportion non demandée.',typography:'Conserver la typographie approuvée et les textes exacts; n’en changer que ce qui est autorisé.',palette_logic:'Conserver les couleurs déclarées; ne pas imposer un passage au monochrome.',assets:resolution.identity_exploration?family.assets:[medium],stress_tests:[],traits_to_express:brief.traits??[],must_avoid:brief.must_avoid??[],precedents:[],transferable_principles:[],anti_copy_rule:'Utiliser les références externes comme principes, pas comme formes à copier. Les éléments approuvés fournis restent conservés.',fit:{audience:context.audience||brief.audience||'',sector:brief.sector||''},concept_board_prompt:parts.join('\n'),board_evaluation_focus:['Vérification proposée, non effectuée : correspondance avec la demande actuelle, les éléments verrouillés et le format déclaré.']};
 });
}
export function directAdvice(question){
 const alignment=has(String.raw`\b(?:alignement|align|aligned|alignment|centr[eé]|centred|centered)\b`,question);
 let answer=alignment?'Pour un sous-titre rattaché à un texte ou à une liste, l’aligner sur le bord gauche de ce contenu donne un repère commun. Le centrage convient plutôt à un bloc court, autonome et déjà centré. Sans voir la composition, c’est une recommandation conditionnelle, pas une validation du visuel.':null;
 if(answer&&has(String.raw`\b(?:should|subtitle|left|centred|centered|only advice)\b`,question)&&!has(String.raw`\b(?:gauche|sous-titre|alignement)\b`,question))answer='For a subtitle attached to body text or a list, align it to the left edge of that content. Centring is more appropriate for a short, independent block that is already centred. Without seeing the composition, this is conditional advice, not a visual validation.';
 return {answer,requires_host_reasoning:answer===null,host_guidance:'Répondre directement à la décision demandée à partir du contexte et des images réellement accessibles. Ne pas proposer de variantes, protocole ou refonte non demandés. Poser seulement une clarification indispensable; ne pas prétendre avoir inspecté une image absente.',evidence_status:answer?'recommandation_conditionnelle':'raisonnement_hote_requis'};
}
