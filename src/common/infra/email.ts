import { config } from '@common/config'
import { log } from '@src/common/logger'

export type Email = { to: string; subject: string; html?: string; text?: string }

let lastSent: Email | null = null

export async function sendEmail(msg: Email): Promise<boolean> {
  const transport = config.email.transport
  if (transport === 'resend') {
    const apiKey = config.email.resendApiKey
    if (!apiKey) throw new Error('Resend API key not configured in config.email.resendApiKey')
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ from: config.email.fromAddress, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text })
    })
    if (!res.ok) throw new Error(`Resend error HTTP ${res.status}`)
    return true
  }
  // stub
  lastSent = msg
  try { log.info('[email:stub]', JSON.stringify(msg)) } catch {}
  return true
}

export { sendEmail as sendEmailStub }


export function getLastEmail(): Email | null { return lastSent }
