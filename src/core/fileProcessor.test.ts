import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { fs as memfs, vol } from 'memfs'

import type { ContextualizerConfig } from '@/config/types'

import { processDirectory } from './fileProcessor'

// --- Test Configuration ---
const PROJECT_ROOT = '/app'

const DEFAULT_TEST_CONFIG: ContextualizerConfig = {
  ignore: [
    'node_modules/',
    '.git/',
    'README.md',
    'bun.lockb',
    '**/*.log',
    '**/*.env',
    '**/*.png',
    '.context/',
  ],
  outputDir: '.context',
  topLevelDirs: ['src'],
}

// --- Mock Setup ---

/**
 * Mock for isbinaryfile module - treats files with 'binary' in path as binary
 */
mock.module('isbinaryfile', () => ({
  isBinaryFile: async (path: string) => path.includes('binary'),
}))

/**
 * Mutable filesystem mock that can be modified during tests
 */
const mutableFsMock = { ...memfs.promises }
mock.module('node:fs/promises', () => ({
  default: mutableFsMock,
  ...mutableFsMock,
}))

// --- Test Utilities ---

/**
 * Creates a standard filesystem structure for testing
 */
function createBasicFileSystem(): Record<string, string> {
  return {
    '.env': 'DATABASE_URL=secret',
    '.secret_file': 'super secret',
    'image.png': 'some image data',
    'node_modules/my-lib/index.js': 'my library code',
    'node_modules/some-package/index.js': 'package code',
    'README.md': '# My Project',
    'src/assets/binary-file.exe': 'binary content',
    'src/bun.lockb': 'lock file content',
    'src/components/button.tsx': 'export const Button = () => {};',
    'src/data.log': 'some log data',
    'src/index.ts': 'console.log("hello world");',
    'src/legacy/abc_legacy.js': 'legacy file',
    'src/legacy/deep/data.log': 'legacy log file',
    'src/prod.log': 'production log data',
    'src/secret.txt': 'i should be unreadable in one test',
    'src/utils/deep/nested/file.ts': 'deep file',
  }
}

/**
 * Helper to create a config with custom ignore patterns
 */
function createConfigWithIgnorePatterns(ignorePatterns: string[]): ContextualizerConfig {
  return {
    ...DEFAULT_TEST_CONFIG,
    ignore: ignorePatterns,
  }
}

/**
 * Creates an extended filesystem structure with additional test cases
 */
function createExtendedFileSystem(): Record<string, string> {
  return {
    ...createBasicFileSystem(),
    'src/components/Button.tsx': 'export const Button = () => {};', // Case variation
    'src/docs/api.md': 'api documentation',
    'src/docs/guide.txt': 'user guide',
    'src/test/integration.spec.js': 'integration test',
    'src/test/unit.test.js': 'unit test',
    'temp/cache.tmp': 'temporary file',
    'temp/session.cache': 'session cache',
  }
}

/**
 * Helper to setup filesystem and run processDirectory
 */
async function processWithFileSystem(
  fileSystem: Record<string, string>,
  config: ContextualizerConfig = DEFAULT_TEST_CONFIG,
  targetDir: string = `${PROJECT_ROOT}/src`,
): Promise<string> {
  vol.fromJSON(fileSystem, PROJECT_ROOT)
  return await processDirectory(targetDir, config, PROJECT_ROOT)
}

describe('fileProcessor', () => {
  beforeEach(() => {
    // Reset filesystem mock to clean state
    Object.assign(mutableFsMock, memfs.promises)
    vol.fromJSON(createBasicFileSystem(), PROJECT_ROOT)
  })

  afterEach(() => {
    vol.reset()
  })

  describe('Basic File Processing', () => {
    it('should include content from allowed files', async () => {
      const content = await processWithFileSystem(createBasicFileSystem())

      expect(content).toContain('=== src/index.ts ===')
      expect(content).toContain('console.log("hello world");')
    })

    it('should ignore files inside ignored directories', async () => {
      const content = await processWithFileSystem(
        createBasicFileSystem(),
        DEFAULT_TEST_CONFIG,
        PROJECT_ROOT,
      )

      expect(content).not.toContain('node_modules/some-package/index.js')
      expect(content).not.toContain('node_modules/my-lib/index.js')
    })

    it('should ignore files matching globstar patterns', async () => {
      const content = await processWithFileSystem(createBasicFileSystem())

      expect(content).not.toContain('src/data.log')
      expect(content).not.toContain('src/legacy/deep/data.log')
    })

    it('should skip binary files without including them in output', async () => {
      const content = await processWithFileSystem(createBasicFileSystem())

      expect(content).not.toContain('binary-file.exe')
      expect(content).not.toContain('binary content')
    })

    it('should gracefully handle unreadable files with error message', async () => {
      // Mock readFile to throw error for specific file
      mutableFsMock.readFile = async (path: any): Promise<any> => {
        if (String(path).endsWith('secret.txt')) {
          throw new Error('EACCES: permission denied')
        }

        return memfs.promises.readFile(path, 'utf8')
      }

      const content = await processWithFileSystem(createBasicFileSystem())

      expect(content).toContain('=== src/secret.txt (Error reading file) ===')
    })

    it('should include dotfiles unless explicitly ignored', async () => {
      const content = await processWithFileSystem(
        createBasicFileSystem(),
        DEFAULT_TEST_CONFIG,
        PROJECT_ROOT,
      )

      expect(content).toContain('=== .secret_file ===')
      expect(content).toContain('super secret')
    })
  })

  describe('Pattern Matching', () => {
    it('should handle directory-specific glob patterns', async () => {
      const config = createConfigWithIgnorePatterns(['src/legacy/**/*.log'])
      const content = await processWithFileSystem(createBasicFileSystem(), config)

      expect(content).toContain('src/data.log')
      expect(content).not.toContain('src/legacy/deep/data.log')
    })

    it('should handle wildcard patterns correctly', async () => {
      const fileSystem = createExtendedFileSystem()
      const config = createConfigWithIgnorePatterns(['src/test/*.test.js', 'temp/*.tmp'])
      const content = await processWithFileSystem(fileSystem, config, PROJECT_ROOT)

      expect(content).not.toContain('src/test/unit.test.js')
      expect(content).toContain('=== src/test/integration.spec.js ===')
      expect(content).not.toContain('temp/cache.tmp')
      expect(content).toContain('=== temp/session.cache ===')
    })

    it('should handle character class patterns', async () => {
      const fileSystem = createExtendedFileSystem()
      const config = createConfigWithIgnorePatterns(['src/docs/*.{md,txt}'])
      const content = await processWithFileSystem(fileSystem, config)

      expect(content).not.toContain('src/docs/api.md')
      expect(content).not.toContain('src/docs/guide.txt')
    })

    it('should distinguish between root-level and nested patterns', async () => {
      const fileSystem = createExtendedFileSystem()
      const config = createConfigWithIgnorePatterns(['*.md', 'src/**/*.md'])
      const content = await processWithFileSystem(fileSystem, config, PROJECT_ROOT)

      expect(content).not.toContain('README.md')
      expect(content).not.toContain('src/docs/api.md')
    })
  })

  describe('Negation Patterns', () => {
    it('should re-include files with negation patterns', async () => {
      const config = createConfigWithIgnorePatterns(['**/*.log', '!src/prod.log'])
      const content = await processWithFileSystem(createBasicFileSystem(), config)

      expect(content).not.toContain('src/data.log')
      expect(content).toContain('=== src/prod.log ===')
      expect(content).toContain('production log data')
    })

    it('should re-include files inside ignored directories', async () => {
      const config = createConfigWithIgnorePatterns(['src/legacy/', '!src/legacy/abc_legacy.js'])
      const content = await processWithFileSystem(createBasicFileSystem(), config)

      expect(content).not.toContain('src/legacy/deep/data.log')
      expect(content).toContain('=== src/legacy/abc_legacy.js ===')
      expect(content).toContain('legacy file')
    })

    it('should re-include entire subdirectories with negation patterns', async () => {
      const config = createConfigWithIgnorePatterns(['node_modules/', '!node_modules/my-lib/'])
      const content = await processWithFileSystem(
        createBasicFileSystem(),
        config,
        PROJECT_ROOT,
      )

      expect(content).not.toContain('node_modules/some-package/index.js')
      expect(content).toContain('=== node_modules/my-lib/index.js ===')
      expect(content).toContain('my library code')
    })

    it('should handle multiple negation patterns correctly', async () => {
      const config = createConfigWithIgnorePatterns([
        '**/*.log',
        '**/*.js',
        '!src/prod.log',
        '!src/legacy/abc_legacy.js',
      ])

      const content = await processWithFileSystem(createBasicFileSystem(), config)

      expect(content).not.toContain('src/data.log')
      expect(content).toContain('=== src/prod.log ===')
      expect(content).toContain('=== src/legacy/abc_legacy.js ===')
    })

    it('should handle complex nested negation scenarios', async () => {
      const config = createConfigWithIgnorePatterns([
        'src/legacy/', // Ignore legacy directory
        '!src/legacy/', // Re-include legacy directory
        'src/legacy/**/*.log', // But ignore log files in legacy
      ])

      const content = await processWithFileSystem(createBasicFileSystem(), config)

      expect(content).toContain('=== src/legacy/abc_legacy.js ===')
      expect(content).not.toContain('src/legacy/deep/data.log')
    })

    it('should handle complex glob combinations with negations', async () => {
      const fileSystem = createExtendedFileSystem()
      const config = createConfigWithIgnorePatterns([
        '**/*.{test,spec}.js',
        '!src/test/integration.spec.js',
      ])

      const content = await processWithFileSystem(fileSystem, config)

      expect(content).not.toContain('src/test/unit.test.js')
      expect(content).toContain('=== src/test/integration.spec.js ===')
    })
  })

  describe('Pattern Precedence and Order', () => {
    it('should respect pattern order - later patterns override earlier ones', async () => {
      // Test case 1: ignore all .log files, then re-include src/prod.log
      const config1 = createConfigWithIgnorePatterns(['**/*.log', '!src/prod.log'])
      const content1 = await processWithFileSystem(createBasicFileSystem(), config1)

      expect(content1).toContain('=== src/prod.log ===')
      expect(content1).not.toContain('src/data.log')

      // Test case 2: re-include src/prod.log, then ignore all .log files (overrides negation)
      const config2 = createConfigWithIgnorePatterns(['!src/prod.log', '**/*.log'])
      const content2 = await processWithFileSystem(createBasicFileSystem(), config2)

      expect(content2).not.toContain('=== src/prod.log ===')
      expect(content2).not.toContain('src/data.log')
    })

    it('should handle conflicting patterns with last pattern winning', async () => {
      const config = createConfigWithIgnorePatterns([
        'src/legacy/', // Ignore directory
        '!src/legacy/abc_legacy.js', // Re-include specific file
        'src/legacy/abc_legacy.js', // Ignore it again (should win)
      ])

      const content = await processWithFileSystem(createBasicFileSystem(), config)

      // Last pattern should win - file should be ignored
      expect(content).not.toContain('src/legacy/abc_legacy.js')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty directories gracefully', async () => {
      const fileSystem = {
        'src/index.ts': 'console.log("hello world");',
      }

      // Create empty directory using vol directly
      vol.reset()
      vol.fromJSON(fileSystem, PROJECT_ROOT)
      vol.mkdirSync(`${PROJECT_ROOT}/empty-dir`)

      const content = await processDirectory(PROJECT_ROOT, DEFAULT_TEST_CONFIG, PROJECT_ROOT)

      expect(content).toContain('=== src/index.ts ===')
      expect(content).toContain('console.log("hello world");')
    })

    it('should handle directories with no matching files', async () => {
      // Reset and create a clean filesystem with only ignored files
      vol.reset()
      const fileSystem = {
        'src/all-ignored.log': 'should be ignored',
        'src/another.env': 'should also be ignored',
      }

      vol.fromJSON(fileSystem, PROJECT_ROOT)
      const content = await processDirectory(`${PROJECT_ROOT}/src`, DEFAULT_TEST_CONFIG, PROJECT_ROOT)

      expect(content).toBe('') // Should be empty since all files are ignored
    })

    it('should handle deeply nested directory structures', async () => {
      const fileSystem = {
        'src/very/deeply/nested/structure/file.ts': 'deeply nested content',
        'src/very/deeply/nested/structure/ignored.log': 'should be ignored',
      }

      const content = await processWithFileSystem(fileSystem)

      expect(content).toContain('=== src/very/deeply/nested/structure/file.ts ===')
      expect(content).toContain('deeply nested content')
      expect(content).not.toContain('ignored.log')
    })

    it('should handle files with special characters in names', async () => {
      const fileSystem = {
        'src/file-with-dashes.ts': 'content with dashes',
        'src/file_with_underscores.ts': 'content with underscores',
        'src/file with spaces.ts': 'content with spaces',
      }

      const content = await processWithFileSystem(fileSystem)

      expect(content).toContain('=== src/file with spaces.ts ===')
      expect(content).toContain('=== src/file-with-dashes.ts ===')
      expect(content).toContain('=== src/file_with_underscores.ts ===')
    })
  })
})
