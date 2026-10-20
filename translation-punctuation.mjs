import {detectEntities,isPreserveExactlyGlossaryEntry} from './entity-protection.mjs';
import {activeGlossary,glossaryOccurrences} from './glossary.mjs';

export const PUNCTUATION_STYLE = 'comma-only/v1';

function protectedCharacters(text, {sourceText='',glossary=[],entityMap=[]}) {
  const mask=new Uint8Array(text.length);
  const protect=(start,end)=>mask.fill(1,start,end);
  const exact=value=>{
    if(!value)return;
    for(const span of glossaryOccurrences(text,value,{ignoreCase:false}))protect(span.start,span.end);
  };
  // These values have already passed the existing source-grounded checks.
  // Formatting must not change exact names, literals or mandatory wording.
  for(const entity of entityMap)if(entity.type!=='url')exact(entity.original);
  for(const entry of activeGlossary(sourceText,glossary))exact(isPreserveExactlyGlossaryEntry(entry)?entry.source:entry.target);
  const labelledIdentifier=/(?:\b(?:account|username|user[ \t]+name|identifier)[ \t:：]+|(?:账号|账户|用户名)[ \t:：]*)([\p{L}\p{N}_.．@+:/−-]+)/giu;
  for(const match of String(sourceText).matchAll(labelledIdentifier))exact(match[1].replace(/[.,!?;:]+$/u,''));
  for(const span of detectEntities(text))if(span.type!=='url')protect(span.start,span.end);
  // A Chinese sentence can follow a URL without a separating space. Do not
  // accidentally protect that sentence as part of the address.
  for(const match of text.matchAll(/https?:\/\/[^\s<>"'，。！？；：]+|www\.[^\s<>"'，。！？；：]+/giu)){
    const url=match[0].replace(/[.,!?;:…]+$/u,'');protect(match.index,match.index+url.length);
  }
  const patterns=[
    // Monetary signs, decimal/thousands separators, dates, times, ratios,
    // fractions and version components are data punctuation, not sentence ends.
    /[+＋−－-]?(?:[￥¥$€£₦][ \t]*)?(?:[\d０-９]+(?:[.,．，:/：／−－-][\d０-９]+)*|[.．][\d０-９]+)(?:[eE][+＋−－-]?[\d０-９]+)?(?:[ \t]*(?:%|％|‰))?/gu,
    /[(（][+＋−－-]?[￥¥$€£₦]?[ \t]*[\d０-９][\d０-９.,．，]*(?:[ \t]*(?:USD|USDT|EUR|GBP|NGN|CAD|CNY|RMB|美元|元))?[ \t]*[)）]/gu,
    // Preserve lexical apostrophes/hyphens: changing don't or O'Neill changes
    // the word, even though prose quotes and dashes can be reformatted.
    /[\p{L}\p{N}]+(?:['’\-/][\p{L}\p{N}]+)+/gu,
    /\b(?:[A-Z]\.[ \t]*)+[A-Z][a-z]+(?:[ '-][A-Z][a-z]+)*/gu,
    /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St)\.(?=[ \t]+[A-Z])/gu,
    /\b[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.[a-z]{2,24}\b/gu,
    /(?:[A-Za-z]:\\|\\\\)[^\s，。！？；]+/gu,
    labelledIdentifier,
    /(?:^|[\r\n])[ \t]*(?:[-*+•]|\d+[.)、]|[A-Za-z][.)])(?=[ \t])/gu
  ];
  for(const pattern of patterns)for(const match of text.matchAll(pattern)){
    const raw=match[1]||match[0];
    const trimTerminator=Boolean(match[1])||/^(?:[A-Za-z]:\\|\\\\)/u.test(raw);
    const value=trimTerminator?raw.replace(/[.,!?;:]+$/u,''):raw;
    const start=match.index+(match[1]?match[0].lastIndexOf(raw):0);
    protect(start,start+value.length);
  }
  return mask;
}

/** Presentation only; original text, validation evidence and Source notes stay intact. */
export function formatTranslationPunctuation(text, options={}) {
  const value=String(text??''),mask=protectedCharacters(value,options);
  const comma=options.direction==='enToZh'?'，':',';
  const pieces=value.split(/(\r\n|\r|\n)/u);
  let offset=0;
  return pieces.map((line,index)=>{
    const start=offset;offset+=line.length;
    if(index%2||!line.trim())return line;
    const indent=line.match(/^[ \t]*/u)[0],trailing=line.match(/[ \t]*$/u)[0];
    const end=line.length-trailing.length;
    let output='',pending=false;
    for(let i=indent.length;i<end;){
      const character=String.fromCodePoint(line.codePointAt(i));
      if(!mask[start+i]&&/\p{P}/u.test(character)){
        output=output.trimEnd();pending=Boolean(output);i+=character.length;continue;
      }
      if(pending&&/[ \t]/u.test(character)){i+=character.length;continue;}
      if(pending){output+=comma+(options.direction==='enToZh'?'':' ');pending=false;}
      output+=character;i+=character.length;
    }
    // An unflushed punctuation run is the line ending, not a comma to append.
    return indent+output+trailing;
  }).join('');
}
