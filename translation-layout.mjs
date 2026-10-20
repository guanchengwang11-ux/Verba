import { randomBytes } from 'node:crypto';

const LIST_PREFIX = /^(?:[-*+•]|\d+[.)、]|[A-Za-z][.)])(?=[ \t])/u;

function linesOf(text) {
  const pieces = String(text ?? '').split(/(\r\n|\r|\n)/u);
  const lines = [];
  for (let index = 0; index < pieces.length; index += 2) {
    const content = pieces[index];
    lines.push({
      content,
      newline: pieces[index + 1] || '',
      blank: !content.trim(),
      indent: content.match(/^[ \t]*/u)[0],
      trailing: content.match(/[ \t]*$/u)[0],
      listPrefix: content.trimStart().match(LIST_PREFIX)?.[0] || ''
    });
  }
  return lines;
}

function rebuild(lines, contents) {
  return lines.map((line, index) => {
    const body = line.blank ? line.content : line.indent + contents[index].trim() + line.trailing;
    return body + line.newline;
  }).join('');
}

function mapStrings(value, transform) {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map(item => mapStrings(item, transform));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, transform)]));
  }
  return value;
}

function markerPattern(context, exact = false) {
  if (exact) return new RegExp(`\\[\\[VERBA_LAYOUT_${context.nonce}_(\\d+)\\]\\]`, 'gu');
  // Only this request's nonce is removed, including a model's malformed indices
  // or casing. Literal tokens from the user's source have another nonce.
  return new RegExp(`(?:\\[\\[[ \\t]*)?VERBA_LAYOUT_${context.nonce}(?:_[A-Za-z0-9_-]*)?(?:[ \\t]*\\]{1,2})?`, 'giu');
}

/** Plain-text layout only: physical newlines, blank lines and indentation. */
export function prepareTranslationLayout(originalText, protectedText, enabled = false, targetLanguage = '') {
  const original = String(originalText ?? '');
  const text = String(protectedText ?? original);
  const sourceLines = linesOf(original);
  const protectedLines = linesOf(text);
  const context = { enabled: enabled === true, text, instruction: '', sourceLines, markers: [], nonce: '' };
  if (!context.enabled) return context;
  const aligned = sourceLines.length === protectedLines.length && sourceLines.every((line, index) => line.blank === protectedLines[index].blank);
  context.aligned = aligned;
  // A single physical line needs no transport markers. Never infer line
  // positions if an earlier protection step has changed the source structure.
  if (!aligned || sourceLines.length === 1 || sourceLines.every(line => line.blank)) return context;
  let nonce;
  do { nonce = randomBytes(8).toString('hex'); }
  while ((original + text).toLowerCase().includes(`verba_layout_${nonce}`));
  context.nonce = nonce;
  context.markers = sourceLines.flatMap((line, index) => line.blank ? [] : [{ index, token: `[[VERBA_LAYOUT_${nonce}_${index}]]` }]);
  const markers = new Map(context.markers.map(marker => [marker.index, marker.token]));
  context.text = protectedLines.map((line, index) => `${markers.get(index) || ''}${line.content}${line.newline}`).join('');
  context.instruction = `Plain-text layout preservation is enabled. The translation field must contain the actual translation into ${targetLanguage || 'the required target language'}, not a copy of the source text; englishMeaning is not a substitute for that translation. Treat every actual source newline as a hard line boundary; visual word wrapping is not a newline. Understand the whole message together, but translate each marked source line in its original order. In the translation field only, copy each [[VERBA_LAYOUT_${nonce}_number]] marker exactly once immediately before that line's translated text. Copy the markers verbatim, but translate the ordinary text after them into ${targetLanguage || 'the required target language'}. Keep each marked line's translated text on one physical line, with no new lines inside it. Preserve list bullets and numbering prefixes verbatim. Do not merge, omit, duplicate, reorder or redistribute content between source lines, and do not change facts to satisfy layout. Blank lines and indentation will be restored locally. These markers are transport metadata, not customer content: do not include them in englishMeaning or Source notes. Source notes must remain separate from the translation and quote the original source without transport markers. This is plain text; do not invent rich-text formatting.`;
  return context;
}

/** Pass this clone to factual/entity validators; keep the tagged result for finish. */
export function stripLayoutMarkersBeforeValidation(result, context) {
  if (!context?.enabled || !context.nonce) return mapStrings(result, text => text);
  return mapStrings(result, text => text.replace(markerPattern(context), ''));
}

function originalStructureMatches(translation, context) {
  const lines = linesOf(translation);
  return lines.length === context.sourceLines.length && lines.every((line, index) => {
    const source = context.sourceLines[index];
    return line.blank === source.blank && (line.blank || (line.indent === source.indent && line.listPrefix === source.listPrefix));
  });
}

/** Restore only boundaries proved by markers or an already matching structure. */
export function finishTranslationLayout(result, context) {
  const clean = stripLayoutMarkersBeforeValidation(result, context);
  if (!context?.enabled) return { ...clean, layoutStatus: 'off' };
  const raw = typeof result?.translation === 'string' ? result.translation : '';
  const translation = typeof clean?.translation === 'string' ? clean.translation : '';
  const unmatched = reason => ({ ...clean, layoutStatus: 'unmatched', layoutReason: reason });
  if (context.sourceLines.every(line => line.blank)) {
    return translation.trim() ? unmatched('source_empty') : { ...clean, translation: context.sourceLines.map(line => line.content + line.newline).join(''), layoutStatus: 'preserved' };
  }
  if (!translation.trim()) return unmatched('no_translation');
  const fallback = reason => {
    if (!originalStructureMatches(translation, context)) return unmatched(reason);
    return { ...clean, translation: rebuild(context.sourceLines, linesOf(translation).map(line => line.content)), layoutStatus: 'preserved' };
  };
  if (!context.markers.length) {
    if (context.sourceLines.length === 1 && !/[\r\n]/u.test(translation)) {
      if (translation.trimStart().match(LIST_PREFIX)?.[0] !== (context.sourceLines[0].listPrefix || undefined)) return unmatched('list_prefix_changed');
      return { ...clean, translation: rebuild(context.sourceLines, [translation]), layoutStatus: 'preserved' };
    }
    return fallback('source_line_structure_changed');
  }
  const matches = [...raw.matchAll(markerPattern(context, true))];
  const broadMatches = [...raw.matchAll(markerPattern(context))];
  if (matches.length !== context.markers.length || broadMatches.length !== matches.length) {
    // With no transport tokens at all, an already exact paragraph structure
    // remains usable. Partial or damaged tokens cannot prove content alignment.
    return broadMatches.length ? unmatched('markers_missing_or_malformed') : fallback('markers_missing_or_malformed');
  }
  if (!matches.every((match, index) => match[0] === context.markers[index].token)) return unmatched('markers_out_of_order');
  if (raw.slice(0, matches[0].index).trim()) return unmatched('unmarked_content');
  const contents = context.sourceLines.map(() => '');
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const content = raw.slice(match.index + match[0].length, matches[index + 1]?.index ?? raw.length).trim();
    if (!content || /[\r\n]/u.test(content)) return unmatched('source_line_structure_changed');
    const sourceIndex = context.markers[index].index;
    if ((content.match(LIST_PREFIX)?.[0] || '') !== context.sourceLines[sourceIndex].listPrefix) return unmatched('list_prefix_changed');
    contents[sourceIndex] = content;
  }
  return { ...clean, translation: rebuild(context.sourceLines, contents), layoutStatus: 'preserved' };
}
