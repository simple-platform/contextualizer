export interface ContextualizerConfig {
  ignore: string[]
  openOutputDirectory?: boolean
  outputDir: string
  processTopLevelDirs?: boolean
  promptPageSize?: number
  topLevelDirs: string[]
}
