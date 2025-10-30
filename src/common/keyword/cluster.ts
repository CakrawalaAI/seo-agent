const STOPWORDS = new Set([
  'the','a','an','of','for','to','in','on','and','or','with','best','top','guide','how','what','is','are','vs','vs.','by','from','at','your','my','our'
])

export function normalize(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function clusterKey(phrase: string) {
  const tokens = normalize(phrase).split(' ').filter((t) => t && !STOPWORDS.has(t))
  if (tokens.length === 0) return normalize(phrase)
  return tokens.slice(0, 2).join(' ')
}

