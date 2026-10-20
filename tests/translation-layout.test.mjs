import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTranslationLayout, stripLayoutMarkersBeforeValidation, finishTranslationLayout } from '../translation-layout.mjs';

const tagged = (context, lines) => context.markers.map((marker, index) => marker.token + lines[index]).join('\n');

test('layout restores physical paragraphs, blank lines, CRLF, indentation and trailing whitespace', () => {
  const source = '\r\n  Hello Alice.  \r\n\r\n\tPlease check 50 USDT.\r\n\r\n';
  const context = prepareTranslationLayout(source, source.replace('Alice', '[[VERBA_ENTITY_1]]'), true);
  assert.match(context.text, /VERBA_ENTITY_1/);
  assert.equal(context.markers.length, 2);
  const result = finishTranslationLayout({ translation: tagged(context, ['你好 Alice。', '请核实50 USDT。']), englishMeaning: 'Please check.', sourceNotes: [] }, context);
  assert.equal(result.translation, '\r\n  你好 Alice。  \r\n\r\n\t请核实50 USDT。\r\n\r\n');
  assert.equal(result.layoutStatus, 'preserved');
  assert.match(context.instruction, /whole message together/);
  assert.match(context.instruction, /translation field only/);
});

test('off is a non-mutating passthrough; single lines and clearing do not acquire markers', () => {
  const original = { translation: ' 原译文\n', sourceNotes: [{ message: 'A note.' }] };
  const off = prepareTranslationLayout('Line 1\nLine 2', undefined, false);
  const result = finishTranslationLayout(original, off);
  assert.deepEqual(result, { ...original, layoutStatus: 'off' });
  assert.notEqual(result.sourceNotes, original.sourceNotes);
  const single = prepareTranslationLayout('\tHello  ', undefined, true);
  assert.equal(single.markers.length, 0);
  assert.equal(finishTranslationLayout({ translation: '你好' }, single).translation, '\t你好  ');
  const empty = prepareTranslationLayout('', '', true);
  assert.deepEqual(finishTranslationLayout({ translation: '', sourceNotes: [] }, empty), { translation: '', sourceNotes: [], layoutStatus: 'preserved' });
});

test('layout instructions retain the target language and distinguish marker copying from translation', () => {
  for (const language of ['English', 'Simplified Chinese']) {
    const context = prepareTranslationLayout('First line\nSecond line', undefined, true, language);
    assert.ok(context.instruction.includes(`actual translation into ${language}`));
    assert.ok(context.instruction.includes(`translate the ordinary text after them into ${language}`));
    assert.match(context.instruction, /not a copy of the source text/);
    assert.match(context.instruction, /englishMeaning is not a substitute/);
  }
});

test('line markers are removed before validation and never leak through meaning or notes', () => {
  const context = prepareTranslationLayout('请核实50 USDT。\n谢谢。', undefined, true);
  const first = context.markers[0].token;
  const raw = {
    translation: tagged(context, ['Please check 50 USDT.', 'Thank you.']),
    englishMeaning: first + 'Please check 50 USDT.',
    sourceNotes: [{ kind: 'ambiguity', sourceQuote: first + '请核实50 USDT。', message: first + 'Please confirm the account.' }]
  };
  const clean = stripLayoutMarkersBeforeValidation(raw, context);
  assert.doesNotMatch(JSON.stringify(clean), /VERBA_LAYOUT/);
  assert.match(raw.translation, /VERBA_LAYOUT/);
  const done = finishTranslationLayout(raw, context);
  assert.equal(done.translation, 'Please check 50 USDT.\nThank you.');
  assert.equal(done.sourceNotes[0].message, 'Please confirm the account.');
  // Copying the translation field cannot include either notes or a meaning field.
  assert.doesNotMatch(done.translation, /confirm the account|ambiguity/);
});

test('bad, repeated or reordered markers cannot manufacture missing boundaries', () => {
  const context = prepareTranslationLayout('Hello\n\nGoodbye', undefined, true);
  const [a, b] = context.markers.map(marker => marker.token);
  for (const translation of [
    '你好再见',
    a + '你好' + a + '再见',
    b + '再见' + a + '你好',
    a + '你好' + b.replace('_2]]', '_999]]') + '再见',
    a.toLowerCase() + '你好' + b + '再见',
    a + '你好\n附加文字' + b + '再见',
    '额外文字' + a + '你好' + b + '再见'
  ]) {
    const result = finishTranslationLayout({ translation }, context);
    assert.equal(result.layoutStatus, 'unmatched', translation);
    assert.doesNotMatch(result.translation, new RegExp(context.nonce, 'i'));
  }
});

test('an already matching unmarked structure is accepted, without guessing paragraph breaks', () => {
  const context = prepareTranslationLayout(' Hello\n\n\tGoodbye\n', undefined, true);
  const result = finishTranslationLayout({ translation: ' 你好\n\n\t再见\n' }, context);
  assert.equal(result.layoutStatus, 'preserved');
  assert.equal(result.translation, ' 你好\n\n\t再见\n');
  assert.equal(finishTranslationLayout({ translation: '你好\n\n再见' }, context).layoutStatus, 'unmatched');
});

test('a coincidental line count cannot certify reordered, duplicated or truncated transport markers', () => {
  const context = prepareTranslationLayout('Hello\nGoodbye', undefined, true);
  const [a, b] = context.markers.map(marker => marker.token);
  for (const translation of [
    b + '再见\n' + a + '你好',
    a + '你好\n' + a + '再见',
    a + '你好\n再见',
    a + '你好\n' + b.replace(/_1\]\]$/u, '_]]') + '再见',
    a + '你好\n' + b.replace(/_1\]\]$/u, ']]') + '再见'
  ]) {
    const result = finishTranslationLayout({ translation }, context);
    assert.equal(result.layoutStatus, 'unmatched');
    assert.doesNotMatch(result.translation, new RegExp(context.nonce, 'i'));
  }
});

test('list prefixes are checked but never replaced or repaired locally', () => {
  const context = prepareTranslationLayout('1. Check the amount\n  - Ask Alice\n2. Wait', undefined, true);
  const good = tagged(context, ['1. 核实金额', '- 询问 Alice', '2. 等待']);
  assert.equal(finishTranslationLayout({ translation: good }, context).translation, '1. 核实金额\n  - 询问 Alice\n2. 等待');
  const bad = tagged(context, ['2. 核实金额', '- 询问 Alice', '1. 等待']);
  const result = finishTranslationLayout({ translation: bad }, context);
  assert.equal(result.layoutStatus, 'unmatched');
  assert.match(result.translation, /^2\. 核实金额/);
});

test('literal marker-looking source text survives and nonce is per request', () => {
  const source = 'Keep [[VERBA_LAYOUT_literal_0]] exactly.\nNext line.';
  const first = prepareTranslationLayout(source, undefined, true);
  const second = prepareTranslationLayout(source, undefined, true);
  assert.notEqual(first.nonce, second.nonce);
  const raw = { translation: tagged(first, ['保留 [[VERBA_LAYOUT_literal_0]]。', '下一行。']), sourceNotes: [{ sourceQuote: '[[VERBA_LAYOUT_literal_0]]', message: 'Literal content.' }] };
  const result = finishTranslationLayout(raw, first);
  assert.equal(result.layoutStatus, 'preserved');
  assert.match(result.translation, /\[\[VERBA_LAYOUT_literal_0\]\]/);
  assert.equal(result.sourceNotes[0].sourceQuote, '[[VERBA_LAYOUT_literal_0]]');
  assert.doesNotMatch(result.translation, new RegExp(first.nonce));
});

test('protection line mismatch is uncertain, whitespace-only text and CR-only breaks remain safe', () => {
  const context = prepareTranslationLayout('Hello\n\nGoodbye', '[[VERBA_ENTITY_1]]', true);
  assert.equal(context.aligned, false);
  assert.equal(context.markers.length, 0);
  assert.equal(finishTranslationLayout({ translation: '你好再见' }, context).layoutStatus, 'unmatched');
  assert.equal(finishTranslationLayout({ translation: '你好\n\n再见' }, context).layoutStatus, 'preserved');
  const blank = prepareTranslationLayout(' \r\t\r', undefined, true);
  assert.equal(finishTranslationLayout({ translation: '' }, blank).translation, ' \r\t\r');
  assert.equal(finishTranslationLayout({ translation: 'invented' }, blank).layoutStatus, 'unmatched');
  const cr = prepareTranslationLayout('A\rB', undefined, true);
  assert.equal(finishTranslationLayout({ translation: tagged(cr, ['甲', '乙']) }, cr).translation, '甲\r乙');
});
