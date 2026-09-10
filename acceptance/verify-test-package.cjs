const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const asar=require('../node_modules/.pnpm/@electron+asar@3.4.1/node_modules/@electron/asar');
const archive='dist/win-unpacked/resources/app.asar';
const names=asar.listPackage(archive).map(n=>n.replaceAll('\\','/').replace(/^\//,''));
const secrets=[];
for(const file of ['.env',path.join(process.env.APPDATA,'verba-workplace-translator/config/.env')]) {
  if(fs.existsSync(file)) for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
    const m=line.match(/^\s*[A-Z_]*API_KEY\s*=\s*(.*)$/);
    if(m&&m[1].trim().length>12) secrets.push(m[1].trim().replace(/^['"]|['"]$/g,''));
  }
}
let checked=0;
for(const name of names) {
  if(asar.statFile(archive,path.normalize(name)).files) continue;
  const data=asar.extractFile(archive,path.normalize(name));
  if(secrets.some(s=>data.includes(Buffer.from(s)))) throw Error('Credential found in package; do not distribute');
  if(!name.startsWith('node_modules/')&&name!=='package.json'&&fs.existsSync(name)&&fs.statSync(name).isFile()) {
    if(!data.equals(fs.readFileSync(name))) throw Error(`Stale packaged file: ${name}`);
    checked++;
  }
}
const version=JSON.parse(asar.extractFile(archive,'package.json')).version;
const installer=`dist/Verba-Setup-${version}.exe`;
const result={version:JSON.parse(asar.extractFile(archive,'package.json')).version,sourceFilesMatched:checked,secretScanPassed:true,installer:path.resolve(installer),bytes:fs.statSync(installer).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(installer)).digest('hex'),published:false};
fs.writeFileSync(`acceptance/test-package-${version}-verification.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
