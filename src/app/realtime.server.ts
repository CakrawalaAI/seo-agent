import { ensureRealtimeHub } from '@common/realtime/hub'

if (typeof window === 'undefined') {
  ensureRealtimeHub()
}
