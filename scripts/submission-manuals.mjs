import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:1100,height:900}});
await mkdir('submission/sudhakar/manuals',{recursive:true});
const records=[];
for(const [id,route] of [
 ['air-blower','equipment/air-blower'],['fired-heater','equipment/fired-heater'],
 ['shell-tube-exchanger','equipment/shell-tube-exchanger'],['membrane-analyzer','equipment/membrane-analyzer'],
 ['furnace-skin-temp','predictors/furnace-skin-temp'],['crude-to-profit','crude-to-profit']]){
 await page.goto('http://localhost:4173/'+route);
 await page.getByRole('button',{name:'Engineering manual',exact:true}).click();
 const manual=page.locator('.reference-manual').first();await manual.waitFor();
 records.push({id,text:await manual.innerText(),formulas:await manual.locator('.formula-expression').allTextContents()});
 const html=await manual.evaluate(el=>el.outerHTML);
 await page.evaluate(html=>{document.body.innerHTML=html},html);
 await page.addStyleTag({content:`
 html,body {height:auto!important;overflow:visible!important;background:white!important;margin:0!important;}
 .reference-manual {max-width:none!important; padding:0!important; font-size:11px!important;}
 h2 {font-size:21px!important;} h3 {font-size:15px!important;break-after:avoid;}
 .manual-section {break-inside:auto;} .formula-block, tr, li {break-inside:avoid;}
 .formula-expression {white-space:normal!important;overflow-wrap:anywhere;font-size:12px!important;}
 .data-table-wrap, .table-scroll, [role=region] {overflow:visible!important;max-height:none!important;}
 table {width:100%!important;min-width:0!important;table-layout:fixed;} th,td {white-space:normal!important;overflow-wrap:anywhere;font-size:10px!important;}
 a {overflow-wrap:anywhere;} .source-note {font-size:10px!important;}
 `});
 await page.evaluate(()=>document.fonts.ready);
 await page.pdf({path:`submission/sudhakar/manuals/${id}.pdf`,format:'A4',printBackground:true,margin:{top:'15mm',bottom:'15mm',left:'15mm',right:'15mm'},displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:9px;width:100%;text-align:center;color:#555"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
}
await writeFile('submission/sudhakar/tests/manual-content.json',JSON.stringify(records,null,2)+'\n');
await browser.close();
console.log('Six manuals printed from the actual website content and formula elements');

