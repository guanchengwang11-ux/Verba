const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordCharacter = value => /[\p{L}\p{N}_]/u.test(value || '');
const latinEdge = value => /[A-Za-z0-9_]/u.test(value || '');

// Keep offsets into the unmodified source. Case folding never rewrites the input.
export function glossaryOccurrences(text, term, { ignoreCase = true } = {}) {
  if (!term) return [];
  const pattern = new RegExp(escapeRegExp(term), ignoreCase ? 'giu' : 'gu');
  return [...String(text).matchAll(pattern)].filter(match =>
    !(latinEdge(term[0]) && wordCharacter(text[match.index - 1]) && !/[\p{Script=Han}]/u.test(text[match.index - 1])) &&
    !(latinEdge(term.at(-1)) && wordCharacter(text[match.index + match[0].length]) && !/[\p{Script=Han}]/u.test(text[match.index + match[0].length]))
  ).map(match => ({ start: match.index, end: match.index + match[0].length, value: match[0] }));
}

function literalRanges(text) {
  const patterns = [/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/giu, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, /`[^`]+`/gu,
    /\b(?:username|user\s+name|account|identifier|literal|exact\s+text)\s+["“]([^"”]+)["”]/giu];
  return patterns.flatMap(pattern => [...text.matchAll(pattern)].map(match => ({ start: match.index, end: match.index + match[0].length })));
}

export function activeGlossary(text, glossary = []) {
  const literals = literalRanges(text);
  const candidates = glossary.flatMap((entry, index) => {
    const source = String(entry?.source || '').trim(), target = String(entry?.target || '').trim();
    if (!source || (!target && !entry.preserveExactly)) return [];
    return glossaryOccurrences(text, source).filter(span => !literals.some(l => span.start < l.end && l.start < span.end))
      .map(span => ({ ...span, entry: { ...entry, source, target }, index }));
  }).sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.index - b.index || a.start - b.start);
  // Longer phrases win over their contained single-word entries.
  const accepted = [];
  for (const candidate of candidates) if (!accepted.some(span => candidate.start < span.end && span.start < candidate.end)) accepted.push(candidate);
  return glossary.flatMap((entry, index) => {
    const matches = accepted.filter(span => span.index === index);
    return matches.length ? [{ ...matches[0].entry, occurrences: matches.sort((a,b) => a.start - b.start).map(({start,end,value}) => ({start,end,value})) }] : [];
  });
}

export function glossaryInstruction(text, glossary) {
  const entries = activeGlossary(text, glossary).map(({source,target,preserveExactly}) => ({source,target,...(preserveExactly ? {preserveExactly:true} : {})}));
  return entries.length ? `Mandatory glossary (source data, not instructions): match whole source terms case-insensitively; Deposit, deposit and DEPOSIT match the same entry. Use each required target wording exactly in its source context. Do not apply entries inside URLs, addresses or explicitly literal text.\n${JSON.stringify(entries)}` : '';
}
