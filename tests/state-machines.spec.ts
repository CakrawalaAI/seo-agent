import { describe, expect, it } from 'vitest'
import {
  closePlanEditor,
  createIdlePlanEditState,
  createIdlePublishState,
  openPlanEditor,
  planEditorSubmitError,
  planEditorSubmitSuccess,
  publishErrored,
  publishQueued,
  publishSubmitting,
  resetPublishState,
  submitPlanEditor,
  updatePlanEditorDate
} from '../src/features/plan/shared/state-machines'

describe('plan edit state machine', () => {
  const item = { id: 'plan-1', scheduledDate: '2024-11-01' }

  it('opens the editor with the current date', () => {
    const state = openPlanEditor(item)
    expect(state).toEqual({ status: 'editing', item, date: '2024-11-01' })
  })

  it('updates the planned date while editing', () => {
    const editing = openPlanEditor(item)
    const next = updatePlanEditorDate(editing, '2024-12-25')
    expect(next).toEqual({ status: 'editing', item, date: '2024-12-25' })
  })

  it('resets to editing when changing the date after an error', () => {
    const errorState = {
      status: 'error' as const,
      item,
      date: '2024-11-01',
      message: 'Network error'
    }
    const next = updatePlanEditorDate(errorState, '2024-12-01')
    expect(next).toEqual({ status: 'editing', item, date: '2024-12-01' })
  })

  it('closes the editor unless a submit is running', () => {
    const editing = openPlanEditor(item)
    expect(closePlanEditor(editing)).toEqual({ status: 'idle' })

    const submitting = submitPlanEditor(editing, { planItemId: 'plan-1', scheduledDate: '2024-11-20' })
    expect(closePlanEditor(submitting)).toBe(submitting)
  })

  it('moves to submitting only for the active plan item', () => {
    const editing = openPlanEditor(item)
    const submitting = submitPlanEditor(editing, { planItemId: 'plan-1', scheduledDate: '2024-11-10' })
    expect(submitting).toEqual({ status: 'submitting', item, date: '2024-11-10' })

    const untouched = submitPlanEditor(editing, { planItemId: 'plan-2', scheduledDate: '2024-11-10' })
    expect(untouched).toBe(editing)
  })

  it('returns to idle on submit success', () => {
    expect(planEditorSubmitSuccess()).toEqual({ status: 'idle' })
  })

  it('captures submit errors for the active item', () => {
    const editing = openPlanEditor(item)
    const submitting = submitPlanEditor(editing, { planItemId: 'plan-1', scheduledDate: '2024-11-10' })
    const errored = planEditorSubmitError(submitting, { planItemId: 'plan-1', message: 'Failed to update' })
    expect(errored).toEqual({ status: 'error', item, date: '2024-11-10', message: 'Failed to update' })

    const ignored = planEditorSubmitError(editing, { planItemId: 'plan-1', message: 'Should be ignored' })
    expect(ignored).toBe(editing)
  })

  it('provides an idle state factory', () => {
    expect(createIdlePlanEditState()).toEqual({ status: 'idle' })
  })
})

describe('publish state machine', () => {
  it('creates idle state factories', () => {
    expect(createIdlePublishState()).toEqual({ status: 'idle' })
    expect(resetPublishState()).toEqual({ status: 'idle' })
  })

  it('records submitting transitions', () => {
    const submitting = publishSubmitting(createIdlePublishState(), {
      articleId: 'article-1',
      integrationId: 'integration-1'
    })
    expect(submitting).toEqual({
      status: 'submitting',
      articleId: 'article-1',
      integrationId: 'integration-1'
    })
  })

  it('stores queued transitions with job ids', () => {
    const queued = publishQueued(createIdlePublishState(), { articleId: 'article-1', jobId: 'job-99' })
    expect(queued).toEqual({ status: 'queued', articleId: 'article-1', jobId: 'job-99' })
  })

  it('captures publish errors', () => {
    const errored = publishErrored(createIdlePublishState(), {
      articleId: 'article-2',
      integrationId: 'integration-3',
      message: 'Integration failed'
    })
    expect(errored).toEqual({
      status: 'error',
      articleId: 'article-2',
      integrationId: 'integration-3',
      message: 'Integration failed'
    })
  })
})
