import P0 from "lib/data-part00.js";
import P1 from "lib/data-part01.js";
import P2 from "lib/data-part02.js";
import P3 from "lib/data-part03.js";
import P4 from "lib/data-part04.js";
import P5 from "lib/data-part05.js";
import P6 from "lib/data-part06.js";
import P7 from "lib/data-part07.js";
import P8 from "lib/data-part08.js";
import P9A from "lib/data-part09a.js";
import P9B from "lib/data-part09b.js";
import P10A from "lib/data-part10a.js";
import P10B from "lib/data-part10b.js";

const PAYLOAD=P0+P1+P2+P3+P4+P5+P6+P7+P8+P9A+P9B+P10A+P10B;
let decoded;
function textAt(strings,index){return index<0?'':strings[index];}
function listAt(strings,indexes){return (indexes||[]).map(index=>textAt(strings,index));}
async function inflate(){if(decoded)return decoded;const bytes=Uint8Array.from(atob(PAYLOAD),c=>c.charCodeAt(0));const stream=new DecompressionStream('gzip');const reader=stream.readable.getReader();const writer=stream.writable.getWriter();const reading=(async()=>{const chunks=[];let total=0;for(;;){const part=await reader.read();if(part.done)break;chunks.push(part.value);total+=part.value.length;}const all=new Uint8Array(total);let offset=0;for(const part of chunks){all.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder().decode(all));})();await writer.write(bytes);await writer.close();decoded=await reading;return decoded;}
function brand(strings,row){const d=row[14]||[];return{id:textAt(strings,row[0]),name:textAt(strings,row[1]),organization:textAt(strings,row[2]),first_use:textAt(strings,row[3]),designers:listAt(strings,row[4]),category:textAt(strings,row[5]),archetype:textAt(strings,row[6]),visual_mechanism:textAt(strings,row[7]),why_iconic:textAt(strings,row[8]),brand_system_lesson:textAt(strings,row[9]),transferable_principles:listAt(strings,row[10]),do_not_copy:textAt(strings,row[11]),stress_tests:listAt(strings,row[12]),tags:listAt(strings,row[13]),benchmark_dimensions:{visual_complexity:d[0],abstraction:d[1],system_depth:d[2],heritage_continuity:d[3],semantic_compression:d[4],adaptability:d[5]},sources:(row[15]||[]).map(source=>({title:textAt(strings,source[0]),url:textAt(strings,source[1]),kind:textAt(strings,source[2])})),region:textAt(strings,row[16]),era:textAt(strings,row[17]),mechanism_clusters:listAt(strings,row[18]),evidence_level:textAt(strings,row[19]),collision_layers:listAt(strings,row[20]),primary_mechanism:textAt(strings,row[21]),asset_layers:listAt(strings,row[22]),legal_sensitivity:textAt(strings,row[23]),evidence_confidence:textAt(strings,row[24]),anchor_year:row[25],system_pattern:textAt(strings,row[26]),recognition_basis:listAt(strings,row[27]),depth:(row[15]||[]).length?'deep':'index'};}
export async function loadAtlas(){const data=await inflate();return{deep_case_count:data.m[0],index_case_count:data.m[1],case_count:data.b.length,brands:data.b.map(row=>brand(data.s,row))};}
export async function loadLibrary(){const data=await inflate();return{entry_count:data.l.length,entries:data.l.map(row=>({name:textAt(data.s,row[0]),type:textAt(data.s,row[1]),region:textAt(data.s,row[2]),era:textAt(data.s,row[3]),focus:listAt(data.s,row[4]),principles:listAt(data.s,row[5]),key_works:listAt(data.s,row[6]),source_url:textAt(data.s,row[7]),source_status:textAt(data.s,row[8])}))};}
export async function loadGraph(){const data=await inflate();return{nodes:data.n.map(row=>({id:textAt(data.s,row[0]),label:textAt(data.s,row[1]),node_type:textAt(data.s,row[2]),ref:textAt(data.s,row[3]),x:row[4],y:row[5],degree:row[6]})),edges:data.e.map(row=>({source:textAt(data.s,row[0]),target:textAt(data.s,row[1]),relation:textAt(data.s,row[2])})),meta:{node_count:data.n.length,edge_count:data.e.length}};}
export async function loadWidgetHtml(){return (await inflate()).w||'';}