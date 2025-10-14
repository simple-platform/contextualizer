import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Writes the generated content to a file in the specified output directory.
 * Creates the output directory if it doesn't exist.
 * @param outputDir The directory to write the file to.
 * @param targetDir The directory that was processed (used for filename).
 * @param content The content to write to the file.
 */
export async function writeOutput(outputDir: string, targetDir: string, content: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true })

  const outputFileName = `${path.basename(targetDir)}.txt`
  const outputFilePath = path.join(outputDir, outputFileName)

  await fs.writeFile(outputFilePath, content)
}
