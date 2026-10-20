import { DESIGN_PRINCIPLES, DESIGN_WORKFLOW } from 'lib/design-principles-data.js';

const CONTEXT_FIELDS = DESIGN_WORKFLOW.context_fields;
const SOURCES = new Map(DESIGN_PRINCIPLES.sources.map(source => [source.id, source]));
const STOP_WORDS = new Set(['a', 'd', 'de', 'des', 'du', 'et', 'la', 'le', 'les', 'of', 'the']);
const copy = value => JSON.parse(JSON.stringify(value));
const compact = (value, limit) => {
  const text = value.replace(/\s+/g, ' ').trim();
  const chars = [...text];
  return chars.length <= limit ? text : chars.slice(0, limit - 1).join('').trimEnd() + '…';
};

export function normalizePrinciple(value) {
  return String(value || '').normalize('NFKD').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[φϕ]/g, ' phi ').replace(/π/g, ' pi ')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonicalQuery(value) {
  let text = normalizePrinciple(value);
  for (const alias of DESIGN_WORKFLOW.search_aliases) {
    const from = alias.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp('\\b' + from + '\\b', 'g'), alias.to);
  }
  return text;
}

export function catalogueCounts() {
  return { concepts: DESIGN_PRINCIPLES.concepts.length, sources: SOURCES.size, domains: DESIGN_PRINCIPLES.domains.length };
}

function sourceCard(source) {
  const result = copy(source), scope = source.read_level || source.reading;
  const documented = typeof scope === 'string' && Boolean(scope.trim());
  result.read_level = documented ? scope : 'Portée de lecture non renseignée dans le catalogue.';
  result.read_scope_status = documented ? 'documented' : 'not_recorded';
  return result;
}

export function searchPrinciples(query = '', limit = 12) {
  if (typeof query !== 'string') throw new Error('query must be a string.');
  if (!Number.isInteger(limit)) throw new Error('limit must be an integer.');
  query = compact(query, 500);
  const canonical = canonicalQuery(query), terms = canonical.split(' ').filter(term => term && !STOP_WORDS.has(term));
  const ranked = [];
  for (const concept of DESIGN_PRINCIPLES.concepts) {
    const sources = (concept.source_ids || []).map(id => SOURCES.get(id));
    if (sources.some(source => !source)) throw new Error('Unresolved principle source.');
    const basisLabel = DESIGN_PRINCIPLES.basis_labels[concept.basis] || concept.basis;
    const fields = ['id', 'name', 'definition', 'application', 'limits', 'formula', 'domain', 'domain_label', 'basis', 'verification_note'].map(key => concept[key] || '');
    fields.push(basisLabel);
    for (const source of sources) for (const key of ['title', 'authors', 'year', 'supports']) fields.push(source[key] || '');
    const haystack = normalizePrinciple(fields.join(' '));
    if (query && (!terms.length || !terms.every(term => haystack.includes(term)))) continue;
    const name = normalizePrinciple(concept.name);
    let score = canonical && canonical === normalizePrinciple(concept.id) ? 100 : 0;
    score += canonical && canonical === name ? 30 : 0;
    score += canonical && name.includes(canonical) ? 10 : 0;
    score += 2 * terms.filter(term => name.includes(term)).length;
    ranked.push({ score, concept, sources, basisLabel });
  }
  ranked.sort((a, b) => b.score - a.score || (a.concept.id < b.concept.id ? -1 : a.concept.id > b.concept.id ? 1 : 0));
  return {
    collection: 'design_principles', query: compact(query, 250), normalized_query: canonical, kind: 'principle',
    total_matches: ranked.length, catalogue_counts: catalogueCounts(),
    items: ranked.slice(0, Math.max(1, Math.min(limit, 25))).map(({ concept, sources, basisLabel }) => ({ ...copy(concept), kind: 'principle', basis_label: basisLabel, sources: sources.map(sourceCard) })),
    method_note: 'Recherche documentaire : lire définition, application, limites et portée des sources. Le classement exprime une pertinence textuelle, pas une preuve d’efficacité sur le projet.'
  };
}

export function normalizeDesignContext(value = null) {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !Object.hasOwn(CONTEXT_FIELDS, key))) {
    throw new Error('design_context must contain only the documented context fields.');
  }
  const out = {};
  for (const [key, text] of Object.entries(value)) {
    if (typeof text !== 'string' || [...text].length > CONTEXT_FIELDS[key].max_length) {
      throw new Error(`design_context.${key} must be a string of at most ${CONTEXT_FIELDS[key].max_length} characters.`);
    }
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean) out[key] = clean;
  }
  return out;
}

export function untestedEvaluations() {
  return copy(DESIGN_WORKFLOW.evaluations);
}

export function buildDesignWorkflow(designContext = null, declaredBrief = null) {
  const brief = normalizeDesignContext(designContext);
  const briefSources = Object.fromEntries(Object.keys(brief).map(key => [key, 'design_context.' + key]));
  // Read original arguments only, never defaults synthesized for creative routes.
  for (const [target, source] of [['audience', 'audience'], ['message', 'promise']]) {
    const value = declaredBrief?.[source];
    if (!Object.hasOwn(brief, target) && typeof value === 'string' && value.trim()) {
      brief[target] = compact(value, CONTEXT_FIELDS[target].max_length);
      briefSources[target] = source;
    }
  }
  return {
    schema_version: DESIGN_WORKFLOW.schema_version, title: DESIGN_WORKFLOW.title,
    status: 'non_testé', scope_note: DESIGN_WORKFLOW.scope_note,
    brief, brief_sources: briefSources, missing_brief: Object.keys(CONTEXT_FIELDS).filter(key => !Object.hasOwn(brief, key)),
    stages: copy(DESIGN_WORKFLOW.stages), evaluations: untestedEvaluations(), evidence_contract: copy(DESIGN_WORKFLOW.evidence_contract),
    principle_lookup: { tool: 'search_design_systems', kind: 'principle', query_hint: 'Utiliser un identifiant de principe ou un thème pour lire la fiche complète et ses sources.' },
    catalogue_counts: catalogueCounts()
  };
}
