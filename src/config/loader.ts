import fs from 'node:fs/promises'
import path from 'node:path'

import type { ContextualizerConfig } from './types'

const CONFIG_FILE_NAME = 'contextualizer.json'

const DEFAULT_CONFIG: Readonly<ContextualizerConfig> = {
  ignoreDirs: ['node_modules', 'dist', 'build', '.git', '.vscode', '.idea'],
  ignoreExtensions: ['*.log', '*.env', '*.svg', '*.png', '*.jpg', '*.jpeg', '*.gif'],
  ignoreFiles: ['package-lock.json', 'yarn.lock', 'bun.lockb'],
  outputDir: '.context',
  topLevelDirs: ['apps', 'packages', 'src'],
}

/**
 * Loads the contextualizer configuration from a file in the current
 * working directory, merging it with default values.
 *
 * If a config file is found but is invalid (e.g., malformed JSON),
 * the process will exit with a non-zero status code.
 *
 * @returns A promise that resolves to the fully-formed, valid configuration object.
 */
export async function loadConfig(): Promise<ContextualizerConfig> {
  // eslint-disable-next-line node/prefer-global/process
  const configPath = path.join(process.cwd(), CONFIG_FILE_NAME)

  let userConfig: Partial<ContextualizerConfig> = {}

  try {
    const fileContent = await fs.readFile(configPath, 'utf8')
    userConfig = JSON.parse(fileContent)
  }
  catch (error: any) {
    // If the file doesn't exist, we can safely proceed with defaults.
    // This is not an error condition.
    if (error.code === 'ENOENT') {
      return { ...DEFAULT_CONFIG }
    }

    // However, if the file exists and is unreadable or contains invalid JSON,
    // it is a critical error. We must stop immediately.
    console.error(`\n❌ Error: Failed to read or parse ${CONFIG_FILE_NAME}.`)
    console.error(`   Please ensure the file is accessible and contains valid JSON.`)
    console.error(`\n   Details: ${error.message}`)

    // eslint-disable-next-line node/prefer-global/process
    process.exit(1)
  }

  // Merge user config with defaults. The user's values take precedence.
  const mergedConfig: ContextualizerConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,

    // Ensure arrays are properly merged if user provides them
    ignoreDirs: userConfig.ignoreDirs ?? DEFAULT_CONFIG.ignoreDirs,
    ignoreExtensions: userConfig.ignoreExtensions ?? DEFAULT_CONFIG.ignoreExtensions,
    ignoreFiles: userConfig.ignoreFiles ?? DEFAULT_CONFIG.ignoreFiles,
  }

  // Important: Always ensure the output directory itself is ignored.
  if (!mergedConfig.ignoreDirs.includes(mergedConfig.outputDir)) {
    mergedConfig.ignoreDirs.push(mergedConfig.outputDir)
  }

  return mergedConfig
}
