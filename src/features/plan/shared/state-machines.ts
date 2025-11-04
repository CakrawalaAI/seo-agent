export type PlanEditState =
  | { status: 'idle' }
  | { status: 'editing'; item: any; date: string }
  | { status: 'submitting'; item: any; date: string }
  | { status: 'error'; item: any; date: string; message: string }

export type PublishState =
  | { status: 'idle' }
  | { status: 'submitting'; articleId: string; integrationId: string }
  | { status: 'error'; articleId: string; integrationId: string; message: string }
  | { status: 'queued'; articleId: string; jobId?: string }

export const createIdlePlanEditState = (): PlanEditState => ({ status: 'idle' })

export const openPlanEditor = (item: any): PlanEditState => ({
  status: 'editing',
  item,
  date: (item as any)?.scheduledDate ?? ''
})

export const updatePlanEditorDate = (state: PlanEditState, value: string): PlanEditState => {
  if (state.status === 'editing') {
    return { ...state, date: value }
  }
  if (state.status === 'error') {
    return { status: 'editing', item: state.item, date: value }
  }
  return state
}

export const closePlanEditor = (state: PlanEditState): PlanEditState => {
  if (state.status === 'submitting') {
    return state
  }
  return createIdlePlanEditState()
}

export const submitPlanEditor = (
  state: PlanEditState,
  payload: { planItemId: string; scheduledDate: string }
): PlanEditState => {
  if ((state.status === 'editing' || state.status === 'error') && state.item?.id === payload.planItemId) {
    return { status: 'submitting', item: state.item, date: payload.scheduledDate }
  }
  return state
}

export const planEditorSubmitSuccess = (): PlanEditState => createIdlePlanEditState()

export const planEditorSubmitError = (
  state: PlanEditState,
  payload: { planItemId: string; message: string }
): PlanEditState => {
  if (state.status === 'submitting' && state.item?.id === payload.planItemId) {
    return { status: 'error', item: state.item, date: state.date, message: payload.message }
  }
  return state
}

export const createIdlePublishState = (): PublishState => ({ status: 'idle' })

export const publishSubmitting = (
  _state: PublishState,
  payload: { articleId: string; integrationId: string }
): PublishState => ({
  status: 'submitting',
  articleId: payload.articleId,
  integrationId: payload.integrationId
})

export const publishQueued = (
  _state: PublishState,
  payload: { articleId: string; jobId?: string }
): PublishState => ({
  status: 'queued',
  articleId: payload.articleId,
  jobId: payload.jobId
})

export const publishErrored = (
  _state: PublishState,
  payload: { articleId: string; integrationId: string; message: string }
): PublishState => ({
  status: 'error',
  articleId: payload.articleId,
  integrationId: payload.integrationId,
  message: payload.message
})

export const resetPublishState = (): PublishState => createIdlePublishState()
