import { describe, expect, it } from 'vitest'

import { statusBadgeClass } from '../../src/features/projects/client/jobs-tab'

describe('statusBadgeClass', () => {
  it('maps completed to emerald styling', () => {
    expect(statusBadgeClass('completed')).toContain('emerald')
  })

  it('maps running to amber styling', () => {
    expect(statusBadgeClass('running')).toContain('amber')
  })

  it('maps failed to rose styling', () => {
    expect(statusBadgeClass('failed')).toContain('rose')
  })

  it('defaults unknown statuses to muted styling', () => {
    expect(statusBadgeClass('queued')).toBe('bg-muted text-foreground')
  })
})
