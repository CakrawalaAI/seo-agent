// General worker entry (discovery, plan, generate, publish, metrics, serp)
process.env.SEOA_QUEUE_NAME = process.env.SEOA_QUEUE_NAME || 'seo_jobs.general'
process.env.SEOA_BINDING_KEY = process.env.SEOA_BINDING_KEY || 'discovery.*,plan.*,generate.*,publish.*,metrics.*,serp.*'
import { runWorker } from './index'
runWorker().catch((e) => { console.error('[general.entry] crashed', e); process.exit(1) })

