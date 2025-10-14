import { isBinaryFile } from 'isbinaryfile'
import micromatch from 'micromatch'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { ContextualizerConfig } from '@/config/types'

/**
 * Recursively reads a directory, filtering out files and directories based on
 * the provided configuration, and concatenates the content of all valid files.
 *
 * This function is pure and has no side effects (e.g., no console logging).
 *
 * @param dirPath The absolute path to the directory to start scanning from.
 * @param config The loaded contextualizer configuration object.
 * @param projectRoot The absolute path to the root of the project, used to create clean relative paths.
 * @returns A promise that resolves to a single string containing all the file contents.
 */
export async function processDirectory(
  dirPath: string,
  config: ContextualizerConfig,
  projectRoot: string,
): Promise<string> {
  let content = ''
  const items = await fs.readdir(dirPath, { withFileTypes: true })

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name)
    const relativePath = path.relative(projectRoot, fullPath)

    if (item.isDirectory()) {
      // Check if the directory name matches any of the ignore patterns.
      if (micromatch.isMatch(item.name, config.ignoreDirs)) {
        continue
      }

      content += await processDirectory(fullPath, config, projectRoot)
    }
    else if (item.isFile()) {
      // Check against file names, then extensions.
      if (
        micromatch.isMatch(item.name, config.ignoreFiles)
        || micromatch.isMatch(item.name, config.ignoreExtensions)
      ) {
        continue
      }

      try {
        // Final check: ensure the file is not a binary.
        if (await isBinaryFile(fullPath)) {
          continue
        }

        const fileContent = await fs.readFile(fullPath, 'utf8')
        content += `=== ${relativePath} ===\n${fileContent}\n\n`
      }
      catch {
        // A file might be unreadable due to permissions or other issues.
        // We include a note in the output but do not halt the entire process.
        content += `=== ${relativePath} (Error reading file) ===\n\n`
      }
    }
  }

  return content
}
