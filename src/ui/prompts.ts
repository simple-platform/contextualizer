import chalk from 'chalk'
import inquirer from 'inquirer'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { ContextualizerConfig } from '@/config/types'

interface DirectoryChoice {
  name: string
  value: string // The full path to the directory
}

/**
 * Prompts the user to select the directories they want to process.
 * @param config The full application configuration.
 * @returns A promise that resolves to an array of selected directory paths.
 */
export async function promptForSubDirectories(config: ContextualizerConfig): Promise<string[]> {
  const choicesByCategory = await getDirectoryChoices(config.topLevelDirs)
  const allSelectedDirs: string[] = []

  if (choicesByCategory.size === 0) {
    return []
  }

  for (const [category, choices] of choicesByCategory.entries()) {
    // eslint-disable-next-line no-console
    console.log(chalk.gray('--------------------------------------------------'))

    const { selected } = await inquirer.prompt<{ selected: string[] }>([
      {
        choices,
        message: `Select projects from ${chalk.yellow.bold(category)}:`,
        name: 'selected',
        pageSize: config.promptPageSize,
        type: 'checkbox',
      },
    ])

    // eslint-disable-next-line no-console
    console.log('')

    allSelectedDirs.push(...selected)
  }

  return allSelectedDirs
}

/**
 * Gathers all available subdirectories from a list of top-level directories.
 * @param topLevelDirs An array of top-level directories to scan.
 * @returns A map of top-level directories to their available subdirectories.
 */
async function getDirectoryChoices(
  topLevelDirs: string[],
): Promise<Map<string, DirectoryChoice[]>> {
  const choicesByCategory = new Map<string, DirectoryChoice[]>()

  for (const topLevelDir of topLevelDirs) {
    try {
      const items = await fs.readdir(topLevelDir, { withFileTypes: true })
      const subDirs = items
        .filter(item => item.isDirectory())
        .map(item => ({
          name: item.name,
          value: path.join(topLevelDir, item.name),
        }))

      if (subDirs.length > 0) {
        choicesByCategory.set(topLevelDir, subDirs)
      }
    }
    catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(chalk.yellow(`Warning: Could not read directory: ${topLevelDir}`))
      }

      // If the directory doesn't exist, we just skip it.
    }
  }

  return choicesByCategory
}
