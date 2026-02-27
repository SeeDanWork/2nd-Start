/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_EXPO_WEB_URL: string;
  readonly VITE_FATHER_EMAIL: string;
  readonly VITE_MOTHER_EMAIL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
