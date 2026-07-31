import { defineConfig } from 'vite'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Builds the developer SDK: thin facade at dist/sdk.js plus kind/engine chunks
// under dist/sdk/ so integrators pay for converters only when used.
export default defineConfig({
  define: {
    __SDK__: true,
  },
  plugins: [
    {
      name: 'copy-pdf-worker',
      closeBundle() {
        copyFileSync(
          resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
          resolve(__dirname, 'dist/pdf.worker.min.mjs'),
        )
        copyFileSync(
          resolve(__dirname, 'src/sdk/formatconvert.d.ts'),
          resolve(__dirname, 'dist/formatconvert.d.ts'),
        )
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    target: 'esnext',
    rollupOptions: {
      input: resolve(__dirname, 'src/sdk/entry.js'),
      preserveEntrySignatures: 'strict',
      output: {
        format: 'es',
        entryFileNames: 'sdk.js',
        chunkFileNames: 'sdk/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
