/// <reference types="vite/client" />
/// <reference types="dom-speech-recognition" />
/// <reference types="element-plus/global" />

declare module "*.vue" {
  import type { DefineComponent, readonly } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_UPLOAD_URL: string;
  readonly VITE_SOCKET_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
