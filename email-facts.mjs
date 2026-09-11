// Conservative, source-anchored checks for customer email. Never rewrites source.
const digits={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
const units={十:10n,百:100n,千:1000n,万:10000n,亿:100000000n};
export function decimal(value){
  const s=String(value).replaceAll(',','').trim();
  if(/^\d+(?:\.\d+)?$/.test(s)){const [a,b='']=s.split('.');return BigInt(a).toString()+(b.replace(/0+$/,'')?'.'+b.replace(/0+$/,''):'');}
  if(/[一二两三四五六七八九]{2}/.test(s))return null;
  if(!/^[零〇一二两三四五六七八九十百千万亿\d.]+$/.test(s))return null;
  const tokens=s.match(/\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万亿]/g);
  // Explicit common colloquial endings: 两千五 -> 两千五百; 零 prevents inference.
  let expanded=s;
  const short=s.match(/([百千万])([一二两三四五六七八九])$/);
  if(short&&!s.includes('零')&&!s.includes('〇'))expanded=s+({百:'十',千:'百',万:'千'}[short[1]]);
  const ts=expanded.match(/\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万亿]/g);
  const precision=Math.max(0,...ts.map(t=>(t.split('.')[1]||'').length));const scale=10n**BigInt(precision);
  let total=0n,section=0n,n=0n;
  for(const t of ts){if(units[t]){const u=units[t];if(u>=10000n){total+=(section+n||scale)*u;section=0n;}else section+=(n||scale)*u;n=0n;}else if(t in digits)n=BigInt(digits[t])*scale;else{const [a,b='']=t.split('.');n=BigInt(a+b.padEnd(precision,'0'));}}
  const raw=(total+section+n).toString().padStart(precision+1,'0');return decimal(precision?raw.slice(0,-precision)+'.'+raw.slice(-precision):raw);
}
function subtract(a,b){const p=Math.max((a.split('.')[1]||'').length,(b.split('.')[1]||'').length);const cast=s=>{const [x,y='']=s.split('.');return BigInt(x+y.padEnd(p,'0'));};let v=cast(a)-cast(b);const sign=v<0n?'-':'';if(v<0n)v=-v;const s=v.toString().padStart(p+1,'0');return sign+decimal(p?s.slice(0,-p)+'.'+s.slice(-p):s);}
const aliases={USD:'USD',美元:'USD',dollar:'USD',dollars:'USD','$':'USD',NGN:'NGN',奈拉:'NGN',naira:'NGN','₦':'NGN',CAD:'CAD',加元:'CAD','Canadian dollars':'CAD',USDT:'USDT',BTC:'BTC',ETH:'ETH',CNY:'CNY',人民币:'CNY',RMB:'CNY',EUR:'EUR',欧元:'EUR',GBP:'GBP',英镑:'GBP'};
const currency=Object.keys(aliases).sort((a,b)=>b.length-a.length).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
const num='(?:\\d[\\d,]*(?:\\.\\d+)?(?:[十百千万亿](?:\\d+(?:\\.\\d+)?)?)*|[零〇一二两三四五六七八九十百千万亿]+)';
const cur=s=>{const key=Object.keys(aliases).find(k=>k.toLowerCase()===s.toLowerCase());return aliases[key];};
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function emailFacts(source){
  const text=String(source);const money=[];const ranges=[];const uncertainSpans=[];
  const pattern=new RegExp(`(${currency})\\s*(${num})|(${num})\\s*(${currency})`,'giu');
  for(const m of text.matchAll(pattern)){const value=decimal(m[2]||m[3]);if(value===null){uncertainSpans.push({raw:m[0],start:m.index,end:m.index+m[0].length});continue;}money.push({value,currency:cur(m[1]||m[4]),raw:m[0],start:m.index,end:m.index+m[0].length,context:text.slice(Math.max(0,m.index-22),m.index+m[0].length+15)});}
  const dates=[];
  const years=[...text.matchAll(/\b(20\d{2})\b|(?<!\d)(20\d{2})年/g)].map(m=>m[1]||m[2]);const year=[...new Set(years)].length===1?years[0]:null;
  for(const m of text.matchAll(/(?:(20\d{2})年)?(\d{1,2})月(?:(\d{1,2})日)?/g)){ranges.push([m.index,m.index+m[0].length]);if(m[3])dates.push(`${m[1]||year||'?'}-${+m[2]}-${+m[3]}`);}
  const monthPattern=new RegExp(`(${months.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?`,'gi');
  for(const m of text.matchAll(monthPattern)){ranges.push([m.index,m.index+m[0].length]);dates.push(`${m[3]||year||'?'}-${months.findIndex(x=>x.toLowerCase()===m[1].toLowerCase())+1}-${+m[2]}`);}
  const fractions=[];
  for(const m of text.matchAll(/([一二两三四五六七八九十百]+)分之([一二两三四五六七八九十]+)|\b(one)[- ](half|third|quarter|tenth)\b/gi)){ranges.push([m.index,m.index+m[0].length]);fractions.push(m[1]?`${decimal(m[2])}/${decimal(m[1])}`:`1/${({half:2,third:3,quarter:4,tenth:10})[m[4].toLowerCase()]}`);}
  const values=[];
  for(const m of text.matchAll(new RegExp(num,'gu'))){if(ranges.some(([a,b])=>m.index>=a&&m.index<b))continue;
    if(m[0]==='百'&&text.slice(m.index+1).startsWith('分'))continue;
    const before=text.slice(Math.max(0,m.index-1),m.index),after=text.slice(m.index+m[0].length);
    // IDs and ordinary classifiers/relational words are not amount assertions.
    if(/[A-Za-z_]/.test(before)||/^(?:年|月份|笔|者|个|次|份|期|张|枚|天)/.test(after)&&!/[\d]/.test(m[0])||/^[零〇一二两三四五六七八九十]+$/.test(m[0]))continue;
    const value=decimal(m[0]);if(value!==null)values.push({value,raw:m[0],start:m.index,end:m.index+m[0].length});
  }
  return {source:text,money,values,dates:[...new Set(dates)],fractions:[...new Set(fractions)],uncertainSpans};
}
export function sourceNotes(facts){
  const notes=[];const text=facts.source;
  for(const span of facts.uncertainSpans)notes.push({kind:'ambiguity',sourceQuote:span.raw,message:'This source amount uses an uncertain numeric expression. Its exact value has not been independently determined; please confirm it rather than treating a guessed number as verified.'});
  for(const m of text.matchAll(new RegExp(`(${num})\\s*(USDT|USD|美元|奈拉|NGN|BTC)?[，, ]*(?:也就是|即|也即)\\s*(${num})\\s*(USDT|USD|美元|奈拉|NGN|BTC)`,'giu'))){const a=decimal(m[1]),b=decimal(m[3]);if(a!==null&&b!==null&&a!==b)notes.push({kind:'conflict',sourceQuote:m[0],message:`The customer equates ${a} with ${b} ${cur(m[4])}. These stated amounts conflict. The translation preserves both; please confirm the intended amount.`});}
  const relation=text.match(new RegExp(`(?:应到账|预计到账)\\s*(${num}).*?(?:实际到账|实际.*?收到)\\s*(${num}).*?(?:少了|少到账的|差额为)\\s*(${num})`,'u'));
  if(relation){const a=decimal(relation[1]),b=decimal(relation[2]),c=decimal(relation[3]),difference=a===null||b===null?null:subtract(a,b);if(c!==null&&difference!==null&&c!==difference){const currencies=[...new Set(facts.money.map(x=>x.currency))];const unit=currencies.length===1?' '+currencies[0]:'';notes.push({kind:'conflict',sourceQuote:relation[0],message:`The customer states a shortfall of ${c}${unit}, but ${a} minus ${b} equals ${difference}${unit}. The translation preserves the stated amount.`});}}
  return notes;
}
export function checkEmailFacts(source,translation){
  const a=emailFacts(source),b=emailFacts(translation),issues=[],uncertain=[];
  const available=new Set([...b.values,...b.money].map(x=>x.value));
  // Presence, not occurrence count. Roles below supplement this limited check.
  for(const v of new Set([...a.values,...a.money].map(x=>x.value)))if(!available.has(v)){
    // Small numbers may be spelled out; avoid false certainty from incomplete parser.
    const words={0:'zero',1:'one',2:'two',3:'three',4:'four',5:'five',6:'six',7:'seven',8:'eight',9:'nine',10:'ten',15:'fifteen',20:'twenty',30:'thirty',40:'forty',50:'fifty',60:'sixty',100:'hundred'};
    if(words[v]&&new RegExp(`\\b${words[v]}\\b`,'i').test(translation))continue;
    issues.push(`source_number_missing_or_changed:${v}`);
  }
  for(const m of a.money){const matches=b.money.filter(x=>x.value===m.value);if(matches.length&&!matches.some(x=>x.currency===m.currency))issues.push(`currency_changed:${m.currency}:${m.value}`);else if(!matches.length)uncertain.push('A currency unit is omitted; equivalence is not independently verified.');}
  if(a.dates.length&&b.dates.length&&a.dates.some(d=>!b.dates.includes(d)))issues.push('date_boundary_changed');
  if(a.dates.length&&!b.dates.length)uncertain.push('The date format could not be independently verified.');
  if(a.fractions.length&&b.fractions.length&&a.fractions.some(f=>!b.fractions.includes(f)))issues.push('fraction_changed');
  if(/个百分点/.test(source)&&! /percentage points?/i.test(translation))issues.push('percentage_point_changed');
  for(const [zh,en] of [['本金','principal'],['利息','interest']]){const sm=source.match(new RegExp(`${zh}\\s*(${num})`));if(sm){const tm=translation.match(new RegExp(`${en}(?:\\s+(?:of|is|balance|amount))*\\s*(?:\\$|USD|USDT)?\\s*(${num})`,'i'));if(tm&&decimal(sm[1])!==decimal(tm[1]))issues.push(`financial_role_changed:${en}`);}}
  // Narrow supported direction check, not a claim to general role understanding.
  if(/我(?:向|给).{1,25}(?:转|支付)/.test(source)&&/I (?:have )?received .{0,40}from/i.test(translation))issues.push('payer_receiver_reversed');
  return {issues:[...new Set(issues)],uncertain:[...new Set(uncertain)],facts:a};
}
