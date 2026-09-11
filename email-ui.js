window.VerbaI18n.ready.then(()=>{
  const pane=document.querySelector('.result-pane');
  const notes=document.createElement('section');notes.id='sourceNotes';notes.hidden=true;notes.setAttribute('aria-live','polite');notes.style.cssText='margin:16px 0;padding:14px;border:1px solid #d4ad56;border-radius:10px;background:#fff9e9;color:#493b20';
  const status=document.createElement('strong');status.id='sourceStatus';
  const title=document.createElement('h3');title.textContent='Source notes';title.style.fontSize='14px';
  const list=document.createElement('div');notes.append(status,title,list);pane.insertBefore(notes,document.querySelector('.result-footer'));
  const confidence=document.querySelector('.confidence'),meaning=document.querySelector('#meaningCheck');
  const label=document.querySelector('[data-i18n="translationLabel"]');
  let email=false;
  function mode(mode,direction){email=mode==='email'&&direction==='zhToEn';confidence.hidden=email;meaning.hidden=email;if(email){label.removeAttribute('data-i18n');label.textContent='Translation';}else{label.setAttribute('data-i18n','translationLabel');label.textContent=VerbaI18n.t('translationLabel');}}
  function render(data={}){
    list.replaceChildren();notes.hidden=!data.sourceNotes?.length;status.textContent=data.status==='clarification_required'?'Clarification needed':data.status==='review_required'?'Translation needs review':'Source requires attention';
    for(const n of data.sourceNotes||[]){const p=document.createElement('p');p.textContent=n.message;list.append(p);if(n.sourceQuote){const q=document.createElement('small');q.textContent=n.sourceQuote;list.append(q);}}
    document.querySelector('#copyText').disabled=['clarification_required','review_required'].includes(data.status);
  }
  window.VerbaEmailView={mode,render};
});
