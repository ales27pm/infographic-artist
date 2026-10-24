import { loadAtlas, loadLibrary, loadGraph } from "./data.js";
import { generationHandoff, requireRendering } from "./runtime.js";
import { buildDesignWorkflow, searchPrinciples, untestedEvaluations } from "./design-workflow.js";
import { SITE } from "./site-config.js";
import { createHash, randomUUID } from "node:crypto";

const MAX_RESULTS = 25;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png','image/jpeg','image/webp','image/gif']);
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_ASSET_RETENTION_HOURS = 168;
const SUPPORTED_RENDER_SIZES = new Set(["auto","1024x1024","1536x1024","1024x1536"]);
const SUPPORTED_RENDER_QUALITIES = new Set(["auto","low","medium","high"]);
const SUPPORTED_OUTPUT_FORMATS = new Set(["png","jpeg","webp"]);
const SUPPORTED_BACKGROUNDS = new Set(["auto","transparent","opaque"]);
const SEARCH_FIELDS = [
  ['name',8],['organization',5],['designers',5],['category',3],['archetype',4],
  ['system_pattern',5],['primary_mechanism',4],['mechanism_clusters',3],['tags',2.5],
  ['region',2],['era',1.5],['visual_mechanism',1.5],['brand_system_lesson',1.25],['transferable_principles',1.5]
];

function asText(value) {
  if (Array.isArray(value)) return value.map(asText).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(asText).join(' ');
  return String(value ?? '');
}
export function normalize(value) {
  return asText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function compactText(value, limit = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}
function fieldText(item, field) { return normalize(item?.[field] ?? ''); }
function tokens(text) { return normalize(text).split(' ').filter((token) => token.length >= 2); }
function scoreBrand(item, query) {
  const queryN = normalize(query);
  if (!queryN && String(query).trim()) return 0;
  if (!queryN) {
    let base = item.depth === 'deep' ? 5 : 1;
    if (item.evidence_confidence === 'high') base += 0.8;
    return base + Number(item.anchor_year || 0) / 100000;
  }
  const qTokens = tokens(queryN);
  let score = 0;
  for (const [field, weight] of SEARCH_FIELDS) {
    const text = fieldText(item, field);
    if (!text) continue;
    if (queryN === text) score += weight * 4;
    else if (text.includes(queryN)) score += weight * 2.2;
    const matched = qTokens.filter((token) => text.includes(token)).length;
    score += weight * matched / Math.max(qTokens.length, 1);
  }
  if (score > 0 && item.depth === 'deep') score += 0.75;
  return score;
}
function compactBrand(item) {
  return {
    id:item.id,name:item.name,organization:item.organization || '',year:item.first_use || item.anchor_year,
    designers:(item.designers || []).slice(0,4),category:item.category || '',region:item.region || '',era:item.era || '',
    archetype:item.archetype || '',system_pattern:item.system_pattern || '',primary_mechanism:item.primary_mechanism || '',
    why_iconic:compactText(item.why_iconic,260),lesson:compactText(item.brand_system_lesson,300),
    principles:(item.transferable_principles || []).slice(0,4),do_not_copy:compactText(item.do_not_copy,260),
    evidence:item.evidence_confidence || item.evidence_level || 'index',depth:item.depth || ((item.sources || []).length ? 'deep' : 'index')
  };
}
function counts(items, key) {
  const map = new Map();
  for (const item of items) { const value = item[key] || 'non classé'; map.set(value,(map.get(value)||0)+1); }
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}));
}
export async function atlasSummary() {
  const [atlas,library,graph]=await Promise.all([loadAtlas(),loadLibrary(),loadGraph()]);
  return {brand_count:atlas.brands.length,deep_case_count:Number(atlas.deep_case_count||0),index_case_count:Number(atlas.index_case_count||0),library_count:(library.entries||[]).length,graph_nodes:(graph.nodes||[]).length,graph_edges:(graph.edges||[]).length,top_patterns:counts(atlas.brands,'system_pattern'),top_regions:counts(atlas.brands,'region')};
}
export async function searchAtlas(query='', {region='',pattern='',category='',era='',limit=12}={}) {
  limit=Math.max(1,Math.min(Number(limit)||12,MAX_RESULTS));
  const filters={region:normalize(region),system_pattern:normalize(pattern),category:normalize(category),era:normalize(era)};
  const ranked=[];
  for (const item of (await loadAtlas()).brands) {
    if (Object.entries(filters).some(([field,value])=>value && !fieldText(item,field).includes(value))) continue;
    const score=scoreBrand(item,query);
    if (String(query).trim() && score<=0) continue;
    ranked.push({score,item});
  }
  ranked.sort((a,b)=>b.score-a.score || Number(b.item.depth==='deep')-Number(a.item.depth==='deep') || String(b.item.name).localeCompare(String(a.item.name)));
  return {query:compactText(query,250),filters:Object.fromEntries(Object.entries({region,pattern,category,era}).filter(([,v])=>v)),total_matches:ranked.length,items:ranked.slice(0,limit).map(({score,item})=>({...compactBrand(item),relevance:Math.round(score*1000)/1000}))};
}
async function findBrand(itemId) {
  const target=String(itemId||'');
  const brands=(await loadAtlas()).brands;
  return brands.find((item)=>item.id===target) || brands.find((item)=>normalize(item.name)===normalize(target));
}
export async function getBrandCase(itemId) {
  const item=await findBrand(itemId); if (!item) return null;
  return {...compactBrand(item),visual_mechanism:compactText(item.visual_mechanism,700),recognition_basis:(item.recognition_basis||[]).slice(0,6),asset_layers:(item.asset_layers||[]).slice(0,8),collision_layers:(item.collision_layers||[]).slice(0,8),stress_tests:(item.stress_tests||[]).slice(0,8),benchmark_dimensions:item.benchmark_dimensions||{},legal_sensitivity:item.legal_sensitivity||'standard',sources:(item.sources||[]).slice(0,6).filter((s)=>s?.url).map((s)=>({title:compactText(s.title,180),url:s.url||'',kind:s.kind||''}))};
}
export async function compareBrandSystems(ids) {
  const unique=[]; for (const id of (ids||[])) if (!unique.includes(id)) unique.push(id);
  if (unique.length<2 || unique.length>4) throw new Error('Fournir entre 2 et 4 identifiants uniques de l’atlas.');
  const cases=await Promise.all(unique.map(async (id)=>{const item=await getBrandCase(id); if(!item) throw new Error(`Identifiant d’atlas inconnu : ${id}`); return item;}));
  const patternCounts=new Map(), mechanismCounts=new Map();
  for (const item of cases) { if(item.system_pattern) patternCounts.set(item.system_pattern,(patternCounts.get(item.system_pattern)||0)+1); const full=await findBrand(item.id); for(const m of (full?.mechanism_clusters||[])) mechanismCounts.set(m,(mechanismCounts.get(m)||0)+1); }
  const shared_patterns=[...patternCounts].filter(([,c])=>c>1).map(([n])=>n), shared_mechanisms=[...mechanismCounts].filter(([,c])=>c>1).map(([n])=>n);
  return {cases:cases.map((c)=>({id:c.id,name:c.name,pattern:c.system_pattern,mechanism:c.primary_mechanism,principles:c.principles.slice(0,3),collision_boundary:c.do_not_copy,stress_tests:c.stress_tests.slice(0,4)})),shared_patterns,shared_mechanisms,synthesis:(shared_patterns.length||shared_mechanisms.length)?'Transférer la logique de conception partagée seulement après avoir changé la silhouette, la topologie, la typographie, le comportement chromatique et la composition.':'Ces précédents sont structurellement distincts; les utiliser pour créer des routes concurrentes plutôt qu’un pastiche fusionné.'};
}
function libraryId(item) { return normalize(item.name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
export async function searchDesignSystems(query='',kind='',limit=12) {
  if (['principle','principles','principe','principes'].includes(normalize(kind))) return searchPrinciples(query, limit);
  limit=Math.max(1,Math.min(Number(limit)||12,25)); const q=normalize(query), kindN=normalize(kind), qTokens=tokens(q), ranked=[];
  for (const item of ((await loadLibrary()).entries||[])) {
    if(kindN && !normalize(item.type).includes(kindN)) continue;
    const fields=[item.name,item.type,item.region,item.era,...(item.focus||[]),...(item.principles||[]),...(item.key_works||[])];
    const haystack=normalize(fields.filter(Boolean).join(' '));
    if(q && !qTokens.some((token)=>haystack.includes(token))) continue;
    let score=q && normalize(item.name).includes(q)?4:0; score+=qTokens.filter((token)=>haystack.includes(token)).length; ranked.push({score,item});
  }
  ranked.sort((a,b)=>b.score-a.score || String(b.item.name).localeCompare(String(a.item.name)));
  return {query:compactText(query,250),kind,total_matches:ranked.length,items:ranked.slice(0,limit).map(({item})=>({id:libraryId(item),name:item.name,kind:item.type||'',region:item.region||'',era:item.era||'',focus:(item.focus||[]).slice(0,6),principles:(item.principles||[]).slice(0,5),signature_projects:(item.key_works||[]).slice(0,5),source_url:item.source_url||'',source_status:item.source_status||''}))};
}
export async function exploreGraph(query = '', limit = 80) {
  limit = Math.max(20, Math.min(Number(limit) || 80, 120));
  const graph = await loadGraph(), nodes = graph.nodes || [], edges = graph.edges || [];
  const qTokens = tokens(query), q = normalize(query), hasQuery = Boolean(String(query).trim());
  const fields = node => ['id', 'label', 'node_type', 'category', 'kind', 'ref'].map(key => normalize(node[key] ?? ''));
  const rank = node => [q && fields(node).includes(q) ? 0 : 1, q && normalize(node.label).startsWith(q) ? 0 : 1, -(node.degree || 0), node.id];
  const compare = (a, b) => {
    const x = rank(a), y = rank(b);
    for (let i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; }
    return 0;
  };
  const matches = hasQuery ? nodes.filter(node => qTokens.length && qTokens.every(token => fields(node).join(' ').includes(token))) : [];
  const matchIds = new Set(matches.map(node => node.id));
  let candidates;
  if (hasQuery) {
    const adjacent = new Set();
    for (const edge of edges) {
      if (matchIds.has(edge.source)) adjacent.add(edge.target);
      if (matchIds.has(edge.target)) adjacent.add(edge.source);
    }
    const neighbours = nodes.filter(node => adjacent.has(node.id) && !matchIds.has(node.id));
    candidates = [...matches.sort(compare), ...neighbours.sort(compare)];
  } else candidates = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const filtered = candidates.slice(0, limit), keep = new Set(filtered.map(node => node.id));
  const outEdges = edges.filter(edge => keep.has(edge.source) && keep.has(edge.target)).slice(0, limit * 3);
  return {
    query: compactText(query, 250),
    nodes: filtered.map(node => ({ id: node.id, label: node.label || node.id, type: node.node_type || 'concept', ref: node.ref || '',
      x: node.x ?? .5, y: node.y ?? .5, degree: node.degree || 0, is_match: matchIds.has(node.id),
      distance: hasQuery ? (matchIds.has(node.id) ? 0 : 1) : null })),
    edges: outEdges,
    meta: { node_count: filtered.length, edge_count: outEdges.length, matched_count: matches.length,
      returned_match_count: filtered.filter(node => matchIds.has(node.id)).length,
      context_hops: 1, no_matches: hasQuery && matches.length === 0, truncated: candidates.length > limit }
  };
}
const ROUTE_ARCHETYPES=[
  {key:'symbol',name:'Signal autonome',architecture:'Un symbole compact conçu d’abord en silhouette monochrome, puis relié au nom par une règle de proportion stable.',geometry:'Une masse primaire, une tension directionnelle et une contreforme utile. Éviter les détails décoratifs avant 24 px.',typography:'Mot-signe calme et distinct, sans chercher à répéter littéralement la forme du symbole.',assets:['symbole','mot-signe','micro-icône','règles de réduction'],tests:['12/24/48 px','monochrome','flou 3 px','découpe','rappel après 2 secondes']},
  {key:'type',name:'Rythme typographique propriétaire',architecture:'Le nom devient l’actif principal grâce à une anomalie locale, un rythme ou une modulation issue de la promesse.',geometry:'Construire les intervalles, ligatures et contreformes sur une grille; limiter l’idée distinctive à un geste répétable.',typography:'Dessin ou modification ciblée plutôt qu’une police spectaculaire non gouvernée.',assets:['mot-signe','monogramme','alphabet secondaire','motif dérivé'],tests:['lecture immédiate','gravure','petite taille','langues secondaires','animation de construction']},
  {key:'system',name:'Champ vivant gouverné',architecture:'Une grammaire stable génère plusieurs compositions, icônes ou cadres sans figer la marque dans une seule image.',geometry:'Définir des invariants mesurables — grille, module, angle, densité et zone de repos — avant les variations.',typography:'Typographie fonctionnelle servant d’ancrage pendant que le champ visuel varie.',assets:['grille','règles de variation','bibliothèque de modules','motion','gabarits'],tests:['10 variantes cohérentes','signalétique','motion 2 secondes','supports étroits','version statique']}
];
const CONCEPT_BOARD_LAYERS={
  symbol:'a dominant black-and-white symbol silhouette, a reduction strip at 48, 24, and 12 px, one cropped detail showing the counterform logic, and two restrained application mockups',
  type:'a wordmark construction study using the exact locked brand name, spacing rhythm diagrams, a monogram crop, and two small-use tests where the typographic anomaly remains readable',
  system:'a governed visual grammar with a visible grid, three generated module variations, one motion/keyframe strip, and two application mockups that share the same invariants'
};
function joinPromptTerms(values,fallback,limit=6){const clean=(values||[]).map((value)=>compactText(value,90)).filter(Boolean);return clean.length?clean.slice(0,limit).join(', '):fallback;}
function conceptBoardPrompt({ name, sector, promise, audience, traits, avoid, arch, precedents, designContext = {} }) {
  const medium = designContext.medium || '';
  const webMedium = ['web', 'interface', 'responsive', 'ecran', 'application'].some(token => normalize(medium).includes(token));
  const layoutLayers = {
    symbol: 'a complete responsive page with one dominant visual anchor, readable content hierarchy, navigation and a clear primary action; integrate the mark instead of delivering a logo sheet',
    type: 'a complete editorial page led by the exact headline and brand name, deliberate type scale, column rhythm and a visible primary action; show the mobile reflow, not only letter construction',
    system: 'a complete page system with repeatable sections, a governed content grid, navigation and responsive module behaviour; the grid must organize real content rather than become decoration'
  };
  const layer = webMedium ? layoutLayers[arch.key] : CONCEPT_BOARD_LAYERS[arch.key];
  const parts = [
    medium ? 'Create an original design study for the declared medium, not a generic logo-only concept board.' : 'Create one concept board for an original brand identity, not a finished logo.',
    `Locked brand name (verbatim): ${JSON.stringify(name)}.`,
    'Preserve the locked name and every exact required text or motif in the declared brief verbatim, including punctuation, case and accents. Never replace them with abstract glyphs or substitute words. Negative constraints are exclusions, not content to render.'
  ];
  for (const [key, label] of [['task', 'Declared task'], ['message', 'Declared message and exact-copy instructions'], ['medium', 'Primary deliverable / medium'], ['final_size', 'Required final applications and dimensions'], ['cultural_context', 'Language, cultural and palette constraints']]) {
    if (designContext[key]) parts.push(`${label}: ${designContext[key]}`);
  }
  if (designContext.final_size) parts.push('Show each listed application as a separate labelled view at its stated aspect ratio. Include the declared desktop/mobile reflow and print application where requested; do not force them into a square layout. A concept preview is not a verified final-size export.');
  parts.push(
    `Sector: ${sector}. Promise: ${promise}. Audience: ${audience}.`,
    `Direction: ${arch.name}. Structural principle: ${arch.architecture} Show ${layer}.`,
    `Traits to express: ${joinPromptTerms(traits, 'clear, coherent, distinctive')}.`,
    avoid.length ? `Declared exclusions (verbatim): ${avoid.join('; ')}` : 'No additional exclusions declared.',
    `The cited precedents are method-only context (${joinPromptTerms(precedents.map(source => source.name), 'no visible precedent references', 3)}); do not include, imitate, remix or allude visually to their protected forms.`,
    'Do not reproduce existing marks, protected logos, mascots, signature lettering, negative-space tricks, trade dress or recognizable third-party brand systems.',
    'Placeholder copy is permitted only for secondary content explicitly authorized by the brief, never for the locked name or required text. If faithful lettering cannot be produced, leave a clearly identified blank area for separate exact typesetting rather than inventing glyphs. Keep the design independently derived and production-minded.'
  );
  return parts.join(' ');
}
function boardEvaluationFocus(arch){return[`La planche exprime la promesse par la structure ${arch.key} plutôt que par une finition de surface.`,'La silhouette, la topologie, la typographie, le comportement chromatique et la composition divergent clairement des précédents cités.','L’idée principale survit aux tests monochrome, petite taille, flou et rappel rapide.'];}
function seedFromText(text){let h=2166136261; for(let i=0;i<text.length;i++){h^=text.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0;}
function seededShuffle(values, seed){const out=[...values]; let s=seed||1; const rand=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;}; for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out;}
export async function generateDirections(brief) {
  const name=String(brief?.name ?? '').trim(); if([...name].length>120) throw new Error('The exact brand name must not exceed 120 characters; it is never silently truncated.'); const sector=compactText(brief?.sector,160), promise=compactText(brief?.promise,1000); if(!name||!sector||promise.length<3) throw new Error('name, sector, and a meaningful promise are required.');
  const designWorkflow=buildDesignWorkflow(brief.design_context,brief);
  const audience=compactText(designWorkflow.brief.audience||'public général',400), traits=(brief.traits||[]).map((v)=>compactText(v,100)).filter(Boolean).slice(0,8), avoid=(brief.must_avoid||[]).map((v)=>String(v).trim()).filter(Boolean).slice(0,8), risk=brief.risk_tolerance||'équilibrée';
  const seedMaterial=JSON.stringify({name,sector,promise,traits,avoid,risk}); let precedents=(await searchAtlas([sector,promise,...traits].join(' '),{limit:12})).items; precedents=seededShuffle(precedents,seedFromText(seedMaterial));
  const routes=ROUTE_ARCHETYPES.map((arch,index)=>{const precedent=precedents[index], secondary=precedents[index+3], sources=[precedent,secondary].filter(Boolean), principles=[]; for(const source of sources) principles.push(...(source.principles||[]).slice(0,2)); const route={id:arch.key,name:arch.name,thesis:`Pour ${name}, rendre « ${promise} » visible par ${arch.architecture[0].toLowerCase()+arch.architecture.slice(1)}`,architecture:arch.architecture,geometry:arch.geometry,typography:arch.typography,palette_logic:'Commencer en noir et blanc; ajouter une couleur fonctionnelle liée à la promesse, puis vérifier le contraste et la reproduction.',assets:arch.assets,stress_tests:arch.tests,traits_to_express:traits.length?traits:['clarté','cohérence','présence'],must_avoid:avoid,precedents:sources.map((source)=>({id:source.id,name:source.name,principle_only:(source.principles||[source.lesson||''])[0]})),transferable_principles:[...new Set(principles)].slice(0,4),anti_copy_rule:'Ne pas emprunter la silhouette, la construction des lettres, la combinaison chromatique, le dispositif d’espace négatif ou la composition du précédent. Redériver chaque forme depuis ce brief.',fit:{audience,risk_tolerance:risk,sector}};route.concept_board_prompt=conceptBoardPrompt({name,sector,promise,audience,traits,avoid,arch,precedents:route.precedents,designContext:{...designWorkflow.brief,...(brief.design_context||{})}});route.board_evaluation_focus=boardEvaluationFocus(arch);return route;});
  return {brief:{name,sector,promise,audience,traits,must_avoid:avoid,risk_tolerance:risk},routes,design_workflow:designWorkflow,image_generation_handoff:generationHandoff(),decision_rule:'Prototyper les trois routes en monochrome avant d’en choisir une. Retenir celle dont la structure — et non la finition — rend la promesse la plus facile à percevoir et la plus difficile à confondre.'};
}
const RENDER_JOBS = globalThis.__INFOGRAPHIC_RENDER_JOBS || (globalThis.__INFOGRAPHIC_RENDER_JOBS = new Map());
const RENDER_ASSETS = globalThis.__INFOGRAPHIC_RENDER_ASSETS || (globalThis.__INFOGRAPHIC_RENDER_ASSETS = new Map());
const MOCK_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const DEFAULT_GENERATED_ASSET_MAX_BYTES = 512 * 1024 * 1024;
const DEFAULT_RENDER_DAILY_IMAGE_LIMIT = 25;
const DEFAULT_RENDER_MAX_CONCURRENT_JOBS = 2;
const MAX_RENDER_METADATA_BYTES = 40000;
function nowIso(){return new Date().toISOString();}
function positiveNumberEnv(name, fallback){const value=Number(process.env[name]||fallback);return Number.isFinite(value)&&value>0?value:fallback;}
function positiveIntEnv(name, fallback){const value=Number.parseInt(process.env[name]||String(fallback),10);return Number.isFinite(value)&&value>0?value:fallback;}
function retentionHours(){return positiveNumberEnv("GENERATED_ASSET_RETENTION_HOURS",DEFAULT_ASSET_RETENTION_HOURS);}
function generationTimeout(){return Math.max(10,positiveNumberEnv("IMAGE_GENERATION_TIMEOUT_SECONDS",120));}
function maxRetainedBytes(){return positiveIntEnv("GENERATED_ASSET_MAX_BYTES",DEFAULT_GENERATED_ASSET_MAX_BYTES);}
function renderDailyImageLimit(){return positiveIntEnv("RENDER_DAILY_IMAGE_LIMIT",DEFAULT_RENDER_DAILY_IMAGE_LIMIT);}
function renderMaxConcurrentJobs(){return positiveIntEnv("RENDER_MAX_CONCURRENT_JOBS",DEFAULT_RENDER_MAX_CONCURRENT_JOBS);}
function provider(){return normalize(process.env.IMAGE_GENERATION_PROVIDER||"openai")||"openai";}
function model(value=""){return compactText(value||process.env.IMAGE_GENERATION_MODEL||DEFAULT_IMAGE_MODEL,80);}
function safeSlug(value,fallback="asset"){return normalize(value).replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,72)||fallback;}
function publicBase(){return String(process.env.APP_BASE_URL||SITE.siteUrl||"").replace(/\/$/,"");}
function assetUrl(jobId,filename){const base=publicBase();const path=`/api/generated-assets?job_id=${encodeURIComponent(jobId)}&filename=${encodeURIComponent(filename)}`;return base?`${base}${path}`:path;}
function publicJob(job){return JSON.parse(JSON.stringify({...job,assets:(job.assets||[]).map((asset)=>({...asset,asset_url:assetUrl(job.job_id,asset.filename)}))}));}
function deleteJob(jobId){RENDER_JOBS.delete(jobId);for(const key of [...RENDER_ASSETS.keys()]){if(key.startsWith(`${jobId}/`))RENDER_ASSETS.delete(key);}}
function retainedBytes(){let total=0;for(const job of RENDER_JOBS.values())total+=Buffer.byteLength(JSON.stringify(job));for(const asset of RENDER_ASSETS.values())total+=asset.bytes.length;return total;}
function cleanupStorageQuota(){let total=retainedBytes();if(total<=maxRetainedBytes())return;const terminal=[...RENDER_JOBS.values()].filter((job)=>["succeeded","failed"].includes(job.status)).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));for(const job of terminal){const before=retainedBytes();deleteJob(job.job_id);total-=Math.max(0,before-retainedBytes());if(total<=maxRetainedBytes())break;}}
function cleanupExpired(){const now=Date.now();for(const [id,job] of [...RENDER_JOBS]){if(Date.parse(job.expires_at)<=now)deleteJob(id);}for(const [id,asset] of [...RENDER_ASSETS]){if(Date.parse(asset.expires_at)<=now)RENDER_ASSETS.delete(id);}cleanupStorageQuota();}
function envWarning(name,fallback){const raw=String(process.env[name]||"").trim();if(!raw)return"";const value=Number(raw);return Number.isFinite(value)&&value>0?"":`${name} is invalid; using default ${fallback}.`;}
function generationRuntimeSummary(){const p=provider();return{provider:p,model:model(),retention_hours:retentionHours(),storage:{backend:"single-instance-memory",cleanup:"render enqueue, status polling, and generated-asset requests",max_retained_bytes:maxRetainedBytes(),limitation:"Hatchable source export does not include a durable cross-worker storage adapter; use the Python deployment for 168-hour durable render storage."},abuse_controls:{max_concurrent_jobs:renderMaxConcurrentJobs(),daily_image_limit:renderDailyImageLimit()},openai_key_configured:p==="openai"&&Boolean(String(process.env.OPENAI_API_KEY||"").trim()),configuration_warnings:["GENERATED_ASSET_RETENTION_HOURS","IMAGE_GENERATION_TIMEOUT_SECONDS","GENERATED_ASSET_MAX_BYTES","RENDER_DAILY_IMAGE_LIMIT","RENDER_MAX_CONCURRENT_JOBS"].map((name)=>envWarning(name,{GENERATED_ASSET_RETENTION_HOURS:DEFAULT_ASSET_RETENTION_HOURS,IMAGE_GENERATION_TIMEOUT_SECONDS:120,GENERATED_ASSET_MAX_BYTES:DEFAULT_GENERATED_ASSET_MAX_BYTES,RENDER_DAILY_IMAGE_LIMIT:DEFAULT_RENDER_DAILY_IMAGE_LIMIT,RENDER_MAX_CONCURRENT_JOBS:DEFAULT_RENDER_MAX_CONCURRENT_JOBS}[name])).filter(Boolean)};}
export { generationRuntimeSummary };
function renderOptions(args={}){const size=String(args.size||"1024x1024"),quality=String(args.quality||"medium"),output_format=String(args.output_format||"png").toLowerCase(),background=String(args.background||"auto"),selectedModel=model(args.model);if(!SUPPORTED_RENDER_SIZES.has(size))throw new Error(`Unsupported render size: ${size}`);if(!SUPPORTED_RENDER_QUALITIES.has(quality))throw new Error(`Unsupported render quality: ${quality}`);if(!SUPPORTED_OUTPUT_FORMATS.has(output_format))throw new Error(`Unsupported output format: ${output_format}`);if(!SUPPORTED_BACKGROUNDS.has(background))throw new Error(`Unsupported background: ${background}`);if(background==="transparent"&&output_format==="jpeg")throw new Error("Transparent background requires PNG or WebP output.");if(background==="transparent"&&selectedModel==="gpt-image-2")throw new Error("Transparent background is not supported with gpt-image-2.");return{model:selectedModel,size,quality,output_format,background};}
function stringListPayload(value,limit,itemLimit){return Array.isArray(value)?value.map((x)=>compactText(x,itemLimit)).filter(Boolean).slice(0,limit):[];}
function briefPayload(value){if(!value||typeof value!=="object")return{};const out={};for(const [key,limit] of [["name",120],["sector",160],["promise",1000],["audience",400],["risk_tolerance",120]]){const text=compactText(value[key],limit);if(text)out[key]=text;}const traits=stringListPayload(value.traits,8,100),avoid=stringListPayload(value.must_avoid,8,100);if(traits.length)out.traits=traits;if(avoid.length)out.must_avoid=avoid;return out;}
function ensurePayloadSize(payload){if(Buffer.byteLength(JSON.stringify(payload))>MAX_RENDER_METADATA_BYTES)throw new Error("Render metadata exceeds the maximum persisted size.");return payload;}
function routePayload(args={}){const route=args.route&&typeof args.route==="object"?args.route:{};const prompt=compactText(args.concept_board_prompt||route.concept_board_prompt,32000);if(prompt.length<24)throw new Error("concept_board_prompt is required and must describe the board to render.");const focus=args.evaluation_focus||route.board_evaluation_focus||[];return{route_id:safeSlug(args.route_id||route.id||"custom","custom"),route_name:compactText(args.route_name||route.name||"Concept board",160),concept_board_prompt:prompt,evaluation_focus:stringListPayload(focus,6,220),brief:briefPayload(args.brief)};}
function workflowPayload(directions){const routes=(directions.routes||[]).map((route,index)=>({id:safeSlug(route.id||`route-${index+1}`,`route-${index+1}`),name:compactText(route.name||`Route ${index+1}`,160),concept_board_prompt:compactText(route.concept_board_prompt,32000),board_evaluation_focus:stringListPayload(route.board_evaluation_focus,6,220)}));if(routes.some((route)=>route.concept_board_prompt.length<24))throw new Error("Generated route is missing a renderable concept_board_prompt.");return{brief:briefPayload(directions.brief),directions:{routes}};}
function newJob(kind,options,payload){payload=ensurePayloadSize(payload);const created=new Date(),expires=new Date(created.getTime()+retentionHours()*3600000),job_id=`${kind==="workflow"?"workflow":"render"}-${randomUUID().replace(/-/g,"")}`;return{job_id,kind,status:"queued",created_at:created.toISOString(),updated_at:created.toISOString(),expires_at:expires.toISOString(),provider:provider(),options,progress:{completed:0,total:kind==="workflow"?3:1},input:payload,assets:[],evaluations:[],error:"",retention:{hours:retentionHours(),policy:"Generated job metadata and image assets are removed after the configured retention window."}};}
function jobRenderCost(job){return job.kind==="workflow"?Number(job.progress?.total||3):1;}
function enforceRenderAbuseControls(kind,providerName){if(providerName!=="openai")return;let active=0,daily=0;const start=new Date();start.setUTCHours(0,0,0,0);for(const job of RENDER_JOBS.values()){if(job.provider!=="openai")continue;if(["queued","running"].includes(job.status))active++;if(Date.parse(job.created_at)>=start.getTime())daily+=jobRenderCost(job);}const requested=kind==="workflow"?3:1;if(active>=renderMaxConcurrentJobs())throw new Error("Render concurrency limit reached; poll existing jobs before starting another paid render.");if(daily+requested>renderDailyImageLimit())throw new Error("Daily paid render quota reached for this deployment.");}
async function openaiRenderBytes(prompt,options){const apiKey=String(process.env.OPENAI_API_KEY||"").trim();if(!apiKey)throw new Error("OPENAI_API_KEY is required for IMAGE_GENERATION_PROVIDER=openai.");const controller=new AbortController(),timeoutMs=generationTimeout()*1000,timer=setTimeout(()=>controller.abort(),timeoutMs);let response;try{response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:options.model,prompt,n:1,size:options.size,quality:options.quality,output_format:options.output_format,background:options.background,moderation:"auto"}),signal:controller.signal});}catch(error){if(error?.name==="AbortError")throw new Error(`OpenAI image generation timed out after ${generationTimeout()} seconds.`);throw error;}finally{clearTimeout(timer);}const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`OpenAI image generation failed: ${compactText(data?.error?.message||response.statusText,500)}`);const b64=data?.data?.[0]?.b64_json;if(!b64)throw new Error("OpenAI image generation did not return base64 image data.");return Buffer.from(String(b64),"base64");}
async function renderBytes(prompt,options,providerName){if(providerName==="mock")return Buffer.from(MOCK_PNG,"base64");if(providerName!=="openai")throw new Error(`Unsupported image generation provider: ${providerName}`);return await openaiRenderBytes(prompt,options);}
function jpegDimensions(bytes){let offset=2;while(offset+9<bytes.length){if(bytes[offset]!==0xff){offset++;continue;}const marker=bytes[offset+1],length=bytes.readUInt16BE(offset+2);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&offset+8<bytes.length)return{width:bytes.readUInt16BE(offset+7),height:bytes.readUInt16BE(offset+5)};if(length<2)break;offset+=2+length;}return{width:null,height:null};}
function webpDimensions(bytes){if(bytes.length>=30&&bytes.toString("ascii",12,16)==="VP8X")return{width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};if(bytes.length>=25&&bytes.toString("ascii",12,16)==="VP8L"){const b0=bytes[21],b1=bytes[22],b2=bytes[23],b3=bytes[24];return{width:1+(((b1&0x3f)<<8)|b0),height:1+(((b3&0x0f)<<10)|(b2<<2)|((b1&0xc0)>>6))};}if(bytes.length>=30&&bytes.toString("ascii",12,15)==="VP8")return{width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff};return{width:null,height:null};}
function detectImageFormat(bytes){if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return{format:"png",extension:"png",mime_type:"image/png",...{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}};if(bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8)return{format:"jpeg",extension:"jpg",mime_type:"image/jpeg",...jpegDimensions(bytes)};if(bytes.length>=16&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return{format:"webp",extension:"webp",mime_type:"image/webp",...webpDimensions(bytes)};return{format:null,extension:null,mime_type:"application/octet-stream",width:null,height:null};}
function imageDimensions(bytes){const detected=detectImageFormat(bytes);return{width:detected.width,height:detected.height};}
function storeAsset(job,bytes,route){const detected=detectImageFormat(bytes),fallback=job.options.output_format==="jpeg"?{extension:"jpg",mime_type:"image/jpeg"}:{extension:job.options.output_format,mime_type:`image/${job.options.output_format}`},digest=createHash("sha256").update(bytes).digest("hex"),filename=`${digest.slice(0,24)}.${detected.extension||fallback.extension}`;const dims=imageDimensions(bytes),mime=detected.format?detected.mime_type:fallback.mime_type,asset={asset_id:digest.slice(0,16),route_id:route.route_id,route_name:route.route_name,filename,asset_url:assetUrl(job.job_id,filename),mime_type:mime,bytes:bytes.length,sha256:digest,width:dims.width,height:dims.height};RENDER_ASSETS.set(`${job.job_id}/${filename}`,{bytes,mime_type:mime,expires_at:job.expires_at});cleanupStorageQuota();return asset;}
async function evaluateAsset(asset,focus){try{const metrics=await imageMetrics({download_url:asset.asset_url,file_id:asset.asset_id,mime_type:asset.mime_type,file_name:asset.filename});return critiqueImageMetrics(metrics,null,(focus||[]).join(" | "));}catch(error){return{context:(focus||[]).join(" | "),score:null,grade:"unavailable",axes:{},technical_metrics:{},priority_actions:[`Evaluation unavailable: ${compactText(error?.message||String(error),220)}`],reference_comparison:null,method_note:"The generated asset was stored, but automatic Hatchable-side image metrics could not be completed in this runtime."};}}
async function runRenderJob(jobId){const job=RENDER_JOBS.get(jobId);if(!job)return;try{job.status="running";job.updated_at=nowIso();const route=job.input.route,bytes=await renderBytes(route.concept_board_prompt,job.options,job.provider),asset=storeAsset(job,bytes,route);job.assets=[asset];job.evaluations=[{route_id:route.route_id,asset_id:asset.asset_id,critique:await evaluateAsset(asset,route.evaluation_focus)}];job.progress={completed:1,total:1};job.provider_note=job.provider==="mock"?"mock provider for local validation; no external image API call was made":"OpenAI Images API generation request";job.status="succeeded";job.updated_at=nowIso();}catch(error){job.status="failed";job.error=`${error?.name||"Error"}: ${error?.message||String(error)}`;job.updated_at=nowIso();}}
async function runWorkflowJob(jobId){const job=RENDER_JOBS.get(jobId);if(!job)return;try{job.status="running";job.updated_at=nowIso();const routes=job.input.directions.routes||[];for(let i=0;i<routes.length;i++){const route={route_id:safeSlug(routes[i].id||`route-${i+1}`,`route-${i+1}`),route_name:compactText(routes[i].name||`Route ${i+1}`,160),concept_board_prompt:routes[i].concept_board_prompt,evaluation_focus:routes[i].board_evaluation_focus||[]},bytes=await renderBytes(route.concept_board_prompt,job.options,job.provider),asset=storeAsset(job,bytes,route);job.assets.push(asset);job.evaluations.push({route_id:route.route_id,asset_id:asset.asset_id,critique:await evaluateAsset(asset,route.evaluation_focus)});job.progress={completed:i+1,total:routes.length};job.updated_at=nowIso();}job.provider_note=job.provider==="mock"?"mock provider for local validation; no external image API call was made":"OpenAI Images API generation request";job.status="succeeded";job.updated_at=nowIso();}catch(error){job.status="failed";job.error=`${error?.name||"Error"}: ${error?.message||String(error)}`;job.updated_at=nowIso();}}
export async function renderBrandDirection(args={}){requireRendering();cleanupExpired();const options=renderOptions(args),route=routePayload(args),selectedProvider=provider();enforceRenderAbuseControls("render",selectedProvider);const job=newJob("render",options,{route});job.provider=selectedProvider;RENDER_JOBS.set(job.job_id,job);setTimeout(()=>{void runRenderJob(job.job_id);},0);return publicJob(job);}
export async function runBrandWorkflow(args={}){requireRendering();cleanupExpired();const options=renderOptions(args),directions=await generateDirections(args),selectedProvider=provider();enforceRenderAbuseControls("workflow",selectedProvider);const job=newJob("workflow",options,workflowPayload(directions));job.provider=selectedProvider;RENDER_JOBS.set(job.job_id,job);setTimeout(()=>{void runWorkflowJob(job.job_id);},0);return publicJob(job);}
export function getRenderJob(jobId){cleanupExpired();const job=RENDER_JOBS.get(String(jobId||""));if(!job)throw new Error("Render job not found.");return publicJob(job);}
export function getGeneratedAsset(jobId,filename){cleanupExpired();const asset=RENDER_ASSETS.get(`${jobId}/${filename}`);if(!asset)throw new Error("Generated asset not found.");return asset;}
// BEGIN_PUBLIC_IMAGE_INPUTS — retained by the public bundle builder.
const TRUSTED_IMAGE_HOSTS = new Set(['files.openai.com', 'cdn.openai.com', 'chatgpt.com', 'oaiusercontent.blob.core.windows.net', 'oaidalleapiprodscus.blob.core.windows.net']);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
function validateImageInput(file) {
  if (!file?.download_url || !file?.file_id) throw new Error('File values must include download_url and file_id.');
  if (file.mime_type && !ALLOWED_IMAGE_MIME_TYPES.has(String(file.mime_type).toLowerCase())) throw new Error('Type de fichier image non pris en charge.');
  let url;
  try { url = new URL(file.download_url); } catch { throw new Error('URL HTTPS de fichier invalide.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Seules les URL HTTPS de fichiers autorisés, sans identifiants ni port alternatif, sont acceptées.');
  const host = url.hostname.toLowerCase();
  if (!TRUSTED_IMAGE_HOSTS.has(host) && host !== 'oaiusercontent.com' && !host.endsWith('.oaiusercontent.com')) throw new Error('Hôte de fichier non autorisé. Joindre ou sélectionner cette image dans ChatGPT.');
  return url.toString();
}
function rasterMime(bytes) {
  const starts = signature => signature.every((byte, i) => bytes[i] === byte);
  if (starts([137,80,78,71,13,10,26,10])) return 'image/png';
  if (starts([255,216,255])) return 'image/jpeg';
  if (starts([71,73,70,56,55,97]) || starts([71,73,70,56,57,97])) return 'image/gif';
  if (starts([82,73,70,70]) && bytes[8]===87 && bytes[9]===69 && bytes[10]===66 && bytes[11]===80) return 'image/webp';
  throw new Error('Signature de fichier non reconnue : image raster requise.');
}
function validateRasterDimensions(bytes, mime) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let width=0,height=0;
  if(mime==='image/png' && bytes.length>=24){width=view.getUint32(16);height=view.getUint32(20);}
  if(mime==='image/gif' && bytes.length>=10){width=view.getUint16(6,true);height=view.getUint16(8,true);}
  if(mime==='image/jpeg'){
    let offset=2;
    while(offset+3<bytes.length){
      if(bytes[offset++]!==255)continue;
      while(bytes[offset]===255)offset++;
      const marker=bytes[offset++];
      if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      if(offset+2>bytes.length)break;
      const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}
      offset+=length;
    }
  }
  if(mime==='image/webp' && bytes.length>=25){
    const kind=String.fromCharCode(...bytes.subarray(12,16));
    if(kind==='VP8X'&&bytes.length>=30){width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
    else if(kind==='VP8L'&&bytes[20]===47){width=1+bytes[21]+((bytes[22]&63)<<8);height=1+((bytes[22]&192)>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10);}
    else if(kind==='VP8 '&&bytes.length>=30&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=view.getUint16(26,true)&16383;height=view.getUint16(28,true)&16383;}
  }
  if(!width||!height)throw new Error('En-tête ou dimensions de l’image illisibles.');
  if(width>8192||height>8192||width*height>50000000)throw new Error('Les dimensions de l’image dépassent la limite de traitement.');
  return {width,height};
}
export async function fetchImageBytes(file, fetcher = globalThis.fetch) {
  let url = validateImageInput(file);
  const controller = new AbortController();
  let timer;
  const work = async () => {
    for (let redirects = 0; redirects <= 4; redirects++) {
      let response;
      try { response = await fetcher(url, { redirect:'manual', credentials:'omit', headers:{Accept:'image/png,image/jpeg,image/webp,image/gif'}, signal:controller.signal }); }
      catch { throw new Error('Téléchargement du fichier impossible; sélectionner à nouveau le fichier pour renouveler son accès.'); }
      if ([301,302,303,307,308].includes(response.status)) {
        const location=response.headers.get('location');
        if (!location) throw new Error('Redirection du fichier sans destination.');
        url=validateImageInput({...file,download_url:new URL(location,url).toString()});
        continue;
      }
      if (response.status < 200 || response.status >= 300) throw new Error(`Téléchargement du fichier refusé (HTTP ${response.status}). Sélectionner à nouveau le fichier.`);
      const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      if (type && type !== 'application/octet-stream' && !ALLOWED_IMAGE_MIME_TYPES.has(type)) throw new Error('Le fichier téléchargé n’est pas une image raster prise en charge.');
      const declared=Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) throw new Error('L’image dépasse la limite de traitement de 12 Mo.');
      let bytes;
      if (response.body?.getReader) {
        const reader=response.body.getReader(), chunks=[]; let total=0;
        try { for (;;) { const part=await reader.read(); if(part.done)break; total+=part.value.length; if(total>MAX_IMAGE_BYTES)throw new Error('L’image dépasse la limite de traitement de 12 Mo.'); chunks.push(part.value); } }
        finally { await reader.cancel().catch(()=>{}); }
        bytes=new Uint8Array(total); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      } else {
        // Hatchable's fetch buffers upstream; this is a processing cap, not a streaming transport guarantee.
        bytes=new Uint8Array(await response.arrayBuffer());
        if(bytes.length>MAX_IMAGE_BYTES)throw new Error('L’image dépasse la limite de traitement de 12 Mo.');
      }
      const mimeType=rasterMime(bytes);
      if(type && type !== 'application/octet-stream' && type!==mimeType)throw new Error('Le type MIME ne correspond pas à la signature de l’image.');
      const dimensions=validateRasterDimensions(bytes,mimeType);
      return {bytes,mimeType,...dimensions};
    }
    throw new Error('Le fichier comporte trop de redirections.');
  };
  try { return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Le téléchargement de l’image a dépassé 20 secondes.'));},20000);})]); }
  finally { clearTimeout(timer); }
}
function imageDataUrl({bytes,mimeType}) {
  let binary='';for(let start=0;start<bytes.length;start+=16384)binary+=String.fromCharCode(...bytes.subarray(start,start+16384));
  return `data:${mimeType};base64,${btoa(binary)}`;
}
export async function imageMetrics(file) {
  const dataUrl=imageDataUrl(await fetchImageBytes(file));
  const { browser } = await import("hatchable");
  return await browser.session(async (page)=>{
    // Managed browser sessions already start on a blank page; no external navigation.
    return await page.evaluate(async (dataUrl)=>{
      const img=new Image();img.src=dataUrl;
      try{await img.decode();}catch{throw new Error('Le fichier téléchargé n’est pas une image lisible.');}
      const width=img.naturalWidth||img.width, height=img.naturalHeight||img.height; if(!width||!height) throw new Error('Le fichier téléchargé n’est pas une image lisible.'); if(width>8192||height>8192||width*height>50000000) throw new Error('Les dimensions de l’image dépassent la limite de traitement.');
      const flattened=document.createElement('canvas');flattened.width=width;flattened.height=height;const flat=flattened.getContext('2d',{alpha:false});flat.fillStyle='#ffffff';flat.fillRect(0,0,width,height);flat.drawImage(img,0,0);
      const sample=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(flattened,0,0,w,h);const d=x.getImageData(0,0,w,h).data;const gray=new Float64Array(w*h);for(let i=0,p=0;i<d.length;i+=4,p++)gray[p]=(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])/255;return{gray,data:d,w,h};};
      const mean=(a)=>{let s=0;for(const v of a)s+=v;return s/a.length;};
      const median=(a)=>{const b=Array.from(a).sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
      const makeMask=(gray)=>{const t=median(gray), dark=new Uint8Array(gray.length), light=new Uint8Array(gray.length);let dc=0,lc=0;for(let i=0;i<gray.length;i++){if(gray[i]<t){dark[i]=1;dc++;}if(gray[i]>t){light[i]=1;lc++;}}let out=dc<=lc?dark:light, occ=Math.min(dc,lc)/gray.length;if(occ<.02||occ>.98){out=new Uint8Array(gray.length);const m=mean(gray);for(let i=0;i<gray.length;i++)out[i]=gray[i]<m?1:0;}return out;};
      const main=sample(256,256), small=sample(32,32), mask=makeMask(main.gray), maskSmall=makeMask(small.gray); let inter=0,union=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const a=mask[y*256+x],b=maskSmall[Math.floor(y/8)*32+Math.floor(x/8)];if(a&&b)inter++;if(a||b)union++;}
      let occupancy=0,sx=0,sy=0,count=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const v=mask[y*256+x];occupancy+=v;if(v){sx+=x;sy+=y;count++;}}occupancy/=mask.length;const cx=count?sx/count/255:.5,cy=count?sy/count/255:.5;
      const edge=new Float64Array(main.gray.length);let edgeCount=0,energy=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=y*256+x,gx=Math.abs(main.gray[i]-main.gray[y*256+Math.max(0,x-1)]),gy=Math.abs(main.gray[i]-main.gray[Math.max(0,y-1)*256+x]),v=Math.min(1,gx+gy);edge[i]=v;energy+=v;if(v>.12)edgeCount++;}
      const avg=mean(main.gray);let variance=0;for(const v of main.gray)variance+=(v-avg)*(v-avg);const contrast=Math.sqrt(variance/main.gray.length);
      const bins=new Float64Array(32);for(const v of main.gray)bins[Math.min(31,Math.floor(v*32))]++;let entropy=0;for(const c of bins){if(c){const p=c/main.gray.length;entropy-=p*Math.log2(p);}}entropy/=5;
      const cells=[];for(let cyi=0;cyi<16;cyi++)for(let cxi=0;cxi<16;cxi++){let s=0;for(let yy=0;yy<16;yy++)for(let xx=0;xx<16;xx++)s+=edge[(cyi*16+yy)*256+(cxi*16+xx)];cells.push(s/256);}cells.sort((a,b)=>b-a);const top=Math.max(1,Math.floor(cells.length/5)),saliency=cells.slice(0,top).reduce((a,b)=>a+b,0)/(cells.reduce((a,b)=>a+b,0)||1);
      const quadrants=[0,0,0,0],qcount=[0,0,0,0];for(let y=0;y<256;y++)for(let x=0;x<256;x++){const q=(y>=128?2:0)+(x>=128?1:0);quadrants[q]+=mask[y*256+x];qcount[q]++;}for(let i=0;i<4;i++)quadrants[i]/=qcount[i];const qm=quadrants.reduce((a,b)=>a+b,0)/4,qsd=Math.sqrt(quadrants.reduce((a,b)=>a+(b-qm)*(b-qm),0)/4),balance=1-Math.min(qsd*3.2,1);
      const hashSample=sample(16,16).gray,hm=mean(hashSample),average_hash=Array.from(hashSample,(v)=>v>=hm?1:0);const dhSample=sample(17,16).gray,difference_hash=[];for(let y=0;y<16;y++)for(let x=0;x<16;x++)difference_hash.push(dhSample[y*17+x+1]>=dhSample[y*17+x]?1:0);
      const histSample=sample(96,96).data,hist=new Float64Array(24);for(let i=0;i<histSample.length;i+=4){hist[Math.min(7,Math.floor(histSample[i]/32))]++;hist[8+Math.min(7,Math.floor(histSample[i+1]/32))]++;hist[16+Math.min(7,Math.floor(histSample[i+2]/32))]++;}let hs=0;for(const v of hist)hs+=v;const colour_histogram=Array.from(hist,(v)=>Math.round(v/hs*1e6)/1e6);
      const r=(v)=>Math.round(v*10000)/10000;return{width,height,alpha_background:'#ffffff',aspect_ratio:r(width/Math.max(height,1)),contrast:r(contrast),edge_density:r(edgeCount/edge.length),entropy:r(entropy),foreground_occupancy:r(occupancy),centroid:{x:r(cx),y:r(cy)},balance:r(balance),small_size_stability:r(inter/(union||1)),saliency_concentration:r(saliency),average_hash,difference_hash,colour_histogram};
    },dataUrl);
  });
}
function clampScore(v){return Math.max(0,Math.min(20,v));}
function hamming(a,b){let diff=0;for(let i=0;i<Math.min(a.length,b.length);i++)if(Boolean(a[i])!==Boolean(b[i]))diff++;return 1-diff/Math.max(1,Math.min(a.length,b.length));}
function cosine(a,b){let dot=0,aa=0,bb=0;for(let i=0;i<Math.min(a.length,b.length);i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
export function compareImageMetrics(lm,rm){const ah=hamming(lm.average_hash,rm.average_hash),dh=hamming(lm.difference_hash,rm.difference_hash),colour=Math.max(0,Math.min(1,cosine(lm.colour_histogram,rm.colour_histogram))),occupancy=1-Math.min(Math.abs(lm.foreground_occupancy-rm.foreground_occupancy)/.65,1),centroid=1-Math.min(Math.hypot(lm.centroid.x-rm.centroid.x,lm.centroid.y-rm.centroid.y)/.7,1),edge=1-Math.min(Math.abs(lm.edge_density-rm.edge_density)/.45,1),stability=1-Math.min(Math.abs(lm.small_size_stability-rm.small_size_stability)/.8,1);const components={silhouette_hash:Math.round(1000*ah)/10,edge_hash:Math.round(1000*dh)/10,colour_distribution:Math.round(1000*colour)/10,mass_occupancy:Math.round(1000*occupancy)/10,composition_centroid:Math.round(1000*centroid)/10,edge_density:Math.round(1000*edge)/10,small_size_behaviour:Math.round(1000*stability)/10};const risk=Math.round(1000*(.26*ah+.18*dh+.10*colour+.14*occupancy+.12*centroid+.10*edge+.10*stability))/10,band=risk>=82?'très élevé':risk>=68?'élevé':risk>=52?'accru':risk>=35?'modéré':'faible',strongest=Object.entries(components).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([dimension,score])=>({dimension,score})),transformations=[];if(ah>=.70)transformations.push('Changer le contour extérieur, l’axe et les terminaisons jusqu’à ce que la silhouette diverge sous les tests de flou et de monochrome.');if(dh>=.70||edge>=.75)transformations.push('Reconstruire la topologie interne et l’espace négatif; ne pas conserver les mêmes ouvertures, découpes ou rythmes directionnels.');if(colour>=.82)transformations.push('Tester un comportement chromatique structurellement différent et valider le dessin en monochrome afin que la couleur ne soit pas la seule distinction.');if(centroid>=.82&&occupancy>=.82)transformations.push('Changer la composition, le rapport d’aspect, les relations d’échelle et le placement des masses plutôt que de simplement redessiner les détails.');if(!transformations.length)transformations.push('Continuer de documenter une dérivation indépendante et effectuer malgré tout une recherche professionnelle de marques et de risque de confusion avant le lancement.');return{risk_score:risk,risk_band:band,components,strongest_convergences:strongest,recommended_transformations:transformations,legal_note:'Il s’agit d’un triage perceptuel, non d’une autorisation de marque ni d’un avis juridique. Le risque de similarité dépend aussi du secteur, du territoire, du public, du contexte d’usage et des droits protégés.'};}
export function critiqueImageMetrics(m,referenceComparison=null,context=''){const occupancy=m.foreground_occupancy,centroidDistance=Math.hypot(m.centroid.x-.5,m.centroid.y-.5),composition=clampScore(20*(.42*m.balance+.28*(1-Math.min(centroidDistance/.55,1))+.30*(1-Math.min(Math.abs(occupancy-.38)/.5,1)))),hierarchy=clampScore(20*(.60*Math.min(m.saliency_concentration/.55,1)+.40*(1-Math.min(Math.abs(m.edge_density-.18)/.35,1)))),legibility=clampScore(20*(.55*Math.min(m.contrast/.30,1)+.45*m.small_size_stability)),complexityFit=1-Math.min(Math.abs(m.edge_density-.16)/.32,1),memorability=clampScore(20*(.45*complexityFit+.30*Math.min(m.entropy/.78,1)+.25*Math.min(m.saliency_concentration/.55,1)));let differentiation,diffConfidence;if(referenceComparison){differentiation=clampScore(20*(1-referenceComparison.risk_score/100));diffConfidence='heuristique; limitée à la référence fournie';}else{differentiation=null;diffConfidence='non évaluable; aucune référence fournie';}const round1=(v)=>Math.round(v*10)/10,axes={beaux_arts:{label:'Beaux-arts / composition',score:round1(composition)},hierarchy:{label:'Hiérarchie visuelle',score:round1(hierarchy)},legibility:{label:'Lisibilité et réduction',score:round1(legibility)},memorability:{label:'Complexité et saillance (proxy)',score:round1(memorability),basis:'heuristic',measurement_note:'Indice calculé à partir de complexité, entropie et saillance; aucune mémorisation observée.'},differentiation:{label:'Différenciation (référence uniquement)',score:differentiation===null?null:round1(differentiation),status:referenceComparison?'heuristic':'non_evaluable',confidence:diffConfidence,measurement_note:referenceComparison?'Écart perceptuel à la seule référence fournie; aucune mesure d’originalité concurrentielle.':'Aucune référence ni corpus comparatif : aucune note ni conclusion de différenciation.'}},scoredAxes=Object.entries(axes).filter(([,axis])=>Number.isFinite(axis.score)),scoreMax=scoredAxes.length*20,total=round1(scoredAxes.reduce((sum,[,axis])=>sum+axis.score,0)),weaknesses=[...scoredAxes].sort((a,b)=>a[1].score-b[1].score).slice(0,2),mapping={beaux_arts:'Reconstruire en noir et blanc avec une masse dominante, une contreforme et un centre visuel délibéré.',hierarchy:'Créer trois variantes qui changent volontairement le premier point d’attention; tester en vignette et à deux mètres.',legibility:'Retirer les détails qui s’effondrent à 24 px, puis vérifier les versions monochrome, floutée, gravée et inversée.',memorability:'Réduire l’idée à un contour redessinable après deux secondes d’exposition; conserver une seule anomalie contrôlée.',differentiation:'Changer la silhouette, la topologie, la typographie, le comportement chromatique et la composition — pas seulement le style de surface.'};const technical_metrics={...m};delete technical_metrics.average_hash;delete technical_metrics.difference_hash;delete technical_metrics.colour_histogram;return{context:compactText(context,500),score:total,score_max:scoreMax,excluded_axes:Object.keys(axes).filter(key=>axes[key].score===null),priority_axes:weaknesses.map(([key])=>key),score_kind:'heuristic_proxy',score_label:scoreMax===100?'Indice technique heuristique':'Sous-total technique — axes évaluables seulement',evaluations:untestedEvaluations(),grade:scoreMax===100?(total>=86?'A':total>=72?'B':total>=58?'C':'D'):null,axes,technical_metrics,priority_actions:weaknesses.map(([key])=>mapping[key]),reference_comparison:referenceComparison,method_note:'Le sous-total porte uniquement sur les axes évaluables et son maximum est explicite; ne pas comparer des totaux de couvertures différentes. Les axes sont des proxies heuristiques. Ils ne mesurent ni beauté, ni mémorisation, ni compréhension réelle. Les évaluations humaines restent non testées sans essai; ces indices ne remplacent ni le jugement humain, ni la recherche de marques, ni l’examen juridique.'};}
const EXERCISE_NUMBERS = {
  un: 1, une: 1, one: 1, single: 1, deux: 2, two: 2, trois: 3, three: 3,
  quatre: 4, four: 4, cinq: 5, five: 5, six: 6, sept: 7, seven: 7,
  huit: 8, eight: 8, neuf: 9, nine: 9, dix: 10, ten: 10, onze: 11,
  eleven: 11, douze: 12, twelve: 12
};
function normalizeExerciseTime(text) {
  return text.replace(/(?<![\w.,])(\d{1,3})\s*(?:heures?|hours?|h)\s*(\d{1,2})(?:\s*(?:minutes?|mins?))?\b/gi,
    (all, hours, minutes) => Number(minutes) < 60 ? `${Number(hours)*60+Number(minutes)} minutes` : all)
    .replace(/(?<![\w.,])(\d{1,3}[.,]\d{1,2})\s*(?:heures?|hours?|h)\b/gi,
    (all, hours) => { const minutes=Number(hours.replace(',','.'))*60; return Number.isInteger(Math.round(minutes*100000)/100000) ? `${Math.round(minutes)} minutes` : all; });
}
function exerciseConstraints(question, goal, context) {
  // Conservative FR/EN extraction: negative examples, conflicts and ranges
  // must never be silently converted into an invented exact constraint.
  const texts = [question, goal, context.task || '', context.final_size || ''].map(normalizeExerciseTime);
  const number = String.raw`(?:\d{1,4}|${Object.keys(EXERCISE_NUMBERS).join('|')})`;
  const variantsRe = new RegExp(String.raw`(?<![\w.,])(${number})\s+(?:variantes?|variants?|versions?|prototypes?|vignettes?|routes?)\b`, 'gi');
  const minutesRe = new RegExp(String.raw`(?<![\w.,])(${number})\s*(minutes?|mins?|heures?|hours?|h)\b`, 'gi');
  const sizesRe = /(?<![\w.,])\d+(?:\s*(?:,|\/|\bet\b|\band\b)\s*\d+)*\s*(?:px|pixels?)\b/gi;
  const counts = new Set(), durations = new Set(), sizes = new Set(), unresolved = [];
  const negative = (text, start) => {
    const clause = text.slice(0, start).split(/[.!?;\n]|\b(?:mais|but|rather|plutôt|seulement|only|exactement|exactly)\b/i).at(-1);
    return /\b(?:pas|ni|sans|no|not|without|exclude|excluding|exclure|éviter|eviter|interdit)\b/i.test(clause);
  };
  const constrainedRange = (text, start) => {
    const prefix = text.slice(0, start);
    return new RegExp(String.raw`(?:${number})\s*(?:[-–—]|à|to|ou|or)\s*$`, 'i').test(prefix)
      || /\b(?:au plus|au moins|maximum|minimum|at most|at least|up to)\s*$/i.test(prefix);
  };
  const value = token => /^\d+$/.test(token) ? Number(token) : EXERCISE_NUMBERS[token.toLowerCase()];
  for (const text of texts) {
    for (const [pattern, found, maximum] of [[variantsRe, counts, 24], [minutesRe, durations, 1440]]) {
      for (const match of text.matchAll(pattern)) {
        if (negative(text, match.index)) continue;
        if (constrainedRange(text, match.index)) { unresolved.push(match[0]); continue; }
        let parsed = value(match[1]);
        if (pattern === minutesRe && ['h', 'heure', 'heures', 'hour', 'hours'].includes(match[2].toLowerCase())) parsed *= 60;
        if (parsed >= 1 && parsed <= maximum) found.add(parsed); else unresolved.push(match[0]);
      }
    }
    for (const match of text.matchAll(sizesRe)) {
      if (negative(text, match.index)) continue;
      if (constrainedRange(text, match.index)) { unresolved.push(match[0]); continue; }
      if (/\d\s*[×x*]\s*$/i.test(text.slice(0, match.index))) continue;
      for (const raw of match[0].match(/\d+/g)) {
        const parsed = Number(raw);
        if (parsed >= 1 && parsed <= 4096) sizes.add(parsed); else unresolved.push(match[0]);
      }
    }
  }
  const ambiguous = counts.size > 1 || durations.size > 1 || unresolved.length > 0;
  return {
    variant_count: counts.size === 1 && !ambiguous ? [...counts][0] : null,
    duration_minutes: durations.size === 1 && !ambiguous ? [...durations][0] : null,
    sizes_px: [...sizes].sort((a, b) => a - b),
    constraint_status: ambiguous ? 'ambiguous' : counts.size || durations.size || sizes.size ? 'declared' : 'unspecified',
    unresolved_constraints: [...new Set(unresolved)],
    constraint_note: 'Extraction explicite de nombres et unités, pas une interprétation exhaustive du langage. Les contraintes contradictoires ou non prises en charge ne sont pas remplacées par des valeurs par défaut.'
  };
}
export function coachDecision(question, critique = null, goal = 'improve the next iteration', designContext = null) {
  const designWorkflow = buildDesignWorkflow(designContext);
  const constraints = exerciseConstraints(String(question), String(goal), designWorkflow.brief);
  question = String(question).trim(); goal = String(goal).trim();
  const axes = critique && typeof critique === 'object' && critique.axes && typeof critique.axes==='object' && !Array.isArray(critique.axes) ? critique.axes : {};
  const known = new Set(['beaux_arts', 'hierarchy', 'legibility', 'memorability', 'differentiation']);
  const ranked = Object.entries(axes).filter(([key, axis]) => known.has(key) && axis && Number.isFinite(axis.score) && axis.score>=0 && axis.score<=20
    && !['non_evaluable', 'non_testé', 'indéterminé'].includes(axis.status)).sort((a, b) => a[1].score - b[1].score).slice(0, 2);
  const focus = ranked.map(([key, axis]) => typeof axis.label==='string' && axis.label.trim() ? compactText(axis.label,100) : key).join(' et ') || 'la décision formulée';
  let diagnosis = `Isoler ${focus}, conserver le contenu constant et respecter les contraintes déclarées. Aucune mesure auprès du public n’est inférée.`;
  const count = constraints.variant_count, duration = constraints.duration_minutes, sizes = constraints.sizes_px;
  const variantStep = count !== null ? `Produire exactement ${count} variantes à contenu constant; ne faire varier que la décision étudiée.` : 'Fixer le nombre de variantes avant production; aucune quantité n’est présumée.';
  const sizeText = sizes.map(size => `${size} px`).join(', ');
  const inspectStep = sizes.length ? `Inspecter chaque variante à ${sizeText}, à 100 % sur le fond d’usage; consigner les écarts.` : 'Fixer les tailles d’usage avant inspection; aucune taille n’est présumée.';
  let steps = [
    `Formuler une hypothèse sur ${focus}; conserver les textes exacts et fixer les critères avant comparaison.`,
    variantStep, inspectStep,
    'Comparer les observations et consigner la décision. Séparer inspection technique, reconnaissance, compréhension et préférence; garder les essais non réalisés en non_testé.'
  ];
  if (constraints.constraint_status === 'ambiguous') {
    diagnosis = 'Contraintes numériques contradictoires ou non prises en charge : clarification requise avant de fixer un protocole chiffré.';
    steps = ['Clarifier les nombres, durées ou plages déclarés sans choisir arbitrairement l’une des valeurs.'];
  }
  let schedule = [];
  if (duration !== null) {
    const units = duration * 100, allocations = [15, 45, 30].map(weight => Math.floor(units * weight / 100));
    allocations.push(units - allocations.reduce((sum, amount) => sum + amount, 0));
    schedule = allocations.map((amount, index) => ({ minutes: amount / 100, task: steps[index] }));
  }
  const acceptance = sizes.map(size => `À ${size} px, inspecter chaque variante sur le fond d’usage : seuil proposé de 0 caractère requis remplacé ou rogné; consigner séparément les erreurs de lecture observées. Non testé.`);
  acceptance.push('Critères proposés pour ce projet, non normes universelles : contenu constant, écarts documentés et aucune conclusion de reconnaissance, compréhension ou de préférence sans essai correspondant.');
  if (count !== null) acceptance.push(`Comparer exactement ${count} variantes, sans en ajouter pour satisfaire un gabarit.`);
  if (duration !== null) acceptance.push(`La somme des étapes planifiées est exactement ${duration} minutes; ce budget ne prouve pas que les essais ont été exécutés.`);
  return {
    question, goal, design_workflow: designWorkflow,
    critique_scope: 'Les axes éventuels sont des repères heuristiques; ils ne constituent pas des preuves de reconnaissance, de compréhension ou de préférence.',
    diagnosis,
    why: 'Une comparaison à contenu constant peut isoler la décision; sa validité dépend des observations réelles, pas du nombre d’adjectifs ni d’un gabarit fixe.',
    exercise: { ...constraints, duration: duration !== null ? `${duration} minutes` : 'À définir', steps, schedule },
    acceptance_criteria: acceptance,
    coach_rule: 'Défendre la décision avec des observations documentées. Une bibliographie, un indice ou un protocole proposé ne remplace pas un essai réalisé.'
  };
}
export async function executeTool(name,args={}){
  if(name==='open_brand_atlas'){
    const options={region:args.region||'',pattern:args.pattern||'',category:args.category||'',era:args.era||'',limit:args.limit??12};
    const [summary,search]=await Promise.all([atlasSummary(),searchAtlas(args.query||'',options)]);
    return{view:'atlas',data:{summary,...search}};
  }
  if(name==='get_brand_case'){
    const c=await getBrandCase(String(args.item_id||''));
    if(!c)throw new Error('Unknown atlas identity. Search the atlas first and use a returned ID.');
    return{view:'case',data:c};
  }
  if(name==='compare_brand_systems')return{view:'comparison',data:await compareBrandSystems(args.item_ids||[])};
  if(name==='explore_brand_graph')return{view:'graph',data:await exploreGraph(args.query||'',args.limit??80)};
  if(name==='search_design_systems')return{view:'library',data:await searchDesignSystems(args.query||'',args.kind||'',args.limit??12)};
  if(name==='generate_brand_directions')return{view:'directions',data:await generateDirections(args)};
  if(name==='render_brand_direction')return{view:'render_job',data:await renderBrandDirection(args)};
  if(name==='run_brand_workflow')return{view:'render_workflow',data:await runBrandWorkflow(args)};
  if(name==='get_render_job')return{view:'render_job',data:getRenderJob(args.job_id)};
  if(name==='critique_brand_image'){
    const image=await imageMetrics(args.image),reference=args.reference?await imageMetrics(args.reference):null,comparison=reference?compareImageMetrics(image,reference):null;
    return{view:'critique',data:critiqueImageMetrics(image,comparison,args.context||'')};
  }
  if(name==='compare_brand_images'){
    const left=await imageMetrics(args.left),right=await imageMetrics(args.right);
    return{view:'similarity',data:compareImageMetrics(left,right)};
  }
  if(name==='coach_brand_decision')return{view:'coach',data:coachDecision(args.question||'',args.critique,args.goal||'improve the next iteration',args.design_context)};
  throw new Error(`Unknown tool: ${name}`);
}
