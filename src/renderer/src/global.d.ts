/// <reference types="vite/client" />
import type { InkwellApi } from '@shared/ipc';

declare global {
  interface Window {
    api: InkwellApi;
  }
}

export {};
