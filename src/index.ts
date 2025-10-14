/* eslint-disable no-console */
import path from 'node:path'

import { loadConfig } from '@/config/loader'
import { processDirectory } from '@/core/fileProcessor'

async function main() {
  console.log('Loading configuration...')
  const config = await loadConfig()

  // eslint-disable-next-line node/prefer-global/process
  const projectRoot = process.cwd()

  console.log('Configuration loaded successfully.')
  console.log('Starting directory processing...\n')

  // For testing, we'll process the first available directory from the config.
  const dirToProcess = config.topLevelDirs[0]
  if (!dirToProcess) {
    console.error('❌ No directories specified in `topLevelDirs` in your configuration.')

    // eslint-disable-next-line node/prefer-global/process
    process.exit(1)
  }

  const fullPath = path.join(projectRoot, dirToProcess)

  try {
    const combinedContent = await processDirectory(fullPath, config, projectRoot)

    console.log('--- BEGIN PROCESSED CONTENT ---')
    console.log(combinedContent)
    console.log('--- END PROCESSED CONTENT ---')
    console.log('\n✅ Processing complete.')
  }
  catch (error: any) {
    // Handle cases where the top-level directory itself doesn't exist.
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: The directory "${dirToProcess}" does not exist.`)
    }
    else {
      console.error('An unexpected error occurred during processing:', error)
    }

    // eslint-disable-next-line node/prefer-global/process
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('A critical error occurred:', error)

  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
})
