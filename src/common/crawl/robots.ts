import robotsParser from 'robots-parser'

export async function isAllowed(url: string): Promise<boolean> {
  try {
    const u = new URL(url)
    const robotsUrl = new URL('/robots.txt', `${u.protocol}//${u.host}`).toString()
    const res = await fetch(robotsUrl)
    const text = await res.text()
    const robots = robotsParser(robotsUrl, text)
    return robots.isAllowed(url, 'seo-agent') !== false
  } catch {
    return true
  }
}

