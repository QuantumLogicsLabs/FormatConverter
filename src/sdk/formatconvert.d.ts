/**
 * Type definitions for FormatConvert SDK (`/sdk.js`).
 * Conversions run entirely in the browser — no uploads.
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

export type ConvertOptions = {
  from?: string
  onProgress?: (p: ProgressInfo) => void
  signal?: AbortSignal
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
  toolId: string,
  files: ArrayLike<File | Blob>,
  options?: ConvertOptions
): Promise<ToolResult>
export declare function listTools(): Array<{
  id: string
  label: string
  description: string
  inputs: unknown
  output: string
  options: unknown[]
}>
export declare function getTool(id: string): unknown

declare global {
  interface Window {
    FormatConvert?: typeof import('./formatconvert')
  }
}

export as namespace FormatConvert
