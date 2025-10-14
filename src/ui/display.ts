/* eslint-disable no-console */
import type { Ora } from 'ora'

import boxen from 'boxen'
import chalk from 'chalk'
import path from 'node:path'
import ora from 'ora'

/**
 * Displays the final "All Done!" message.
 */
export function showCompletionMessage(): void {
  console.log(
    boxen(chalk.bold.green('All Done!'), {
      borderStyle: 'round',
      margin: { top: 1 },
      padding: 1,
      textAlignment: 'center',
    }),
  )
}

/**
 * Displays the initial welcome message for the CLI.
 */
export function showWelcomeMessage(): void {
  console.log(
    boxen(chalk.bold.green('Simple Contextualizer'), {
      borderStyle: 'round',
      margin: 1,
      padding: 1,
    }),
  )
}

/**
 * Starts and returns a spinner for a given directory.
 * @param dirPath The path of the directory being processed.
 * @returns An Ora instance.
 */
export function startProcessingSpinner(dirPath: string): Ora {
  return ora(`Processing ${chalk.blue.bold(path.basename(dirPath))}`).start()
}
