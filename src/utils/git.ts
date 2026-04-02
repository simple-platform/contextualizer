import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Gets the diff for modified tracked files.
 */
export async function getGitDiff(): Promise<string> {
  try {
    // Get diff of tracked files, both staged and unstaged
    const { stdout: unstagedDiff } = await execAsync('git diff')
    const { stdout: stagedDiff } = await execAsync('git diff --cached')

    return [stagedDiff, unstagedDiff].filter(Boolean).join('\n')
  }
  catch {
    return ''
  }
}

/**
 * Gets the contents of untracked files.
 */
export async function getUntrackedFilesContent(projectRoot: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git ls-files --others --exclude-standard')
    const untrackedFiles = stdout.trim().split('\n').filter(Boolean)

    let content = ''
    for (const file of untrackedFiles) {
      try {
        const fullPath = path.join(projectRoot, file)
        const fileContent = await fs.readFile(fullPath, 'utf8')
        content += `=== ${file} (Untracked) ===\n${fileContent}\n\n`
      }
      catch {
        // file could be binary or unreadable
        content += `=== ${file} (Untracked, Error reading file) ===\n\n`
      }
    }

    return content
  }
  catch {
    return ''
  }
}
