/// <reference types="vite/client" />
/// <reference types="dom-speech-recognition" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
