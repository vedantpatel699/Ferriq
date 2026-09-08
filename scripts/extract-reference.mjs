import fs from 'node:fs';import vm from 'node:vm';
const ids=['air-blower','fired-heater','shell-tube-exchanger','membrane-analyzer'];
function literal(s,name){const start=s.indexOf('const '+name+' = ')+name.length+9;if(start<name.length+9)throw Error(name);let depth=0,q='',line=false,block=false;for(let i=start;i<s.length;i++){const c=s[i],n=s[i+1];if(line){if(c==='\n')line=false;continue}if(block){if(c==='*'&&n==='/'){block=false;i++}continue}if(q){if(c==='\\'){i++;continue}if(c===q)q='';continue}if(c==='/'&&n==='/'){line=true;i++;continue}if(c==='/'&&n==='*'){block=true;i++;continue}if('"\'`'.includes(c)){q=c;continue}if('[{('.includes(c))depth++;if(']})'.includes(c))depth--;if(c===';'&&depth===0)return vm.runInNewContext('('+s.slice(start,i)+')',{}, {timeout:1000});}throw Error(name)}
const data={};for(const id of ids){const s=fs.readFileSync('reference/original/'+id+'.html','utf8');data[id]={rows:literal(s,'DEMO_DATA'),aliases:literal(s,'TAG_ALIASES')};}
fs.writeFileSync('src/reference/data.json',JSON.stringify(data));
const s=fs.readFileSync('reference/original/furnace-skin-temp.html','utf8');fs.writeFileSync('reference/furnace-manual.html',literal(s,'MANUAL_HTML'));
console.log(Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.rows.length])));
