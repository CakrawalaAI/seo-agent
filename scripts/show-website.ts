import { websitesRepo } from '@entities/website/repository'

const websiteId = process.argv[2]

if (!websiteId) {
  console.error('usage: node --import tsx scripts/show-website.ts <websiteId>')
  process.exit(1)
}

(async () => {
  const site = await websitesRepo.get(websiteId)
  console.log(JSON.stringify(site, null, 2))
})()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
