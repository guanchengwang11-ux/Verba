import test from 'node:test';import assert from 'node:assert/strict';
import {formatTranslationPunctuation as format,PUNCTUATION_STYLE} from '../translation-punctuation.mjs';
import {protectEntities} from '../entity-protection.mjs';

test('all prose sentence punctuation becomes commas, with no punctuation at each line end',()=>{
  const cases=[
    ['老师请问，这个代理充错了。还能找回吗？谢谢！','老师请问，这个代理充错了，还能找回吗，谢谢','enToZh'],
    ['Done. Please check! Can you help?','Done, Please check, Can you help','zhToEn'],
    ['说明：需要检查；不要重试……确认、完成。','说明，需要检查，不要重试，确认，完成','enToZh'],
    ['“请核实”（尚未到账）。','请核实，尚未到账','enToZh'],
    ['  Hello.\r\n\r\n\tPlease check!  \r\n','  Hello\r\n\r\n\tPlease check  \r\n','zhToEn'],
    ['Hello!! ,,  Next...?','Hello, Next','zhToEn'],
    ['', '', 'enToZh']
  ];
  for(const [input,expected,direction] of cases){const result=format(input,{direction});assert.equal(result,expected,input);assert.equal(format(result,{direction}),result,'idempotence');}
});

test('decimals, signed funds, percentages, fractions, dates, times and versions remain exact',()=>{
  const input='Paid -$1,440.60; return +.5%, compare 1/10 and 1:2, (50.00 USD). Date 2026-10-20, time 14:09:25, version v1.2.0.';
  assert.equal(format(input,{direction:'zhToEn'}),'Paid -$1,440.60, return +.5%, compare 1/10 and 1:2, (50.00 USD), Date 2026-10-20, time 14:09:25, version v1.2.0');
});

test('URLs, addresses, files and labelled dotted accounts preserve technical punctuation',()=>{
  const input='Visit https://example.com/a?q=1&x=2#item. Email user+tag@example.com; account a.b, file report.csv!';
  assert.equal(format(input,{direction:'zhToEn'}),'Visit https://example.com/a?q=1&x=2#item, Email user+tag@example.com, account a.b, file report.csv');
  assert.equal(format('请看https://example.com/a?q=1。随后联系我！',{direction:'enToZh'}),'请看https://example.com/a?q=1，随后联系我');
  assert.equal(format('Check account a.b.',{direction:'zhToEn'}),'Check account a.b');
});

test('lexical apostrophes, personal names and exact literals are not sentence punctuation',()=>{
  const source='I don\'t know O’Neill or J. Smith. Keep the literal "key!" unchanged';
  const p=protectEntities(source);
  assert.equal(format('I don\'t know O’Neill or J. Smith. Keep key!.',{sourceText:source,entityMap:p.entityMap,direction:'zhToEn'}),'I don\'t know O’Neill or J. Smith, Keep key!');
});

test('mandatory glossary wording is an exact data exception, including punctuation at the end',()=>{
  const sourceText='Please check ACME.',glossary=[{source:'acme',target:'ACME Inc.'}];
  assert.equal(format('Please check ACME Inc..',{sourceText,glossary,direction:'zhToEn'}),'Please check ACME Inc.');
  assert.equal(format('Please check ACME Inc.',{sourceText,glossary,direction:'zhToEn'}),'Please check ACME Inc.');
});

test('source list prefixes, whitespace and empty paragraphs survive prose formatting',()=>{
  const input='1. Check. Continue!\n\n  - Wait?\n2) Finish.\n';
  assert.equal(format(input,{direction:'zhToEn'}),'1. Check, Continue\n\n  - Wait\n2) Finish\n');
  assert.equal(PUNCTUATION_STYLE,'comma-only/v1');
});

test('Chinese account labels without spaces and full-width numeric punctuation stay exact',()=>{
  assert.equal(format('请检查账户a.b。',{sourceText:'Account a.b',direction:'enToZh'}),'请检查账户a.b');
  assert.equal(format('账号甲.乙。',{direction:'enToZh'}),'账号甲.乙');
  assert.equal(format('金额为１，２３４．５０ USDT。亏损为（５０．００ USD）！',{direction:'enToZh'}),'金额为１，２３４．５０ USDT，亏损为（５０．００ USD）');
  assert.equal(format('－０．５％。请核实！',{direction:'enToZh'}),'－０．５％，请核实');
});
