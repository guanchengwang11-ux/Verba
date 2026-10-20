// Official Free Plan + Production text models, reviewed 2026-10-20.
// Llama legacy enterprise models and preview Qwen are deliberately not options.
export const GROQ_FREE_MODELS=['openai/gpt-oss-120b','openai/gpt-oss-20b'];
export const GROQ_CATALOG_SOURCES=['https://console.groq.com/docs/models','https://console.groq.com/docs/rate-limits'];
export function groqModelChoices(models=[],health={}) {
  return GROQ_FREE_MODELS.filter(id=>models.includes(id)&&!(health[id]?.status==='unhealthy'&&[401,403,404,429].includes(health[id].httpStatus)&&Date.now()-Date.parse(health[id].checkedAt)<3600000)).map((id,index)=>({id,rank:index+1,recommended:index===0,preference:id.endsWith('120b')?'capability':'speed',lifecycle:'stable',health:health[id]?.status==='healthy'?'healthy':'unknown',latencyMs:health[id]?.probeLatencyMs||null,checkedAt:health[id]?.checkedAt||''}));
}
