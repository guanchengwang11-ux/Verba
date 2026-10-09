import { decimal } from './email-facts.mjs';
import { glossaryOccurrences } from './glossary.mjs';
const chineseDigits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const chineseUnits = { 十: 10, 百: 100, 千: 1000, 万: 10000, 亿: 100000000 };
const monthNumbers = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const currencyAliases = {
  "$": "USD", usd: "USD", 美元: "USD", 'US dollars': 'USD', 'US dollar': 'USD',
  cad: 'CAD', 加元: 'CAD', 'Canadian dollars': 'CAD', 'Canadian dollar': 'CAD',
  "¥": "CNY", "￥": "CNY", cny: "CNY", rmb: "CNY", 人民币: "CNY",
  "€": "EUR", eur: "EUR", 欧元: "EUR",
  "£": "GBP", gbp: "GBP", 英镑: "GBP",
  "₦": "NGN", ngn: "NGN", 奈拉: "NGN", naira: 'NGN',
  usdt: "USDT", 泰达币: "USDT", btc: "BTC", 比特币: "BTC", eth: "ETH", 以太坊: "ETH"
};
const normalizedCurrencyAliases=Object.fromEntries(Object.entries(currencyAliases).map(([key,value])=>[key.toLowerCase(),value]));
const englishNumberValues = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

const arabicNumber = String.raw`[+\-−]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)`;
const chineseNumber = String.raw`[零〇一二两三四五六七八九十百千万亿点]+`;
const scaledNumber = String.raw`(?:\d[\d,]*(?:\.\d+)?[十百千万亿])+(?:\d+)?`;
const englishNumberWord = String.raw`(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|point|and)`;
const englishNumber = `${englishNumberWord}(?:[\\s-]+${englishNumberWord})*`;
const anyNumber = `(?:${scaledNumber}|${arabicNumber}|${chineseNumber}|${englishNumber})`;
const currencyToken = Object.keys(currencyAliases).filter(key=>!/^[\p{Sc}]$/u.test(key)).sort((a,b)=>b.length-a.length).map(key=>key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');

function canonicalNumber(value) {
  const text = String(value || "").trim().replace(/,/g, "").replace('−','-');
  if (/^[+\-]?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(text)) {
    const negative=text.startsWith('-'),unsigned=text.replace(/^[+\-]/u,'').replace(/^\./u,'0.');
    const normalized=decimal(unsigned);return negative&&normalized!=='0'?'-'+normalized:normalized;
  }
  // Written mixed coefficients such as 2万5千 and 2.5万 are one amount.
  // Parse the coefficients and unit hierarchy, not their last digit fragment.
  if (/^(?:\d+(?:\.\d+)?[十百千万亿])+(?:\d+)?$/u.test(text)) {
    const tokens = text.match(/\d+(?:\.\d+)?|[十百千万亿]/gu);
    const precision = Math.max(...tokens.map(token => token.split(".")[1]?.length || 0));
    let total = 0n;
    let section = 0n;
    let coefficient = 0n;
    for (const token of tokens) {
      if (!(token in chineseUnits)) {
        const [whole, fraction = ""] = token.split(".");
        coefficient = BigInt(whole + fraction.padEnd(precision, "0"));
        continue;
      }
      const unit = BigInt(chineseUnits[token]);
      if (unit >= 10000n) {
        total += (section + coefficient) * unit;
        section = 0n;
      } else section += coefficient * unit;
      coefficient = 0n;
    }
    const digits = String(total + section + coefficient).padStart(precision + 1, "0");
    return decimal(precision ? `${digits.slice(0, -precision)}.${digits.slice(-precision)}` : digits);
  }
  if (/^[a-z\s-]+$/iu.test(text)) {
    const tokens = text.toLowerCase().split(/[\s-]+/u).filter((token) => token && token !== "and");
    if (!tokens.some(token => token in englishNumberValues || ["hundred", "thousand", "million", "billion"].includes(token))) return "";
    let total = 0n;
    let current = 0n;
    let decimal = "";
    let decimalMode = false;
    for (const token of tokens) {
      if (token === "point") { decimalMode = true; continue; }
      if (decimalMode) {
        if (!(token in englishNumberValues) || englishNumberValues[token] > 9) return "";
        decimal += englishNumberValues[token];
      } else if (token in englishNumberValues) current += BigInt(englishNumberValues[token]);
      else if (token === "hundred") current = (current || 1n) * 100n;
      else if (["thousand", "million", "billion"].includes(token)) {
        const scale = { thousand: 1000, million: 1000000, billion: 1000000000 }[token];
        total += (current || 1n) * BigInt(scale);
        current = 0n;
      } else return "";
    }
    const whole=String(total+current),fraction=decimal.replace(/0+$/u,'');
    return whole+(fraction?'.'+fraction:'');
  }
  if (!/^[零〇一二两三四五六七八九十百千万亿]+(?:点[零〇一二两三四五六七八九]+)?$/u.test(text)) return "";
  const [integerText, decimalText = ""] = text.split("点");
  const integer=/^[零〇一二两三四五六七八九]+$/u.test(integerText)
    ? decimal([...integerText].map(character=>chineseDigits[character]).join('')) : decimal(integerText);
  if(integer===null)return '';
  return decimal(`${integer}${decimalText?'.'+[...decimalText].map(character=>chineseDigits[character]).join(''):''}`);
}

function addMatches(text, regex, converter, output) {
  for (const match of text.matchAll(regex)) {
    const converted = converter(match);
    if (converted) output.push({ ...converted, start: match.index, end: match.index + match[0].length });
  }
}

export function extractDates(text) {
  const output = [];
  addMatches(text, /(?<![A-Za-z0-9_])(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/gu, (match) => ({ value: `${match[1]}-${Number(match[2])}-${Number(match[3])}` }), output);
  addMatches(text, /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/gu, (match) => ({ value: `${match[3]}-${Number(match[1])}-${Number(match[2])}` }), output);
  addMatches(text, /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/giu, (match) => ({ value: `${match[3]}-${monthNumbers[match[1].toLowerCase()]}-${Number(match[2])}` }), output);
  // Only inherit year/month within an explicit local date range.
  addMatches(text, /(\d{4})年(\d{1,2})月(\d{1,2})日?[ \t]*(?:至|到|[-~–—])[ \t]*(?:(\d{1,2})月)?(\d{1,2})日/gu, m=>({value:`${m[1]}-${Number(m[4]||m[2])}-${Number(m[5])}`}),output);
  return [...new Map(output.map(item=>[item.value+':'+item.start,item])).values()];
}

function extractFractions(text) {
  const output=[];
  const normalize=(numerator,denominator)=>{
    if(!/^\d+$/u.test(numerator)||!/^\d+$/u.test(denominator)||BigInt(denominator)===0n)return '';
    let a=BigInt(numerator),b=BigInt(denominator);while(b){const remainder=a%b;a=b;b=remainder;}
    return `${BigInt(numerator)/a}/${BigInt(denominator)/a}`;
  };
  addMatches(text,/(?<![\d/])(\d+)[ \t]*\/[ \t]*(\d+)(?![\d/])/gu,m=>({value:normalize(m[1],m[2])}),output);
  addMatches(text,/([零〇一二两三四五六七八九十百千万亿]+)分之([零〇一二两三四五六七八九十百千万亿]+)/gu,m=>({value:normalize(canonicalNumber(m[2]),canonicalNumber(m[1]))}),output);
  addMatches(text,/\bone[- ](half|third|quarter|tenth)\b/giu,m=>({value:`1/${{half:2,third:3,quarter:4,tenth:10}[m[1].toLowerCase()]}`}),output);
  return output.filter(item=>item.value);
}

export function extractCurrencies(text) {
  const output = [];
  const gap='[ \\t\\u00a0\\u202f]*',qualifier='(?:(?:多|余)(?:个|枚)?|个|枚|[+＋])?';
  const patterns=[
    new RegExp(`([+\\-−]?)([$€£¥￥₦])${gap}(${anyNumber})`,'giu'),
    new RegExp(`(${currencyToken})${gap}(${anyNumber})`,'giu'),
    new RegExp(`(${anyNumber})${gap}${qualifier}${gap}(${currencyToken})`,'giu')
  ];
  const literalRanges=[...String(text).matchAll(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu)].map(m=>({start:m.index,end:m.index+m[0].length}));
  patterns.forEach((pattern,index)=>{for(const match of String(text).matchAll(pattern)){
    const start=match.index,end=start+match[0].length,before=text[start-1]||'',after=text[end]||'';
    // Do not match a currency/number fragment inside an identifier or a word.
    if(/[A-Za-z0-9_]/u.test(before)||/[A-Za-z0-9_]/u.test(after)||literalRanges.some(r=>start<r.end&&r.start<end))continue;
    const unit=index===0?match[2]:index===1?match[1]:match[2],raw=index===0?match[1]+match[3]:index===1?match[2]:match[1];
    const number=canonicalNumber(raw);if(!number)continue;
    output.push({value:`${normalizedCurrencyAliases[unit.toLowerCase()]}:${number}`,start,end});
  }});
  // Prefix and suffix scans can see the same amount, e.g. USD 100 USDT. A span
  // is parsed once; a suffix currency cannot claim the next line's list number.
  const accepted=[];for(const item of output.sort((a,b)=>a.start-b.start||b.end-a.end))if(!accepted.some(r=>item.start<r.end&&r.start<item.end))accepted.push(item);
  return accepted;
}

function overlapsRange(start, end, ranges) {
  return ranges.some((range) => start < range.end && range.start < end);
}

function extractNumbers(text, excludedRanges) {
  const output = [];
  for (const match of text.matchAll(new RegExp(arabicNumber, "gu"))) {
    if (!overlapsRange(match.index, match.index + match[0].length, excludedRanges)) output.push(canonicalNumber(match[0]));
  }
  const chinesePattern = /(?:[零〇一二两三四五六七八九]*[十百千万亿][零〇一二两三四五六七八九十百千万亿点]*|[零〇一二两三四五六七八九]+(?=[个笔份项次名位人台封页天小时分钟%％]))/gu;
  for (const match of text.matchAll(chinesePattern)) {
    if (!overlapsRange(match.index, match.index + match[0].length, excludedRanges)) output.push(canonicalNumber(match[0]));
  }
  const englishQuantityPattern = new RegExp(`\\b(${englishNumber})\\b`, "giu");
  for (const match of text.matchAll(englishQuantityPattern)) {
    if (/^(?:and|point)$/iu.test(match[1])) continue;
    if (!overlapsRange(match.index, match.index + match[0].length, excludedRanges)) output.push(canonicalNumber(match[1]));
  }
  return output.filter(Boolean).sort();
}

function values(items) {
  return items.map((item) => item.value).sort();
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function analyzeFactualConstraints(text, {entityMap=[]}={}) {
  const source = String(text || "");
  const dates = extractDates(source);
  const entityRanges=entityMap.flatMap(entity=>glossaryOccurrences(source,entity.original,{ignoreCase:false}));
  const currencies = extractCurrencies(source).filter(amount=>!entityRanges.some(span=>amount.start>=span.start&&amount.end<=span.end));
  const fractions=extractFractions(source).filter(fraction=>!dates.some(span=>fraction.start<span.end&&span.start<fraction.end));
  const listMarkers=[...source.matchAll(/^[ \t]*\d{1,3}[.)、．）](?=[ \t]|[\p{Script=Han}])/gmu)].map(m=>({start:m.index,end:m.index+m[0].length}));
  const excludedRanges = [...dates, ...currencies,...entityRanges,...fractions,...listMarkers];
  const numbers = extractNumbers(source, excludedRanges);
  return {
    dates: values(dates),
    currencies: values(currencies),
    numbers,
    fractions:values(fractions),
    entityMap,
    hasFacts: Boolean(dates.length || currencies.length || numbers.length||fractions.length)
  };
}

export function evaluateFactualConstraints(text, constraints) {
  if (!constraints?.hasFacts) return [];
  const target = analyzeFactualConstraints(text,{entityMap:constraints.entityMap});
  const findings = [];
  if (constraints.dates.length && !sameValues(constraints.dates, target.dates)) {
    const changed=target.dates.some(value=>!constraints.dates.includes(value));
    findings.push({ code:changed?"date_value_changed":"date_expression_unverified",ruleId:changed?"FACT-DATE-001":"FACT-DATE-002",severity:changed?"block":"warning" });
  }
  if (constraints.currencies.length && !sameValues(constraints.currencies, target.currencies)) {
    const expected=[...new Set(constraints.currencies)],actual=[...new Set(target.currencies)];
    const missing=expected.filter(value=>!actual.includes(value)),added=actual.filter(value=>!expected.includes(value));
    const sourceUnits=new Set(expected.map(value=>value.split(':')[0])),targetUnits=new Set(actual.map(value=>value.split(':')[0]));
    // A repeated unit may be omitted locally when one unambiguous currency
    // remains. Record limited verification; never claim role/count equivalence.
    const omittedUnit=missing.length&&sourceUnits.size===1&&targetUnits.size===1&&[...sourceUnits][0]===[...targetUnits][0]&&missing.every(value=>target.numbers.includes(value.split(':')[1]));
    if(added.length||missing.length&&!omittedUnit)findings.push({code:"currency_or_amount_changed",ruleId:"FACT-CURRENCY-001",severity:"block"});
    else findings.push({code:omittedUnit?'currency_unit_unverified':'currency_repetition_unverified',ruleId:'FACT-CURRENCY-002',severity:'warning'});
  }
  if(constraints.fractions?.length&&!sameValues(constraints.fractions,target.fractions))findings.push({code:target.fractions.length?'fraction_value_changed':'fraction_expression_unverified',ruleId:target.fractions.length?'FACT-FRACTION-001':'FACT-FRACTION-002',severity:target.fractions.length?'block':'warning'});
  if (constraints.numbers.length && !sameValues(constraints.numbers, target.numbers)) {
    // This extractor is not a parser for every numeral idiom/classifier. A
    // different extraction count is uncertain coverage, not proof of a changed
    // value. Currency/amount pairs retain their independent blocking check.
    const comparable = constraints.numbers.length === target.numbers.length;
    findings.push({ code: comparable ? "numeric_value_changed" : "numeric_expression_unverified", ruleId: comparable ? "FACT-NUMBER-001" : "FACT-NUMBER-002", severity: comparable ? "block" : "warning" });
  }
  return findings;
}
