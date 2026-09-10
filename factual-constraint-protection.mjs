const chineseDigits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const chineseUnits = { 十: 10, 百: 100, 千: 1000, 万: 10000, 亿: 100000000 };
const monthNumbers = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const currencyAliases = {
  "$": "USD", usd: "USD", 美元: "USD",
  "¥": "CNY", "￥": "CNY", cny: "CNY", rmb: "CNY", 人民币: "CNY",
  "€": "EUR", eur: "EUR", 欧元: "EUR",
  "£": "GBP", gbp: "GBP", 英镑: "GBP",
  "₦": "NGN", ngn: "NGN", 奈拉: "NGN",
  usdt: "USDT", 泰达币: "USDT", btc: "BTC", 比特币: "BTC", eth: "ETH", 以太坊: "ETH"
};
const englishNumberValues = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

const arabicNumber = String.raw`\d[\d,]*(?:\.\d+)?`;
const chineseNumber = String.raw`[零〇一二两三四五六七八九十百千万亿点]+`;
const scaledNumber = String.raw`(?:\d[\d,]*(?:\.\d+)?[十百千万亿])+(?:\d+)?`;
const englishNumberWord = String.raw`(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|point|and)`;
const englishNumber = `${englishNumberWord}(?:[\\s-]+${englishNumberWord})*`;
const anyNumber = `(?:${scaledNumber}|${arabicNumber}|${chineseNumber}|${englishNumber})`;
const currencyToken = String.raw`(?:USDT|USD|CNY|RMB|EUR|GBP|NGN|BTC|ETH|美元|人民币|欧元|英镑|奈拉|泰达币|比特币|以太坊)`;

function canonicalNumber(value) {
  const text = String(value || "").trim().replace(/,/g, "");
  if (/^\d+(?:\.\d+)?$/u.test(text)) return String(Number(text));
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
    return String(Number(precision ? `${digits.slice(0, -precision)}.${digits.slice(-precision)}` : digits));
  }
  if (/^[a-z\s-]+$/iu.test(text)) {
    const tokens = text.toLowerCase().split(/[\s-]+/u).filter((token) => token && token !== "and");
    if (!tokens.some(token => token in englishNumberValues || ["hundred", "thousand", "million", "billion"].includes(token))) return "";
    let total = 0;
    let current = 0;
    let decimal = "";
    let decimalMode = false;
    for (const token of tokens) {
      if (token === "point") { decimalMode = true; continue; }
      if (decimalMode) {
        if (!(token in englishNumberValues) || englishNumberValues[token] > 9) return "";
        decimal += englishNumberValues[token];
      } else if (token in englishNumberValues) current += englishNumberValues[token];
      else if (token === "hundred") current = (current || 1) * 100;
      else if (["thousand", "million", "billion"].includes(token)) {
        const scale = { thousand: 1000, million: 1000000, billion: 1000000000 }[token];
        total += (current || 1) * scale;
        current = 0;
      } else return "";
    }
    return String(Number(`${total + current}${decimal ? `.${decimal}` : ""}`));
  }
  if (!/^[零〇一二两三四五六七八九十百千万亿点]+$/u.test(text)) return "";
  const [integerText, decimalText = ""] = text.split("点");
  let integer;
  if (!/[十百千万亿]/u.test(integerText)) {
    integer = Number([...integerText].map((character) => chineseDigits[character]).join(""));
  } else {
    let total = 0;
    let section = 0;
    let digit = 0;
    for (const character of integerText) {
      if (character in chineseDigits) {
        digit = chineseDigits[character];
      } else {
        const unit = chineseUnits[character];
        if (unit >= 10000) {
          section = (section + digit) * unit;
          total += section;
          section = 0;
        } else {
          section += (digit || 1) * unit;
        }
        digit = 0;
      }
    }
    integer = total + section + digit;
  }
  const decimal = decimalText ? `.${[...decimalText].map((character) => chineseDigits[character]).join("")}` : "";
  return Number.isFinite(integer) ? String(Number(`${integer}${decimal}`)) : "";
}

function addMatches(text, regex, converter, output) {
  for (const match of text.matchAll(regex)) {
    const converted = converter(match);
    if (converted) output.push({ ...converted, start: match.index, end: match.index + match[0].length });
  }
}

function extractDates(text) {
  const output = [];
  addMatches(text, /\b(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/gu, (match) => ({ value: `${match[1]}-${Number(match[2])}-${Number(match[3])}` }), output);
  addMatches(text, /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/gu, (match) => ({ value: `${match[3]}-${Number(match[1])}-${Number(match[2])}` }), output);
  addMatches(text, /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/giu, (match) => ({ value: `${match[3]}-${monthNumbers[match[1].toLowerCase()]}-${Number(match[2])}` }), output);
  return output;
}

export function extractCurrencies(text) {
  const output = [];
  addMatches(text, new RegExp(`([$€£¥￥₦])\\s*(${anyNumber})`, "gu"), (match) => ({ value: `${currencyAliases[match[1]]}:${canonicalNumber(match[2])}` }), output);
  addMatches(text, new RegExp(`\\b(${currencyToken})\\s*(${anyNumber})`, "giu"), (match) => ({ value: `${currencyAliases[match[1].toLowerCase()] || currencyAliases[match[1]]}:${canonicalNumber(match[2])}` }), output);
  addMatches(text, new RegExp(`(${anyNumber})\\s*(${currencyToken})`, "giu"), (match) => ({ value: `${currencyAliases[match[2].toLowerCase()] || currencyAliases[match[2]]}:${canonicalNumber(match[1])}` }), output);
  return output.filter((item) => !item.value.endsWith(":"));
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

export function analyzeFactualConstraints(text) {
  const source = String(text || "");
  const dates = extractDates(source);
  const currencies = extractCurrencies(source);
  const excludedRanges = [...dates, ...currencies];
  const numbers = extractNumbers(source, excludedRanges);
  return {
    dates: values(dates),
    currencies: values(currencies),
    numbers,
    hasFacts: Boolean(dates.length || currencies.length || numbers.length)
  };
}

export function evaluateFactualConstraints(text, constraints) {
  if (!constraints?.hasFacts) return [];
  const target = analyzeFactualConstraints(text);
  const findings = [];
  if (constraints.dates.length && !sameValues(constraints.dates, target.dates)) {
    findings.push({ code: target.dates.length ? "date_value_changed" : "date_expression_unverified", ruleId: target.dates.length ? "FACT-DATE-001" : "FACT-DATE-002", severity: target.dates.length ? "block" : "warning" });
  }
  if (constraints.currencies.length && !sameValues(constraints.currencies, target.currencies)) {
    findings.push({ code: "currency_or_amount_changed", ruleId: "FACT-CURRENCY-001", severity: "block" });
  }
  if (constraints.numbers.length && !sameValues(constraints.numbers, target.numbers)) {
    // This extractor is not a parser for every numeral idiom/classifier. A
    // different extraction count is uncertain coverage, not proof of a changed
    // value. Currency/amount pairs retain their independent blocking check.
    const comparable = constraints.numbers.length === target.numbers.length;
    findings.push({ code: comparable ? "numeric_value_changed" : "numeric_expression_unverified", ruleId: comparable ? "FACT-NUMBER-001" : "FACT-NUMBER-002", severity: comparable ? "block" : "warning" });
  }
  return findings;
}
