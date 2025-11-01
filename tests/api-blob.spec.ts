import { describe, it, expect, beforeEach } from 'vitest'
import { saveHtml } from '../src/common/blob/store'
import { Route as BlobRoute } from '../src/app/routes/api/blobs/$blobId'

describe('blob route', () => {
  beforeEach(() => {
    delete process.env.SEOA_BLOBS_PUBLIC
    delete process.env.E2E_NO_AUTH
  })

  it('requires auth when not public', async () => {
    const { id } = saveHtml('<p>hi</p>')
    const res = await (BlobRoute as any).options.server.handlers.GET({ params: { blobId: id }, request: new Request('http://x/blobs') })
    expect(res.status).toBe(401)
  })

  it('returns html when public', async () => {
    process.env.SEOA_BLOBS_PUBLIC = '1'
    const { id } = saveHtml('<p>hello</p>')
    const res = await (BlobRoute as any).options.server.handlers.GET({ params: { blobId: id }, request: new Request('http://x/blobs') })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('hello')
  })
})
