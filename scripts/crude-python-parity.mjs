// Cross-language regression plus independent revised-workbook tie-out.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';
const code = ['data.ts','calculations.ts'].map(file => stripTypeScriptTypes(fs.readFileSync(`src/engineering/crudeToProfit/${file}`, 'utf8'), {mode:'strip'}).replace(/^import[\s\S]*?;\s*/gm,'').replace(/\bexport\s+/g,'')).join('\n');
const model = vm.runInNewContext(code+';({runModel,runWorkbookModel,DEFAULT_CRUDE_TO_PROFIT_CONFIG,DEFAULT_CRUDE_FLOWS_M3HR,CRUDES,PRODUCTS,cokerYieldWtpct,LC_FINER_YIELD_WTPCT,FCC_YIELD_WTPCT})');
const cfg = model.DEFAULT_CRUDE_TO_PROFIT_CONFIG;
const snapshot = JSON.parse(fs.readFileSync('public/data/crude-market-prices.json','utf8'));
const cases=[];
for(const flows of [model.DEFAULT_CRUDE_FLOWS_M3HR, Object.fromEntries(model.CRUDES.map(c=>[c,0])), {OSH:120,SHD:33,AWB:180,SCO:25,FRB:222}])
 for(const residue of ['none','lc_finer','delayed_coker']) for(const gas of ['none','hydrocracker','fcc'])
  for(const recovery of [0,0.5,1]) for(const market of [null,snapshot])
   cases.push({flows,config:{...cfg,lpg_fuel_gas_recovered:recovery},residue,gas,market});
const py=spawnSync(process.env.PYTHON || 'python',['-c',`import sys,json
sys.path.insert(0,'python/crude_to_profit')
import engine as E
cases=json.load(sys.stdin)
out=[]
for c in cases:
 m=c['market'] or {}
 r=E.run_model(c['flows'],c['config'],market_crude_prices=m.get('crude'),market_product_prices=m.get('product'),residue_unit=c['residue'],gas_oil_unit=c['gas'])
 r['economics']['has_market_case']=r['economics'].pop('market_case')=='complete'
 out.append(r)
print(json.dumps(out,allow_nan=False))`],{input:JSON.stringify(cases),encoding:'utf8',maxBuffer:10*1024*1024});
if(py.status!==0) throw Error(py.stderr);
const expected=JSON.parse(py.stdout);
let comparisons=0;
function equal(a,b,path='result') {
 comparisons++;
 if(typeof a==='number') {assert.ok(typeof b==='number' && Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b)),`${path}: ${a} != ${b}`); return;}
 if(a && typeof a==='object') { for(const [k,v]of Object.entries(a)) equal(v,b?.[k],path+'.'+k); return; }
 assert.equal(a,b,path);
}
cases.forEach((c,i)=>equal(model.runModel(c.flows,c.config,c.market?.crude??null,c.market?.product??null,c.residue,c.gas),expected[i],`case ${i}`));
const wb=JSON.parse(fs.readFileSync('reference/crude-workbook-rev1.json','utf8')).cells;
const value=(sheet,cell)=>wb[sheet][cell].cached;
const run=model.runWorkbookModel(model.DEFAULT_CRUDE_FLOWS_M3HR,cfg,null,null);
model.CRUDES.forEach((c,i)=>{const col=String.fromCharCode(68+i);equal(model.DEFAULT_CRUDE_FLOWS_M3HR[c],value('Sheet1',col+'5'));equal(cfg.crude_price_low_cad_m3[c],value('Sheet1',col+'40'));equal(cfg.crude_price_high_cad_m3[c],value('Sheet1',col+'41'));});
const dropped=run.simdist_stream_feeds_m3hr.naphtha * value('SimDist','AA9')/100;
assert.equal(wb.SimDist.AA10.input,'=$C$9*(Z9/100)');
model.PRODUCTS.forEach((p,i)=>{const col=String.fromCharCode(68+i);equal(cfg.product_price_low_cad_m3[p],value('Sheet1',col+'45'));equal(cfg.product_price_high_cad_m3[p],value('Sheet1',col+'46'));equal(run.product_slate_m3hr[p],value('Sheet1',col+'44')+(p==='naphtha'?dropped:0),p+' workbook tie-out');});
for(const [kind,cell] of [['low','H51'],['high','H52']]) equal(run.economics[`margin_${kind}_cad_hr`],value('Sheet1',cell)+dropped*cfg[`product_price_${kind}_cad_m3`].naphtha,kind+' margin tie-out');
equal(run.byproducts.lpg_recovered_m3hr,0);
equal(Object.values(model.LC_FINER_YIELD_WTPCT).reduce((a,b)=>a+b,0),100);
equal(Object.values(model.FCC_YIELD_WTPCT).reduce((a,b)=>a+b,0),100);
const y=model.cokerYieldWtpct(15);
for(const [key,lo,hi]of [['rhc_naphtha',10,18],['diesel',20,30],['rhc_lvgo',10,20],['rhc_mvgo',5,15],['rhc_hvgo',2,8],['unconverted_residue',0,5],['coke',15,25],['lpg_fuel_gas',7,15]]) assert.ok(y[key]>=lo && y[key]<=hi,key+' client range');
console.log(`PASS: ${cases.length} Python/TypeScript cases; ${comparisons} comparisons; revised-workbook prices and outputs reconcile after AA10 correction (${dropped.toFixed(8)} m3/h naphtha).`);
