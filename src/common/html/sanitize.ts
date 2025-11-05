export function stripCodeFences(text: string): string {
  const t = String(text || '')
  const m = t.match(/```[a-zA-Z]*\n([\s\S]*?)```/)
  if (m && m[1]) return m[1].trim()
  return t.trim()
}

export function extractBodyIfPresent(html: string): string {
  const t = String(html || '')
  const bodyMatch = t.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch && bodyMatch[1]) return bodyMatch[1].trim()
  return t
}

export function dropDisallowedBlocks(html: string): string {
  return String(html || '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
}

export function hardenLinks(html: string): string {
  const withRel = String(html || '')
    .replace(/<a\s+([^>]*href=\s*\"[^\"]+\"[^>]*)>/gi, (m, attrs) => {
      const hasRel = /\brel\s*=\s*/i.test(attrs)
      return `<a ${attrs}${hasRel ? '' : ' rel=\\"noopener noreferrer\\"'}>`
    })
  return withRel
    .replace(/\son[a-z]+\s*=\s*\"[^\"]*\"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\sstyle\s*=\s*\"[^\"]*\"/gi, '')
    .replace(/\sstyle\s*=\s*'[^']*'/gi, '')
}

export function ensureArticleRoot(html: string, title?: string): string {
  const t = String(html || '').trim()
  if (/^<article[\s>]/i.test(t)) return t
  if (!/<[a-z][\s\S]*>/i.test(t)) {
    return `<article>${title ? `<h1>${escapeHtml(title)}</h1>` : ''}<p>${escapeHtml(t)}</p></article>`
  }
  return `<article>${t}</article>`
}

export function sanitizeGeneratedHtml(input: string, title?: string): string {
  let s = stripCodeFences(input)
  s = extractBodyIfPresent(s)
  s = dropDisallowedBlocks(s)
  s = hardenLinks(s)
  s = s.trim()
  if (!s) return `<article>${title ? `<h1>${escapeHtml(title)}</h1>` : ''}<p>Draft content pending.</p></article>`
  return ensureArticleRoot(s, title)
}

export function sanitizeUserHtml(input: string, title?: string): string {
  // Same as generated for now; kept separate for future differences
  return sanitizeGeneratedHtml(input, title)
}

export function escapeHtml(input: string) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

