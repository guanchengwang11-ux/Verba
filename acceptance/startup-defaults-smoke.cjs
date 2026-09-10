const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const phase=process.argv[2];
const profile=path.resolve('acceptance/startup-smoke-profile');
fs.mkdirSync(profile,{recursive:true});
app.setPath('userData',profile);
let server;
app.whenReady().then(async()=>{
  const root=path.resolve('dist/win-unpacked/resources/app.asar');
  const {startServer}=await import(pathToFileURL(path.join(root,'server.mjs')).href);
  server=await startServer({publicDirectory:root,configurationDirectory:profile,port:33417});
  const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await win.loadURL('http://127.0.0.1:33417');
  const js=code=>win.webContents.executeJavaScript(code);
  for(let i=0;i<50;i++){if(await js(`document.querySelector('#appVersion').textContent==='Verba 1.1.2'`))break;await new Promise(r=>setTimeout(r,100));}
  const snapshot=()=>js(`({locale:VerbaI18n.locale,html:document.documentElement.lang,mode:document.querySelector('.mode-card.active').dataset.mode,source:document.querySelector('#sourceLanguage').textContent.trim(),target:document.querySelector('#targetLanguage').textContent.trim(),toggle:document.querySelector('#interfaceLanguage').textContent,version:document.querySelector('#appVersion').textContent})`);
  const initial=await snapshot();
  assert.equal(initial.locale,'en-US');assert.equal(initial.html,'en-US');assert.equal(initial.mode,'chat');assert.match(initial.source,/English/);assert.match(initial.target,/Chinese/);assert.equal(initial.toggle,'Chinese');assert.equal(initial.version,'Verba 1.1.2');
  if(phase==='second') {
    assert.equal(await js(`localStorage.getItem('verba-interface-language')`),'zh-CN');
    assert.equal(await js(`localStorage.getItem('verba-glossary')`),'[{"source":"QA","target":"QA"}]');
    assert.equal(await js(`localStorage.getItem('verba-provider')`),'deepseek');
  }
  // Capture the real renderer request without forwarding any model call.
  await js(`window.captured=[];window.originalFetch=window.fetch;window.fetch=(url,options)=>{if(url==='/api/translate'){captured.push(JSON.parse(options.body));return Promise.resolve(new Response(JSON.stringify({translation:'',englishMeaning:''}),{status:200,headers:{'Content-Type':'application/json'}}));}return originalFetch(url,options);};document.querySelector('#sourceText').value='Synthetic startup check';document.querySelector('#translateButton').click();`);
  await new Promise(r=>setTimeout(r,100));
  let request=await js(`captured.at(-1)`);assert.equal(request.mode,'chat');assert.equal(request.direction,'enToZh');
  await js(`document.querySelector('#interfaceLanguage').click();document.querySelector('[data-mode=email]').click();document.querySelector('#swapLanguages').click();document.querySelector('#clearText').click();document.querySelector('.new-chat').click();`);
  const manual=await snapshot();assert.equal(manual.locale,'zh-CN');assert.equal(manual.mode,'email');assert.match(manual.source,/中文/);assert.match(manual.target,/English/);
  await js(`document.querySelector('#sourceText').value='Synthetic manual check';document.querySelector('#translateButton').click();`);
  await new Promise(r=>setTimeout(r,100));
  request=await js(`captured.at(-1)`);assert.equal(request.mode,'email');assert.equal(request.direction,'zhToEn');
  assert.deepEqual(await snapshot(),manual);
  if(phase==='first') await js(`localStorage.setItem('verba-glossary','[{"source":"QA","target":"QA"}]');localStorage.setItem('verba-provider','deepseek');`);
  await win.webContents.session.flushStorageData();
  fs.writeFileSync(`acceptance/startup-defaults-${phase}.json`,JSON.stringify({passed:true,phase,initial,manual,requestMode:request.mode,requestDirection:request.direction,modelCalls:0},null,2));
  win.destroy();server.close();app.quit();
}).catch(e=>{console.error(e);if(server)server.close();app.exit(1);});
