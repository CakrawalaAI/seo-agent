const STOP = new Set(['the','a','an','of','for','to','in','on','and','or','with','best','top','how','what','is','are','vs','by','from','at'])

export function phrasesFromHeadings(headings: Array<{ level: number; text: string }>, limit = 50) {
  const counts = new Map<string, number>()
  for (const h of headings) {
    const clean = (h.text || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!clean) continue
    const tokens = clean.split(' ').filter((t) => t && !STOP.has(t))
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const gram = tokens.slice(i, i + n).join(' ')
        const cur = counts.get(gram) || 0
        counts.set(gram, cur + 1)
      }
    }
  }
  const arr = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, limit))
  return arr.map(([phrase]) => phrase)
}

