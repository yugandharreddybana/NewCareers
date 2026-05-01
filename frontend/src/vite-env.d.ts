/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MIDDLEWARE_URL: string
  readonly VITE_DEV_BYPASS_GUARDS: string
  readonly VITE_USE_MOCKS: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
