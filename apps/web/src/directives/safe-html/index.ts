import type { Directive, DirectiveBinding } from "vue";

/**
 * v-safe-html：等价于 v-html，但渲染前会先用 DOMPurify 净化内容，防止 XSS。
 * 用法：<div v-safe-html="rawHtml" />
 *
 * DOMPurify（约 30KB gzip）改为首次使用时动态加载：
 * 该指令在 main.ts 全局注册，若静态引入会把 DOMPurify 带进首屏包；
 * 而实际使用它的页面（词库、课程学习）本身都是懒加载路由。
 */
type SafeHtmlElement = HTMLElement & {
  /** 最近一次待渲染的原始 HTML，用于处理异步净化期间的竞态 */
  __safeHtmlSource?: string;
};

type Sanitizer = (dirty: string | undefined | null) => string;

let sanitizerPromise: Promise<Sanitizer> | null = null;

const loadSanitizer = (): Promise<Sanitizer> => {
  sanitizerPromise ??= import("@/utils/sanitize").then((m) => m.sanitizeHtml);
  return sanitizerPromise;
};

const render = async (
  el: SafeHtmlElement,
  value: string | undefined | null,
) => {
  const source = value ?? "";
  el.__safeHtmlSource = source;
  if (!source) {
    el.innerHTML = "";
    return;
  }
  const sanitize = await loadSanitizer();
  // 等待期间绑定值若又变了，交给更新的那次渲染，避免旧内容覆盖新内容
  if (el.__safeHtmlSource !== source) return;
  el.innerHTML = sanitize(source);
};

const vSafeHtml: Directive<SafeHtmlElement, string | undefined | null> = {
  mounted(el, binding: DirectiveBinding<string | undefined | null>) {
    void render(el, binding.value);
  },
  updated(el, binding: DirectiveBinding<string | undefined | null>) {
    void render(el, binding.value);
  },
};

export default vSafeHtml;
