import 'dotenv/config'

async function main() {
  const base = process.env.APP_URL || 'http://localhost:3000'
  const url = new URL('/api/health', base).toString()
  const res = await fetch(url)
  const txt = await res.text()
  let json: any = null
  try { json = JSON.parse(txt) } catch {}
  const ok = res.ok && json?.ok === true
  console.log(JSON.stringify({ ok, status: res.status, url, body: json ?? txt }, null, 2))
  if (!ok) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })

