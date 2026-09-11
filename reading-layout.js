// Measure off-screen instead of collapsing the live editor: selection and page
// position stay intact while shorter content can shrink back to its minimum.
window.VerbaI18n.ready.then(() => {
  const source=document.querySelector('#sourceText');
  const result=document.querySelector('#translatedText');
  const label=document.querySelector('.result-label');
  const panes=document.querySelector('.translation-panes');
  const mirror=document.createElement('div');
  mirror.setAttribute('aria-hidden','true');
  mirror.style.cssText='position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:anywhere;box-sizing:border-box;padding:0;border:0;';
  document.body.append(mirror);
  function measure(element,text) {
    const style=getComputedStyle(element);
    mirror.style.width=element.clientWidth+'px';
    mirror.style.font=style.font;
    mirror.style.letterSpacing=style.letterSpacing;
    mirror.style.tabSize=style.tabSize;
    mirror.textContent=text+'\u200b';
    return Math.ceil(mirror.getBoundingClientRect().height);
  }
  function layout() {
    scheduled=false;
    const desktop=window.matchMedia('(min-width:621px)').matches;
    const minimum=desktop?172:120;
    const sourceHeight=Math.max(minimum,measure(source,source.value));
    const resultHeight=Math.max(minimum,measure(result,result.textContent));
    panes.style.setProperty('--source-body-height',(desktop?Math.max(sourceHeight,resultHeight):sourceHeight)+'px');
    panes.style.setProperty('--result-body-height',(desktop?Math.max(sourceHeight,resultHeight):resultHeight)+'px');
    panes.style.setProperty('--body-offset',(label.getBoundingClientRect().height+17)+'px');
  }
  let scheduled=false;
  function schedule() { if(!scheduled){scheduled=true;requestAnimationFrame(layout);} }
  source.addEventListener('input',schedule);
  document.addEventListener('verba:restore-history',schedule);
  new MutationObserver(schedule).observe(result,{childList:true,subtree:true,characterData:true});
  new MutationObserver(schedule).observe(label,{childList:true,subtree:true,characterData:true,attributes:true});
  const widths=new WeakMap();
  new ResizeObserver(entries=>{for(const e of entries){if(widths.get(e.target)!==e.contentRect.width){widths.set(e.target,e.contentRect.width);schedule();}}}).observe(panes);
  window.addEventListener('resize',schedule);
  document.fonts.ready.then(schedule);
  document.fonts.addEventListener('loadingdone',schedule);
  schedule();
});
