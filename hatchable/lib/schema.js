// Bounded JSON Schema subset used by this plugin's trusted tool contracts.
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => JSON.stringify(plain(value) ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])) : Array.isArray(value) ? value.map(v=>JSON.parse(canonical(v))) : value);
export function validateSchema(schema, value, path='arguments', depth=0) {
  if(depth>32)return `${path}: nesting limit exceeded`;
  if(!schema || schema===true)return null;
  if(schema===false)return `${path}: value is not allowed`;
  if(schema.type){
    const types=Array.isArray(schema.type)?schema.type:[schema.type];
    const matches=t=>t==='null'?value===null:t==='object'?plain(value):t==='array'?Array.isArray(value):t==='integer'?Number.isInteger(value):t==='number'?typeof value==='number'&&Number.isFinite(value):typeof value===t;
    if(!types.some(matches))return `${path} must be ${types.join(' or ')}`;
  }
  if(schema.const!==undefined && canonical(value)!==canonical(schema.const))return `${path}: unexpected value`;
  if(schema.enum && !schema.enum.some(x=>canonical(x)===canonical(value)))return `${path}: value is not in enum`;
  if(typeof value==='string'){
    const length=[...value].length;
    if(schema.minLength!==undefined && length<schema.minLength)return `${path}: too short`;
    if(schema.maxLength!==undefined && length>schema.maxLength)return `${path}: too long`;
  }
  if(typeof value==='number'){
    if(schema.minimum!==undefined && value<schema.minimum)return `${path}: below minimum`;
    if(schema.maximum!==undefined && value>schema.maximum)return `${path}: above maximum`;
  }
  if(Array.isArray(value)){
    if(schema.minItems!==undefined && value.length<schema.minItems)return `${path}: too few items`;
    if(schema.maxItems!==undefined && value.length>schema.maxItems)return `${path}: too many items`;
    if(schema.uniqueItems && new Set(value.map(canonical)).size!==value.length)return `${path}: duplicate items`;
    if(schema.items)for(let i=0;i<value.length;i++){const error=validateSchema(schema.items,value[i],`${path}[${i}]`,depth+1);if(error)return error;}
  }
  if(plain(value)){
    for(const key of schema.required||[])if(!Object.prototype.hasOwnProperty.call(value,key))return `${path}: missing ${key}`;
    const props=schema.properties||{};
    for(const key of Object.keys(value)){
      if(!Object.prototype.hasOwnProperty.call(props,key)){
        if(schema.additionalProperties===false)return `${path}: unexpected ${key}`;
      }else{const error=validateSchema(props[key],value[key],`${path}.${key}`,depth+1);if(error)return error;}
    }
  }
  if(schema.anyOf && !schema.anyOf.some(s=>!validateSchema(s,value,path,depth+1)))return `${path}: no anyOf branch matched`;
  if(schema.allOf)for(const s of schema.allOf){const error=validateSchema(s,value,path,depth+1);if(error)return error;}
  return null;
}
