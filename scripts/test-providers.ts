import { getLlmProvider, getSerpProvider, getKeywordIdeasProvider } from '../src/common/providers/registry'

async function main() {
  console.log('OPENAI_API_KEY', process.env.OPENAI_API_KEY ? 'set' : 'missing')
  console.log('DATAFORSEO_AUTH', process.env.DATAFORSEO_AUTH ? 'set' : 'missing')

  // LLM
  try {
    const llm = getLlmProvider()
    const outline = await llm.draftOutline('seo automation', 'en-US')
    console.log('LLM.draftOutline.title', outline.title)
    const body = await llm.generateBody({ title: outline.title, outline: outline.outline })
    console.log('LLM.generateBody.len', body.bodyHtml?.length || 0)
  } catch (e) {
    console.error('LLM error', (e as Error)?.message)
  }

  // DataForSEO keyword ideas
  try {
    const ideasProvider = getKeywordIdeasProvider()
    const ideas = await ideasProvider.keywordIdeas({ seeds: ['seo automation'], language: 'en', locationCode: 2840, limit: 5 })
    console.log('DFS.keywordIdeas.count', ideas.length)
  } catch (e) {
    console.error('DFS keyword ideas error', (e as Error)?.message)
  }

  // DataForSEO SERP
  try {
    const serp = getSerpProvider()
    const snap = await serp.ensure({ canon: { id: 'test', phrase: 'seo automation', language: 'en-US' }, locationCode: 2840, device: 'desktop', topK: 5 })
    console.log('DFS.serp.items', snap.items.length)
  } catch (e) {
    console.error('DFS serp error', (e as Error)?.message)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
