// Dedicated crawler worker entry
process.env.SEOA_QUEUE_NAME = process.env.SEOA_QUEUE_NAME || 'seo_jobs.crawler'
process.env.SEOA_BINDING_KEY = process.env.SEOA_BINDING_KEY || 'crawl.*'
import { runWorker } from './index'
runWorker().catch((e) => { console.error('[crawler.entry] crashed', e); process.exit(1) })

