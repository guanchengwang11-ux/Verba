const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'verba-build-smoke-'));
app.setPath('userData', profile);
let server;
app.whenReady().then(async () => {
  const root = path.resolve('dist/win-unpacked/resources/app.asar');
  const service = await import(pathToFileURL(path.join(root, 'server.mjs')).href);
  server = await service.startServer({publicDirectory:root, configurationDirectory:profile, port:0});
  const url = `http://127.0.0.1:${server.address().port}`;
  const window = new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await window.loadURL(url);
  let view;
  for (let i=0; i<50; i++) {
    view = await window.webContents.executeJavaScript(`({title:document.title,version:document.querySelector('#appVersion')?.textContent,diagnostics:!!document.querySelector('#diagnosticSummary'),settings:!!document.querySelector('#openAppSettings')})`);
    if(view.version==='Verba 1.1.1') break;
    await new Promise(r=>setTimeout(r,100));
  }
  const version = await (await fetch(`${url}/api/version`)).json();
  const health = await (await fetch(`${url}/health`)).json();
  const config = await (await fetch(`${url}/api/config`)).json();
  const diagnosticStatus = (await fetch(`${url}/api/diagnostics`)).status;
  if (version.version!=='1.1.1'||view.version!=='Verba 1.1.1'||!view.diagnostics||!view.settings||health.status!=='ok'||diagnosticStatus!==200||Object.values(config.keys).some(Boolean)) throw Error('Packaged startup verification failed');
  fs.writeFileSync('acceptance/test-build-smoke-result.json',JSON.stringify({passed:true,version:version.version,view,health,diagnosticStatus,emptyIsolatedConfiguration:true,source:'packaged app.asar in Electron; isolated profile and ephemeral port; no model calls'},null,2));
  window.destroy(); server.close(); app.quit();
}).catch(error=>{console.error(error.message);if(server)server.close();app.exit(1);});
