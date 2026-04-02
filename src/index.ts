#!/usr/bin/env bun

import chalk from 'chalk'
import { Command } from 'commander'
import path from 'node:path'

import { loadConfig } from '@/config/loader'
import { processDirectory } from '@/core/fileProcessor'
import { showCompletionMessage, showWelcomeMessage, startProcessingSpinner } from '@/ui/display'
import { promptForOutputMode, promptForSubDirectories } from '@/ui/prompts'
import { writeOutput } from '@/utils/fileSystem'
import { getGitDiff, getUntrackedFilesContent } from '@/utils/git'
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

  const outputMode = await promptForOutputMode()

  // eslint-disable-next-line node/prefer-global/process
  const projectRoot = process.cwd()

  const selectedSubDirs = await promptForSubDirectories(config)

  const hasUncommittedChangesOption = selectedSubDirs.includes('__UNCOMMITTED_CHANGES__')

  // Use a Set to ensure we don't process the same directory twice
  const dirsToProcess = new Set<string>(selectedSubDirs.filter(dir => dir !== '__UNCOMMITTED_CHANGES__'))

  // If the config flag is set, add the top-level directories themselves to the set
  if (config.processTopLevelDirs) {
    config.topLevelDirs.forEach(dir => dirsToProcess.add(dir))
  }

  const finalDirs = Array.from(dirsToProcess)

  if (finalDirs.length === 0 && !hasUncommittedChangesOption) {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow('No directories selected. Exiting.'))
    return
  }

  let singleContent = ''

  if (hasUncommittedChangesOption) {
    const spinner = startProcessingSpinner('Uncommitted Changes')
    try {
      const diff = await getGitDiff()
      const untracked = await getUntrackedFilesContent(projectRoot)

      let uncommittedContent = ''
      if (diff) {
        uncommittedContent += `=== Uncommitted Changes (Diff) ===\n${diff}\n\n`
      }
      if (untracked) {
        uncommittedContent += `${untracked}\n`
      }

      if (uncommittedContent) {
        if (outputMode === 'single') {
          singleContent += uncommittedContent
        }
        else {
          await writeOutput(config.outputDir, 'uncommitted-changes', uncommittedContent)
        }
        spinner.succeed(chalk.green(`Created context for ${chalk.bold('Uncommitted Changes')}`))
      }
      else {
        spinner.succeed(chalk.yellow(`No uncommitted changes found.`))
      }
    }
    catch (error) {
      spinner.fail(chalk.red(`Failed to process ${chalk.bold('Uncommitted Changes')}`))
      console.error(error)
    }
  }

  for (const dirPath of finalDirs) {
    const spinner = startProcessingSpinner(dirPath)

    try {
      const content = await processDirectory(dirPath, config, projectRoot)

      if (outputMode === 'single') {
        singleContent += content
      }
      else {
        await writeOutput(config.outputDir, dirPath, content)
      }

      spinner.succeed(chalk.green(`Created context for ${chalk.bold(path.basename(dirPath))}`))
    }
    catch (error) {
      spinner.fail(chalk.red(`Failed to process ${chalk.bold(path.basename(dirPath))}`))
      console.error(error)
    }
  }

  if (outputMode === 'single' && singleContent) {
    const spinner = startProcessingSpinner('context')
    try {
      await writeOutput(config.outputDir, 'context', singleContent)
      spinner.succeed(chalk.green(`Created single context file in ${chalk.bold('context.txt')}`))
    }
    catch (error) {
      spinner.fail(chalk.red(`Failed to process single context file`))
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
