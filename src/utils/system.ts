import chalk from 'chalk'
import { exec } from 'node:child_process'
import path from 'node:path'

/**
 * Opens a directory in the default file explorer.
 * @param dirPath The path to the directory to open.
 */
export function openDirectory(dirPath: string): void {
  // eslint-disable-next-line node/prefer-global/process
  const platform = process.platform
  const command = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open'

  exec(`${command} "${path.resolve(dirPath)}"`, (error) => {
    if (error) {
      console.error(chalk.red(`\nError opening directory: ${error.message}`))
      return
    }

    // eslint-disable-next-line no-console
    console.log(chalk.cyan(`\nSuccessfully opened the ${dirPath} directory.`))
  })
}
