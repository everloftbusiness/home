// Read-only browser test against the local app and a designated test account.
// Example: EVERLOFT_TEST_EMAIL / EVERLOFT_TEST_PASSWORD, then node this script.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const email=process.env.EVERLOFT_TEST_EMAIL,password=process.env.EVERLOFT_TEST_PASSWORD;
if(!email||!password)throw new Error('Set EVERLOFT_TEST_EMAIL and EVERLOFT_TEST_PASSWORD.');
const origin='http://localhost:3000';
await mkdir('tmp/nav-visual',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext();
 const login=await context.request.post(origin+'/api/auth/login',{data:{email,password}});
 assert.ok(login.ok(),'Test account login');
 const page=await context.newPage();
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',900,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  await page.goto(origin+'/dashboard');
  const nav=page.getByRole('navigation',{name:'Booking shortcuts'});
  const register=nav.getByRole('link',{name:'Bookings & Settlements'});
  const add=nav.getByRole('link',{name:'Add booking'});
  await register.waitFor({state:'visible'});
  assert.ok(await add.isVisible(),name+' Add booking visibility');
  for(const link of [register,add]){
   const box=await link.boundingBox();
   assert.ok(box&&box.x>=0&&box.x+box.width<=width&&box.y+box.height<height,name+' shortcut in viewport');
  }
  await page.screenshot({path:`tmp/nav-visual/after-${name}.png`});
  await register.click();
  await page.getByRole('heading',{name:'Bookings & Settlements',exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/dashboard/bookings');
  await page.getByRole('navigation',{name:'Booking shortcuts'}).getByRole('link',{name:'Add booking'}).click();
  await page.getByRole('heading',{name:'Add booking',exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/dashboard/bookings/new');
  console.log(`PASS ${name}: both shortcuts visible and both destinations reached`);
 }
 await page.goto(origin+'/dashboard/super-admin');
 await page.getByRole('navigation',{name:'Booking shortcuts'}).waitFor();
 console.log('PASS: shortcuts also present in Super Admin workspace');
}finally{await browser.close();}
