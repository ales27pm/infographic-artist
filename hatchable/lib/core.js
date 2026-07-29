import { browser } from "hatchable";
import { loadAtlas, loadLibrary, loadGraph } from "lib/data.js";

const MAX_RESULTS = 25;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png','image/jpeg','image/webp','image/gif']);
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
  if (item.depth === 'deep') score += 0.75;
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
export async function exploreGraph(query='',limit=80) {
  limit=Math.max(20,Math.min(Number(limit)||80,120)); const graph=await loadGraph(), nodes=graph.nodes||[], edges=graph.edges||[], qTokens=tokens(query); let filtered;
  if(qTokens.length){let selected=new Set(nodes.filter((node)=>qTokens.every((token)=>normalize([node.label,node.node_type,node.category,node.kind,node.ref].join(' ')).includes(token))).map((n)=>n.id)); for(let hop=0;hop<2;hop++){const expanded=new Set(selected); for(const edge of edges){if(selected.has(edge.source)) expanded.add(edge.target); if(selected.has(edge.target)) expanded.add(edge.source);} selected=expanded;} if(selected.size<Math.min(20,limit)){for(const node of [...nodes].sort((a,b)=>(b.degree||0)-(a.degree||0))){selected.add(node.id); if(selected.size>=Math.min(20,limit)) break;}} filtered=nodes.filter((n)=>selected.has(n.id));} else filtered=[...nodes].sort((a,b)=>(b.degree||0)-(a.degree||0));
  filtered=filtered.slice(0,limit); const keep=new Set(filtered.map((n)=>n.id)); const outEdges=edges.filter((e)=>keep.has(e.source)&&keep.has(e.target)).slice(0,limit*3);
  return {query:compactText(query,250),nodes:filtered.map((n)=>({id:n.id,label:n.label||n.id,type:n.node_type||'concept',ref:n.ref||'',x:n.x??0.5,y:n.y??0.5,degree:n.degree||0})),edges:outEdges,meta:{node_count:filtered.length,edge_count:outEdges.length}};
}
const ROUTE_ARCHETYPES=[
  {key:'symbol',name:'Signal autonome',architecture:'Un symbole compact conçu d’abord en silhouette monochrome, puis relié au nom par une règle de proportion stable.',geometry:'Une masse primaire, une tension directionnelle et une contreforme utile. Éviter les détails décoratifs avant 24 px.',typography:'Mot-signe calme et distinct, sans chercher à répéter littéralement la forme du symbole.',assets:['symbole','mot-signe','micro-icône','règles de réduction'],tests:['12/24/48 px','monochrome','flou 3 px','découpe','rappel après 2 secondes']},
  {key:'type',name:'Rythme typographique propriétaire',architecture:'Le nom devient l’actif principal grâce à une anomalie locale, un rythme ou une modulation issue de la promesse.',geometry:'Construire les intervalles, ligatures et contreformes sur une grille; limiter l’idée distinctive à un geste répétable.',typography:'Dessin ou modification ciblée plutôt qu’une police spectaculaire non gouvernée.',assets:['mot-signe','monogramme','alphabet secondaire','motif dérivé'],tests:['lecture immédiate','gravure','petite taille','langues secondaires','animation de construction']},
  {key:'system',name:'Champ vivant gouverné',architecture:'Une grammaire stable génère plusieurs compositions, icônes ou cadres sans figer la marque dans une seule image.',geometry:'Définir des invariants mesurables — grille, module, angle, densité et zone de repos — avant les variations.',typography:'Typographie fonctionnelle servant d’ancrage pendant que le champ visuel varie.',assets:['grille','règles de variation','bibliothèque de modules','motion','gabarits'],tests:['10 variantes cohérentes','signalétique','motion 2 secondes','supports étroits','version statique']}
];
function seedFromText(text){let h=2166136261; for(let i=0;i<text.length;i++){h^=text.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0;}
function seededShuffle(values, seed){const out=[...values]; let s=seed||1; const rand=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;}; for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out;}
export async function generateDirections(brief) {
  const name=compactText(brief?.name,120), sector=compactText(brief?.sector,160), promise=compactText(brief?.promise,1000); if(!name||!sector||promise.length<3) throw new Error('name, sector, and a meaningful promise are required.');
  const audience=compactText(brief.audience||'public général',400), traits=(brief.traits||[]).map((v)=>compactText(v,100)).filter(Boolean).slice(0,8), avoid=(brief.must_avoid||[]).map((v)=>compactText(v,100)).filter(Boolean).slice(0,8), risk=brief.risk_tolerance||'équilibrée';
  const seedMaterial=JSON.stringify({name,sector,promise,traits,avoid,risk}); let precedents=(await searchAtlas([sector,promise,...traits].join(' '),{limit:12})).items; precedents=seededShuffle(precedents,seedFromText(seedMaterial));
  const routes=ROUTE_ARCHETYPES.map((arch,index)=>{const precedent=precedents[index], secondary=precedents[index+3], sources=[precedent,secondary].filter(Boolean), principles=[]; for(const source of sources) principles.push(...(source.principles||[]).slice(0,2)); return {id:arch.key,name:arch.name,thesis:`Pour ${name}, rendre « ${promise} » visible par ${arch.architecture[0].toLowerCase()+arch.architecture.slice(1)}`,architecture:arch.architecture,geometry:arch.geometry,typography:arch.typography,palette_logic:'Commencer en noir et blanc; ajouter une couleur fonctionnelle liée à la promesse, puis vérifier le contraste et la reproduction.',assets:arch.assets,stress_tests:arch.tests,traits_to_express:traits.length?traits:['clarté','cohérence','présence'],must_avoid:avoid,precedents:sources.map((source)=>({id:source.id,name:source.name,principle_only:(source.principles||[source.lesson||''])[0]})),transferable_principles:[...new Set(principles)].slice(0,4),anti_copy_rule:'Ne pas emprunter la silhouette, la construction des lettres, la combinaison chromatique, le dispositif d’espace négatif ou la composition du précédent. Redériver chaque forme depuis ce brief.',fit:{audience,risk_tolerance:risk,sector}};});
  return {brief:{name,sector,promise,audience,traits,must_avoid:avoid,risk_tolerance:risk},routes,decision_rule:'Prototyper les trois routes en monochrome avant d’en choisir une. Retenir celle dont la structure — et non la finition — rend la promesse la plus facile à percevoir et la plus difficile à confondre.'};
}
function validateImageInput(file) {
  if(!file?.download_url||!file?.file_id) throw new Error('File values must include download_url and file_id.');
  if(file.mime_type && !ALLOWED_IMAGE_MIME_TYPES.has(String(file.mime_type).toLowerCase())) throw new Error(`Unsupported image MIME type: ${file.mime_type}`);
  let url; try{url=new URL(file.download_url);}catch{throw new Error('Seules les URL HTTPS sans identifiants intégrés sont acceptées.');}
  if(url.protocol!=='https:'||url.username||url.password) throw new Error('Seules les URL HTTPS sans identifiants intégrés sont acceptées.');
  const host=url.hostname.toLowerCase(); if(host==='localhost'||host.endsWith('.local')||host==='0.0.0.0'||host==='127.0.0.1'||host==='::1'||/^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error('Les URL de fichiers locaux ne sont pas acceptées.');
  return url.toString();
}
export async function imageMetrics(file) {
  const url=validateImageInput(file);
  return await browser.session(async (page)=>{
    await page.goto(url,{waitUntil:'networkidle0',timeout:20000});
    return await page.evaluate(async ()=>{
      const img=document.querySelector('img'); if(!img) throw new Error('Le fichier téléchargé n’est pas une image lisible.');
      try{await img.decode();}catch{}
      const width=img.naturalWidth||img.width, height=img.naturalHeight||img.height; if(!width||!height) throw new Error('Le fichier téléchargé n’est pas une image lisible.'); if(width>8192||height>8192||width*height>50000000) throw new Error('Les dimensions de l’image dépassent la limite de traitement.');
      const sample=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,w,h);const d=x.getImageData(0,0,w,h).data;const gray=new Float64Array(w*h);for(let i=0,p=0;i<d.length;i+=4,p++)gray[p]=(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])/255;return{gray,data:d,w,h};};
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
      const r=(v)=>Math.round(v*10000)/10000;return{width,height,aspect_ratio:r(width/Math.max(height,1)),contrast:r(contrast),edge_density:r(edgeCount/edge.length),entropy:r(entropy),foreground_occupancy:r(occupancy),centroid:{x:r(cx),y:r(cy)},balance:r(balance),small_size_stability:r(inter/(union||1)),saliency_concentration:r(saliency),average_hash,difference_hash,colour_histogram};
    });
  });
}
function clampScore(v){return Math.max(0,Math.min(20,v));}
function hamming(a,b){let diff=0;for(let i=0;i<Math.min(a.length,b.length);i++)if(Boolean(a[i])!==Boolean(b[i]))diff++;return 1-diff/Math.max(1,Math.min(a.length,b.length));}
function cosine(a,b){let dot=0,aa=0,bb=0;for(let i=0;i<Math.min(a.length,b.length);i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
export function compareImageMetrics(lm,rm){const ah=hamming(lm.average_hash,rm.average_hash),dh=hamming(lm.difference_hash,rm.difference_hash),colour=Math.max(0,Math.min(1,cosine(lm.colour_histogram,rm.colour_histogram))),occupancy=1-Math.min(Math.abs(lm.foreground_occupancy-rm.foreground_occupancy)/.65,1),centroid=1-Math.min(Math.hypot(lm.centroid.x-rm.centroid.x,lm.centroid.y-rm.centroid.y)/.7,1),edge=1-Math.min(Math.abs(lm.edge_density-rm.edge_density)/.45,1),stability=1-Math.min(Math.abs(lm.small_size_stability-rm.small_size_stability)/.8,1);const components={silhouette_hash:Math.round(1000*ah)/10,edge_hash:Math.round(1000*dh)/10,colour_distribution:Math.round(1000*colour)/10,mass_occupancy:Math.round(1000*occupancy)/10,composition_centroid:Math.round(1000*centroid)/10,edge_density:Math.round(1000*edge)/10,small_size_behaviour:Math.round(1000*stability)/10};const risk=Math.round(1000*(.26*ah+.18*dh+.10*colour+.14*occupancy+.12*centroid+.10*edge+.10*stability))/10,band=risk>=82?'très élevé':risk>=68?'élevé':risk>=52?'accru':risk>=35?'modéré':'faible',strongest=Object.entries(components).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([dimension,score])=>({dimension,score})),transformations=[];if(ah>=.70)transformations.push('Changer le contour extérieur, l’axe et les terminaisons jusqu’à ce que la silhouette diverge sous les tests de flou et de monochrome.');if(dh>=.70||edge>=.75)transformations.push('Reconstruire la topologie interne et l’espace négatif; ne pas conserver les mêmes ouvertures, découpes ou rythmes directionnels.');if(colour>=.82)transformations.push('Tester un comportement chromatique structurellement différent et valider le dessin en monochrome afin que la couleur ne soit pas la seule distinction.');if(centroid>=.82&&occupancy>=.82)transformations.push('Changer la composition, le rapport d’aspect, les relations d’échelle et le placement des masses plutôt que de simplement redessiner les détails.');if(!transformations.length)transformations.push('Continuer de documenter une dérivation indépendante et effectuer malgré tout une recherche professionnelle de marques et de risque de confusion avant le lancement.');return{risk_score:risk,risk_band:band,components,strongest_convergences:strongest,recommended_transformations:transformations,legal_note:'Il s’agit d’un triage perceptuel, non d’une autorisation de marque ni d’un avis juridique. Le risque de similarité dépend aussi du secteur, du territoire, du public, du contexte d’usage et des droits protégés.'};}
export function critiqueImageMetrics(m,referenceComparison=null,context=''){const occupancy=m.foreground_occupancy,centroidDistance=Math.hypot(m.centroid.x-.5,m.centroid.y-.5),composition=clampScore(20*(.42*m.balance+.28*(1-Math.min(centroidDistance/.55,1))+.30*(1-Math.min(Math.abs(occupancy-.38)/.5,1)))),hierarchy=clampScore(20*(.60*Math.min(m.saliency_concentration/.55,1)+.40*(1-Math.min(Math.abs(m.edge_density-.18)/.35,1)))),legibility=clampScore(20*(.55*Math.min(m.contrast/.30,1)+.45*m.small_size_stability)),complexityFit=1-Math.min(Math.abs(m.edge_density-.16)/.32,1),memorability=clampScore(20*(.45*complexityFit+.30*Math.min(m.entropy/.78,1)+.25*Math.min(m.saliency_concentration/.55,1)));let differentiation,diffConfidence;if(referenceComparison){differentiation=clampScore(20*(1-referenceComparison.risk_score/100));diffConfidence='élevée';}else{differentiation=clampScore(20*(.45*complexityFit+.35*(1-Math.min(Math.abs(occupancy-.35)/.55,1))+.20*Math.min(m.entropy/.8,1)));diffConfidence='faible; aucune référence fournie';}const round1=(v)=>Math.round(v*10)/10,axes={beaux_arts:{label:'Beaux-arts / composition',score:round1(composition)},hierarchy:{label:'Hiérarchie visuelle',score:round1(hierarchy)},legibility:{label:'Lisibilité et réduction',score:round1(legibility)},memorability:{label:'Mémorisation',score:round1(memorability)},differentiation:{label:'Différenciation',score:round1(differentiation),confidence:diffConfidence}},total=round1(Object.values(axes).reduce((s,a)=>s+a.score,0)),weaknesses=Object.entries(axes).sort((a,b)=>a[1].score-b[1].score).slice(0,2),mapping={beaux_arts:'Reconstruire en noir et blanc avec une masse dominante, une contreforme et un centre visuel délibéré.',hierarchy:'Créer trois variantes qui changent volontairement le premier point d’attention; tester en vignette et à deux mètres.',legibility:'Retirer les détails qui s’effondrent à 24 px, puis vérifier les versions monochrome, floutée, gravée et inversée.',memorability:'Réduire l’idée à un contour redessinable après deux secondes d’exposition; conserver une seule anomalie contrôlée.',differentiation:'Changer la silhouette, la topologie, la typographie, le comportement chromatique et la composition — pas seulement le style de surface.'};const technical_metrics={...m};delete technical_metrics.average_hash;delete technical_metrics.difference_hash;delete technical_metrics.colour_histogram;return{context:compactText(context,500),score:total,grade:total>=86?'A':total>=72?'B':total>=58?'C':'D',axes,technical_metrics,priority_actions:weaknesses.map(([key])=>mapping[key]),reference_comparison:referenceComparison,method_note:'Les mesures techniques soutiennent la critique; elles ne remplacent ni le jugement humain, ni les tests utilisateurs, ni la recherche de marques, ni l’examen juridique.'};}
export function coachDecision(question,critique=null,goal='improve the next iteration'){question=compactText(question,1800);goal=compactText(goal,400);const axes=critique&&typeof critique==='object'?(critique.axes||{}):{},ranked=Object.entries(axes).filter(([,v])=>v&&typeof v.score==='number').sort((a,b)=>a[1].score-b[1].score).slice(0,2),exercises={beaux_arts:'Produire six vignettes noir et blanc de 4 cm. Utiliser une masse dominante, une contreforme et aucun effet.',hierarchy:'Construire trois versions avec des ordres de lecture volontairement différents. Demander à trois personnes ce qu’elles ont vu en premier.',legibility:'Tester à 16, 24 et 48 px, en monochrome, flou, réserve, gravure et découpe vinyle.',memorability:'Montrer le signe pendant deux secondes, le masquer, puis faire redessiner uniquement le contour extérieur et un trait interne.',differentiation:'Placer la référence la plus proche à côté en gris; changer contour, topologie, construction typographique et composition jusqu’à disparition de la ressemblance cumulative.'},criteria={beaux_arts:'La composition reste stable en aplats, avec un point d’entrée clair et une zone de repos volontaire.',hierarchy:'Trois personnes sur trois identifient le même premier élément sans explication.',legibility:'Le noyau reste identifiable à 24 px et en monochrome.',memorability:'Une personne peut rappeler le contour principal après deux secondes d’exposition.',differentiation:'Aucune convergence cumulative forte ne subsiste entre silhouette, topologie, typographie, comportement chromatique et composition.'};let diagnosis,plan,acceptance;if(ranked.length){diagnosis=`La prochaine itération doit isoler ${ranked.map(([key,v])=>v.label||key).join(' et ')}, plutôt que de tout redessiner en même temps.`;plan=ranked.map(([k])=>exercises[k]).filter(Boolean);acceptance=ranked.map(([k])=>criteria[k]).filter(Boolean);}else{diagnosis='Aucune critique chiffrée n’a été fournie. Transformer la question en une décision visuelle falsifiable avant de raffiner le style.';plan=['Formuler la décision comme une hypothèse d’une phrase, puis construire trois prototypes structurellement incompatibles en noir et blanc.'];acceptance=['La direction choisie communique la promesse visée sans explication verbale et survit à trois contextes de production.'];}return{question,goal,diagnosis,why:'Une décision plus forte réduit l’ambiguïté du système visuel et rend le prochain test mesurable. La finition ne peut pas réparer une hiérarchie structurelle faible ni une topologie copiée.',exercise:{duration:'45–90 minutes',steps:plan},acceptance_criteria:acceptance,coach_rule:'Défendre la décision avec des preuves observables : réduction, rappel, ordre de lecture, comportement en production et distance par rapport aux références — pas seulement avec des adjectifs.'};}
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
  if(name==='coach_brand_decision')return{view:'coach',data:coachDecision(args.question||'',args.critique,args.goal||'improve the next iteration')};
  throw new Error(`Unknown tool: ${name}`);
}