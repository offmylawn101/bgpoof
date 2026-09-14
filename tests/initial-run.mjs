import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.on('console', m => console.log('console', m.type(), m.text().slice(0,500)));
page.on('pageerror', e => console.log('pageerror', e.message));
page.on('response', r => { if(r.status()>=400) console.log('http',r.status(),r.url()); });
await page.goto('http://localhost:3090', { waitUntil: 'networkidle' });
console.log('loaded', await page.title());
await page.getByLabel('Upload photo', {exact:true}).setInputFiles('public/example.jpg');
let previous='';
for(let i=0;i<180;i++) {
 const status=await page.locator('.processing-status').allTextContents();
 const error=await page.locator('[role=alert]').allTextContents();
 const current=JSON.stringify({status,error}); if(current!==previous){console.log(current);previous=current;}
 if(await page.getByRole('link',{name:'Download PNG'}).count())break;
 if(error.length)break;
 await page.waitForTimeout(1000);
}
await page.screenshot({path:'/tmp/removebg-first-result.png',fullPage:true});
const link=page.getByRole('link',{name:'Download PNG'});
if(await link.count()) {
 const [download] = await Promise.all([page.waitForEvent('download'),link.click()]);
 await download.saveAs('public/example-cutout.png');
 console.log('download',download.suggestedFilename());
 console.log('isolation', await page.evaluate(()=>crossOriginIsolated));
}
await browser.close();
