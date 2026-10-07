window.VerbaI18n.ready.then(() => {
  const i18n = window.VerbaI18n;
  const panel = document.createElement('section');
  panel.id = 'translationReview'; panel.hidden = true;
  panel.setAttribute('role','alert');
  panel.style.cssText = 'margin:12px 0;padding:14px;border:1px solid #d4ad56;border-radius:10px;background:#fff9e9;color:#493b20';
  const heading = document.createElement('strong'), description = document.createElement('p'), list = document.createElement('ul'), retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'model-refresh'; retry.id = 'retryReviewedTranslation';
  retry.addEventListener('click', () => document.querySelector('#translateButton').click());
  panel.append(heading,description,list,retry);
  document.querySelector('#translatedText').before(panel);
  let current;
  function render(data={}) {
    current = data;
    const issues = data.translationReview?.issues || [];
    panel.hidden = !issues.length; list.replaceChildren();
    heading.textContent = i18n.t('review.title'); description.textContent = i18n.t('review.description'); retry.textContent = i18n.t('common.retry');
    for (const issue of issues) {
      const item = document.createElement('li');
      item.textContent = issue.code === 'glossary_target_missing' ? i18n.t('review.glossary', {source:issue.sourceTerm,target:issue.requiredTarget}) : i18n.t('review.relation');
      list.append(item);
    }
  }
  window.VerbaTranslationReview = {render};
  window.addEventListener('verba:locale-changed',()=>render(current));
});
