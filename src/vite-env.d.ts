/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The Fit Track sync Worker, e.g. https://fittrack-sync.example.workers.dev */
  readonly VITE_SYNC_URL?: string
}
