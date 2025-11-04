const raw = process.env.HTTP_TIMEOUT_MS
const parsed = raw ? Number(raw) : NaN

export const HTTP_TIMEOUT_MS = Number.isFinite(parsed) && parsed > 0 ? parsed : 300_000
