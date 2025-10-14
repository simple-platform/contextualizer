import fs from 'node:fs/promises'
import path from 'node:path'

import type { ContextualizerConfig } from './types'

const CONFIG_FILE_NAME = 'contextualizer.json'

// A single, comprehensive list of default ignore patterns that behaves like a .gitignore.
// Note the trailing slashes on directory patterns.
const DEFAULT_CONFIG: Readonly<ContextualizerConfig> = {
  ignore: [
    // Directories
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '.git/',
    '.vscode/',
    '.idea/',
    '__pycache__/',

    // Files
    'package-lock.json',
    'yarn.lock',
    'bun.lockb',
    '.DS_Store',

    // Extensions / Globs
    '*.log',
    '*.env',
    '*.svg',
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.gif',
  ],
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
    if (error.code === 'ENOENT') {
      // If the file doesn't exist, it's not an error.
      // We'll proceed with the defaults, making sure to ignore the output dir.
      const finalConfig = { ...DEFAULT_CONFIG }
      finalConfig.ignore.push(`${finalConfig.outputDir}/`)
      return finalConfig
    }

    // However, if the file exists and is unreadable or contains invalid JSON,
    // it is a critical error. We must stop immediately.
    console.error(`\n❌ Error: Failed to read or parse ${CONFIG_FILE_NAME}.`)
    console.error(`   Please ensure the file is accessible and contains valid JSON.`)
    console.error(`\n   Details: ${error.message}`)

    // eslint-disable-next-line node/prefer-global/process
    process.exit(1)
  }

  // Merge user config with defaults.
  const mergedConfig: ContextualizerConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,

    // If the user provides an 'ignore' array, it REPLACES the default one.
    // This gives them full control, which is the expected behavior.
    ignore: userConfig.ignore ?? DEFAULT_CONFIG.ignore,
  }

  // Important: Always ensure the output directory itself is ignored.
  const outputDirPattern = `${mergedConfig.outputDir}/`
  if (!mergedConfig.ignore.includes(outputDirPattern)) {
    mergedConfig.ignore.push(outputDirPattern)
  }

  return mergedConfig
}
