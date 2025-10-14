#!/usr/bin/env bun

import chalk from 'chalk'
import { Command } from 'commander'
import path from 'node:path'

import { loadConfig } from '@/config/loader'
import { processDirectory } from '@/core/fileProcessor'
import { showCompletionMessage, showWelcomeMessage, startProcessingSpinner } from '@/ui/display'
import { promptForSubDirectories } from '@/ui/prompts'
import { writeOutput } from '@/utils/fileSystem'
import { openDirectory } from '@/utils/system'

async function main() {
  // Dynamically import package.json to get version and description
  const { description, version } = await import('../package.json')

  const program = new Command()

  program
    .version(version)
    .description(description)
    .action(runContextualizer)
    // eslint-disable-next-line node/prefer-global/process
    .parse(process.argv)
}

async function runContextualizer() {
  showWelcomeMessage()

  const config = await loadConfig()

  // eslint-disable-next-line node/prefer-global/process
  const projectRoot = process.cwd()

  const selectedSubDirs = await promptForSubDirectories(config)

  // Use a Set to ensure we don't process the same directory twice
  const dirsToProcess = new Set<string>(selectedSubDirs)

  // If the config flag is set, add the top-level directories themselves to the set
  if (config.processTopLevelDirs) {
    config.topLevelDirs.forEach(dir => dirsToProcess.add(dir))
  }

  const finalDirs = Array.from(dirsToProcess)

  if (finalDirs.length === 0) {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow('No directories selected. Exiting.'))
    return
  }

  for (const dirPath of finalDirs) {
    const spinner = startProcessingSpinner(dirPath)

    try {
      const content = await processDirectory(dirPath, config, projectRoot)
      await writeOutput(config.outputDir, dirPath, content)
      spinner.succeed(chalk.green(`Created context for ${chalk.bold(path.basename(dirPath))}`))
    }
    catch (error) {
      spinner.fail(chalk.red(`Failed to process ${chalk.bold(path.basename(dirPath))}`))
      console.error(error)
    }
  }

  showCompletionMessage()

  if (config.openOutputDirectory) {
    openDirectory(config.outputDir)
  }
}

main().catch((error) => {
  console.error(chalk.red('\nAn unexpected error occurred:'), error)

  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
})
