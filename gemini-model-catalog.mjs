// Reviewed against Google's Standard-tier pricing and lifecycle pages.
// Eligibility is not evidence of the key's billing tier or remaining quota.
export const GEMINI_CATALOG_CHECKED_AT = '2026-10-20';
export const GEMINI_CATALOG_SOURCES = [
  'https://ai.google.dev/gemini-api/docs/pricing',
  'https://ai.google.dev/gemini-api/docs/deprecations',
  'https://ai.google.dev/api/models',
  'https://ai.google.dev/gemini-api/docs/billing'
];
const catalog = [
  {id:'gemini-3.5-flash-lite',efficiency:0,generation:2},
  {id:'gemini-3.8-flash',efficiency:3,generation:0},
  {id:'gemini-3.6-flash',efficiency:3,generation:1},
  {id:'gemini-3.1-flash-lite',efficiency:1,generation:3,legacy:true,shutdownDate:'2027-05-07'},
  {id:'gemini-2.5-flash-lite',efficiency:2,generation:6,legacy:true},
  {id:'gemini-2.5-flash',efficiency:4,generation:5,legacy:true},
  {id:'gemini-2.5-pro',efficiency:5,generation:4,legacy:true}
];
export function geminiCatalogEntry(id, now=Date.now()) {
  return catalog.find(m=>m.id===id&&(!m.shutdownDate||Date.parse(m.shutdownDate)>now)) || null;
}
export function geminiModelChoices(models=[], health={}, {now=Date.now()}={}) {
  const eligible=[...new Set(models)].map(id=>geminiCatalogEntry(id,now)).filter(Boolean);
  const fresh = h => h && Number.isFinite(h.probeLatencyMs) && h.probeLatencyMs>0 && now-Date.parse(h.probeCheckedAt)<86400000;
  const times=eligible.map(m=>health[m.id]).filter(fresh).map(h=>h.probeLatencyMs).sort((a,b)=>a-b);
  // Ordinal product recommendations, not measured accuracy or a confidence
  // score: 40% comparable short-probe latency, 35% efficiency positioning,
  // 25% model generation/capability positioning. Missing latency is neutral.
  const score=m=>{
    const h=health[m.id],latency=fresh(h)&&times.length>1?times.indexOf(h.probeLatencyMs)/(times.length-1):0.5;
    return 0.40*latency+0.35*m.efficiency/6+0.25*m.generation/6+(m.legacy?0.15:0);
  };
  return eligible.filter(m=>!(health[m.id]?.status==='unhealthy'&&[401,403,404,429].includes(health[m.id].httpStatus)&&now-Date.parse(health[m.id].checkedAt)<3600000))
    .sort((a,b)=>score(a)-score(b)||catalog.indexOf(a)-catalog.indexOf(b))
    .map((m,index)=>({id:m.id,rank:index+1,recommended:index===0,health:health[m.id]?.status==='healthy'?'healthy':'unknown',
      latencyMs:fresh(health[m.id])?health[m.id].probeLatencyMs:null,checkedAt:health[m.id]?.checkedAt||'',
      lifecycle:m.legacy?'legacy':'stable',...(m.shutdownDate?{shutdownDate:m.shutdownDate}:{})}));
}
