/**
 * Type definitions for FormatConvert SDK (`/sdk.js`).
 * Facade + on-demand chunks under `/sdk/`. Conversions run in the browser — no uploads.
 *
 * Reserved npm name: @quantumlogics/formatconvert (publish is manual / user-owned).
 */

export type ProgressInfo = {
  page?: number
  total?: number
  stage?: string
  message?: string
  fileIndex?: number
  fileCount?: number
  file?: File
}

export type ConvertResult = {
  blob: Blob
  filename: string
  from: string
  to: string
}

export type ConvertManyResult = {
  file: File | Blob
  ok: boolean
  result?: ConvertResult
  error?: Error
  aborted?: boolean
}

/** Common convert options; pair-specific keys come from registry option schemas. */
export type ConvertOptions = {
  from?: string
  onProgress?: (p: ProgressInfo) => void
  signal?: AbortSignal
  /** Document / PDF layout */
  pageSize?: string
  fontSize?: number
  lineHeight?: number
  margin?: number
  font?: string
  pageNumbers?: boolean | string
  mode?: string
  ocr?: string
  ocrLanguage?: string
  pageBreaks?: string
  scale?: number
  quality?: number
  width?: number
  background?: string
  sizes?: number[]
  sheet?: string
  /** Video */
  mute?: boolean
  /** PDF tools / unlock */
  password?: string
  pages?: string
  [key: string]: unknown
}

export type ConvertManyOptions = ConvertOptions & {
  concurrency?: number
}

export type ToolResult = {
  blob: Blob
  filename: string
  tool: string
}

export type FormatInfo = {
  label: string
  kind: string
  exts: string[]
  mime: string
  input: boolean
  output: boolean
}

export type ToolId =
  | 'merge-pdf'
  | 'split-pdf'
  | 'rotate-pdf'
  | 'extract-pages'
  | 'compress-pdf'
  | 'images-to-pdf'
  | 'images-to-gif'
  | 'watermark-pdf'
  | 'reorder-pdf'
  | 'page-numbers-pdf'
  | 'rotate-image'
  | 'crop-image'
  | 'trim-audio'
  | 'normalize-audio'
  | 'redact-pdf'
  | 'zip-files'
  | 'unzip'
  | 'unlock-pdf'
  | 'compress-image'
  | 'resize-image'
  | 'trim-video'
  | 'ocr-pages'

export declare const FORMATS: Record<string, FormatInfo>
export declare const KINDS: Array<{ id: string; label: string }>

export declare function convert(
  file: File | Blob,
  to: string,
  options?: ConvertOptions
): Promise<ConvertResult>

export declare function convertMany(
  files: ArrayLike<File | Blob>,
  to: string,
  options?: ConvertManyOptions
): Promise<ConvertManyResult[]>

export declare function zipResults(
  results: ConvertManyResult[],
  zipName?: string
): Promise<{ blob: Blob; filename: string }>

export declare function detectFormat(file: File | Blob): Promise<string | null>
export declare function listConversions(): Array<{ from: string; to: string; options: unknown[] }>
export declare function targetsFor(from: string): string[]
export declare function getConversion(from: string, to: string): unknown
export declare function runTool(
  toolId: ToolId | string,
  files: ArrayLike<File | Blob>,
  options?: ConvertOptions
): Promise<ToolResult>
export declare function listTools(): Array<{
  id: ToolId | string
  label: string
  description: string
  inputs: unknown
  output: string
  options: unknown[]
}>
export declare function getTool(id: string): unknown

export declare function getLastFFmpegLoadSource(): 'network' | 'cache' | null
export declare function resetFFmpeg(): Promise<void>
export declare function assertAvFileSize(file: File | Blob): boolean

declare global {
  interface Window {
    FormatConvert?: typeof import('./formatconvert')
  }
}

export as namespace FormatConvert
