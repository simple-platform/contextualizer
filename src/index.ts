import { loadConfig } from '@/config/loader'

async function main() {
  // eslint-disable-next-line no-console
  console.log('Loading configuration...')

  const config = await loadConfig()

  // eslint-disable-next-line no-console
  console.log('Configuration loaded successfully:')

  // eslint-disable-next-line no-console
  console.dir(config, { depth: null })
}

main().catch(console.error)
