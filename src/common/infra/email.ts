export type Email = { to: string; subject: string; html?: string; text?: string }

let lastSent: Email | null = null

export async function sendEmailStub(msg: Email): Promise<boolean> {
  lastSent = msg
  try { console.info('[email:stub]', JSON.stringify(msg)) } catch {}
  return true
}

export function getLastEmail(): Email | null { return lastSent }

