import type { Directive, DirectiveBinding } from "vue";
import { sanitizeHtml } from "@/utils/sanitize";

/**
 * v-safe-html：等价于 v-html，但渲染前会先用 DOMPurify 净化内容，防止 XSS。
 * 用法：<div v-safe-html="rawHtml" />
 */
const vSafeHtml: Directive<HTMLElement, string | undefined | null> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | undefined | null>) {
    el.innerHTML = sanitizeHtml(binding.value);
  },
  updated(el: HTMLElement, binding: DirectiveBinding<string | undefined | null>) {
    el.innerHTML = sanitizeHtml(binding.value);
  },
};

export default vSafeHtml;
