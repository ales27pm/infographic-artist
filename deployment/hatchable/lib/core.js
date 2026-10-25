import { browser } from "hatchable";
import { resolveRequest, requestRoutes, directAdvice, VARIANT_COUNT_PATTERN, quantityValue } from 'lib/request-policy.js';
import { validateSchema } from 'lib/schema.js';
import { TOOLS } from 'lib/contract.js';
import { loadAtlas, loadLibrary, loadGraph } from "lib/data.js";
import { generationHandoff } from "lib/runtime.js";
import { buildDesignWorkflow, searchPrinciples, untestedEvaluations } from "lib/design-workflow.js";

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
 const schema = TOOLS.find(t=>t.name==='generate_brand_directions').inputSchema;
 const invalid=validateSchema(schema,brief);if(invalid)throw new Error(invalid);
 const context=brief.design_context??{};
 if(![brief.request,brief.promise,context.task,context.message].some(v=>typeof v==='string'&&v.trim()))throw new Error('Input validation: provide the current request, a task, or a purpose; a brand identity is not required.');
 const resolution=resolveRequest(brief),workflow=buildDesignWorkflow(context,brief,resolution.workflow_depth),routes=requestRoutes(brief,resolution,ROUTE_ARCHETYPES);
 const result={brief:{...brief,name:brief.name||'',sector:brief.sector||'',promise:brief.promise||'',audience:context.audience||brief.audience||''},routes,intent_resolution:resolution,design_workflow:workflow,image_generation_handoff:{...generationHandoff(),ready:routes.length>0},decision_rule:resolution.clarifications.length?resolution.clarifications.join(' '):routes.length===1?'Réaliser uniquement la demande actuelle en conservant les décisions approuvées.':routes.length?`Comparer uniquement les ${routes.length} pistes demandées, à contenu et éléments verrouillés constants.`:'Répondre à la demande sans démarrer de création d’image.'};
 if(resolution.mode==='advice')Object.assign(result,directAdvice(brief.request||context.task||''));
 return result;
}
// BEGIN_PUBLIC_IMAGE_INPUTS — retained by the public bundle builder.
const TRUSTED_IMAGE_HOSTS = new Set(['files.openai.com', 'cdn.openai.com', 'chatgpt.com', 'oaiusercontent.blob.core.windows.net', 'oaidalleapiprodscus.blob.core.windows.net', 'oaisdmntprcentralus.blob.core.windows.net']);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
function validateImageInput(file) {
  if (!file?.download_url || !file?.file_id) throw new Error('File values must include download_url and file_id.');
  if (file.mime_type && !ALLOWED_IMAGE_MIME_TYPES.has(String(file.mime_type).toLowerCase())) throw new Error('Type de fichier image non pris en charge.');
  let url;
  try { url = new URL(file.download_url); } catch { throw new Error('URL HTTPS de fichier invalide.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Seules les URL HTTPS de fichiers autorisés, sans identifiants ni port alternatif, sont acceptées.');
  const host = url.hostname.toLowerCase();
  if (!TRUSTED_IMAGE_HOSTS.has(host) && host !== 'oaiusercontent.com' && !host.endsWith('.oaiusercontent.com')) throw new Error(`Hôte de fichier non autorisé (${host}). Joindre ou sélectionner cette image dans ChatGPT.`);
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
  const variantsRe = new RegExp(VARIANT_COUNT_PATTERN, 'gi');
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
        let parsed = pattern===variantsRe?quantityValue(match[1]):value(match[1]);
        if(parsed===null){unresolved.push(match[0]);continue;}
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
function exerciseCoachDecision(question, critique = null, goal = 'improve the next iteration', designContext = null) {
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
  if(name==='critique_brand_image'){
    const image=await imageMetrics(args.image),reference=args.reference?await imageMetrics(args.reference):null,comparison=reference?compareImageMetrics(image,reference):null;
    return{view:'critique',data:critiqueImageMetrics(image,comparison,args.context||'')};
  }
  if(name==='compare_brand_images'){
    const left=await imageMetrics(args.left),right=await imageMetrics(args.right);
    return{view:'similarity',data:compareImageMetrics(left,right)};
  }
  if(name==='coach_brand_decision')return{view:'coach',data:coachDecision(args.question||'',args.critique,args.goal||'improve the next iteration',args.design_context,args.execution)};
  throw new Error(`Unknown tool: ${name}`);
}

export function coachDecision(question, critique=null, goal='improve the next iteration', designContext=null, execution=null){
 const resolution=resolveRequest({question,design_context:designContext??{},execution:execution??{}},{coaching:true});
 const workflow=buildDesignWorkflow(designContext,null,resolution.workflow_depth);
 if(resolution.status==='resolved'&&['exercise','plan'].includes(resolution.mode)){
  const effectiveQuestion=execution?.variant_count!==undefined?`${question}\nExactement ${execution.variant_count} variantes.`:question;
  const result=exerciseCoachDecision(effectiveQuestion,critique,goal,designContext);result.question=question;
  Object.assign(result,{mode:resolution.mode,intent_resolution:resolution,design_workflow:workflow});
  if(resolution.mode==='plan')Object.assign(result.exercise,{steps:[],schedule:[]});
  return result;
 }
 const advice=directAdvice(String(question));
 if(resolution.status!=='resolved')Object.assign(advice,{answer:null,requires_host_reasoning:false});
 return {question,goal,mode:'advice',intent_resolution:resolution,design_workflow:workflow,...advice,diagnosis:resolution.clarifications.join(' ')||'Répondre à la décision précise, sans relancer une conception complète.',why:'Le niveau d’intervention suit la demande actuelle.',exercise:{variant_count:null,duration_minutes:null,sizes_px:[],duration:'Non demandé',steps:[],schedule:[],constraint_status:resolution.status!=='resolved'?'ambiguous':'not_requested'},acceptance_criteria:[],coach_rule:'Conserver les décisions approuvées; ne pas présenter un conseil comme un essai réalisé.'};
}
