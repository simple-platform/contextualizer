import { isBinaryFile } from 'isbinaryfile'
import micromatch from 'micromatch'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { ContextualizerConfig } from '@/config/types'

/**
 * Main directory processor that orchestrates file and directory processing
 */
class DirectoryProcessor {
  private readonly fileProcessor: FileContentProcessor
  private readonly patternMatcher: PatternMatcher
  private readonly projectRoot: string

  constructor(config: ContextualizerConfig, projectRoot: string) {
    this.patternMatcher = new PatternMatcher(config.ignore)
    this.fileProcessor = new FileContentProcessor()
    this.projectRoot = projectRoot
  }

  /**
   * Processes a directory recursively and returns concatenated content
   *
   * @param dirPath - Full path to the directory to process
   * @returns Concatenated content from all processed files
   */
  async process(dirPath: string): Promise<string> {
    const items = await fs.readdir(dirPath, { withFileTypes: true })
    let content = ''

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name)
      const relativePath = this.getRelativePath(fullPath)

      if (item.isDirectory()) {
        content += await this.processDirectory(fullPath, relativePath)
      }
      else if (item.isFile()) {
        content += await this.processFile(fullPath, relativePath)
      }
    }

    return content
  }

  /**
   * Converts full path to relative path with POSIX separators
   */
  private getRelativePath(fullPath: string): string {
    return path.relative(this.projectRoot, fullPath).split(path.sep).join(path.posix.sep)
  }

  /**
   * Processes a directory, handling ignore patterns and recursion
   */
  private async processDirectory(fullPath: string, relativePath: string): Promise<string> {
    const isDirIgnored = this.patternMatcher.shouldIgnore(relativePath, true)

    // If directory is ignored, check if any nested patterns might affect its contents
    if (isDirIgnored && !this.patternMatcher.hasNestedPatterns(relativePath)) {
      return '' // Skip entire directory
    }

    return await this.process(fullPath)
  }

  /**
   * Processes a file if it's not ignored
   */
  private async processFile(fullPath: string, relativePath: string): Promise<string> {
    if (this.patternMatcher.shouldIgnore(relativePath, false)) {
      return '' // Skip ignored file
    }

    return await this.fileProcessor.processFile(fullPath, relativePath)
  }
}

/**
 * File content processor for handling individual files
 */
class FileContentProcessor {
  /**
   * Processes a single file and returns its formatted content
   *
   * @param filePath - Full path to the file
   * @param relativePath - Path relative to project root
   * @returns Formatted file content or error message
   */
  async processFile(filePath: string, relativePath: string): Promise<string> {
    try {
      if (await this.isBinary(filePath)) {
        return '' // Skip binary files silently
      }

      const fileContent = await fs.readFile(filePath, 'utf8')
      return this.formatFileContent(relativePath, fileContent)
    }
    catch {
      return this.formatErrorContent(relativePath)
    }
  }

  /**
   * Formats error content for unreadable files
   */
  private formatErrorContent(relativePath: string): string {
    return `=== ${relativePath} (Error reading file) ===\n\n`
  }

  /**
   * Formats successful file content
   */
  private formatFileContent(relativePath: string, content: string): string {
    return `=== ${relativePath} ===\n${content}\n\n`
  }

  /**
   * Checks if a file is binary
   */
  private async isBinary(filePath: string): Promise<boolean> {
    return await isBinaryFile(filePath)
  }
}

/**
 * Pattern matching utilities for file and directory filtering
 */
class PatternMatcher {
  private readonly patterns: string[]

  constructor(patterns: string[]) {
    this.patterns = patterns
  }

  /**
   * Checks if there are nested patterns that might affect directory contents
   */
  hasNestedPatterns(dirPath: string): boolean {
    const dirPathWithSlash = `${dirPath}/`

    return this.patterns.some((pattern) => {
      const cleanPattern = pattern.startsWith('!') ? pattern.slice(1) : pattern
      return cleanPattern.startsWith(dirPathWithSlash)
        || micromatch.isMatch(`${dirPathWithSlash}**`, [cleanPattern], { dot: true })
    })
  }

  /**
   * Determines if a path should be ignored based on pattern precedence.
   * Later patterns in the array override earlier ones.
   *
   * @param targetPath - The path to check (relative to project root)
   * @param isDirectory - Whether the path represents a directory
   * @returns true if the path should be ignored, false otherwise
   */
  shouldIgnore(targetPath: string, isDirectory: boolean = false): boolean {
    const pathToCheck = isDirectory ? `${targetPath}/` : targetPath
    let ignored = false

    // Process patterns in order - later patterns override earlier ones
    for (const pattern of this.patterns) {
      const isNegation = pattern.startsWith('!')
      const cleanPattern = isNegation ? pattern.slice(1) : pattern
      const preparedPattern = this.preparePattern(cleanPattern, isNegation)

      if (this.matchesPattern(pathToCheck, targetPath, preparedPattern, isDirectory, cleanPattern)) {
        ignored = !isNegation
      }
    }

    return ignored
  }

  /**
   * Checks if a path matches a given pattern using various matching strategies
   */
  private matchesPattern(
    pathToCheck: string,
    originalPath: string,
    preparedPattern: string,
    isDirectory: boolean,
    cleanPattern: string,
  ): boolean {
    // Direct pattern match
    if (micromatch.isMatch(pathToCheck, [preparedPattern], { dot: true })) {
      return true
    }

    // Directory-specific match (check without trailing slash)
    if (isDirectory && micromatch.isMatch(originalPath, [preparedPattern], { dot: true })) {
      return true
    }

    // File inside negated directory check
    if (!isDirectory && cleanPattern.endsWith('/') && originalPath.startsWith(cleanPattern)) {
      return true
    }

    return false
  }

  /**
   * Prepares a pattern for matching by handling directory-specific cases
   */
  private preparePattern(cleanPattern: string, isNegation: boolean): string {
    return cleanPattern.endsWith('/') && !isNegation ? `${cleanPattern}**` : cleanPattern
  }
}

/**
 * Processes a directory recursively, filtering files based on ignore patterns
 * and returning concatenated content from all non-ignored, non-binary files.
 *
 * @param dirPath - The directory path to process
 * @param config - Configuration containing ignore patterns and other settings
 * @param projectRoot - The root directory of the project (used for relative paths)
 * @returns Promise resolving to concatenated file contents
 *
 * @example
 * ```typescript
 * const config = {
 *   ignore: ['node_modules/', '*.log', '!important.log'],
 *   outputDir: '.context',
 *   topLevelDirs: ['src']
 * }
 *
 * const content = await processDirectory('/path/to/project/src', config, '/path/to/project')
 * console.log(content) // Contains formatted content from all matching files
 * ```
 */
export async function processDirectory(
  dirPath: string,
  config: ContextualizerConfig,
  projectRoot: string,
): Promise<string> {
  const processor = new DirectoryProcessor(config, projectRoot)
  return await processor.process(dirPath)
}
