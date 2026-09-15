import DOMPurify from "dompurify";

/**
 * 净化 HTML 字符串，防止 XSS 攻击。
 * 用于所有通过 v-html 渲染的内容（AI 返回的 Markdown、单词翻译等）。
 *
 * 允许常见排版标签与属性，剥离 <script>、事件处理器（onerror 等）、javascript: 协议。
 */
export function sanitizeHtml(dirty: string | undefined | null): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "a", "b", "i", "em", "strong", "p", "br", "hr",
      "ul", "ol", "li", "blockquote", "code", "pre",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "span", "div", "img", "table", "thead", "tbody", "tr", "th", "td",
      "sup", "sub", "del", "ins", "mark",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "target", "rel", "width", "height"],
    ALLOW_DATA_ATTR: false,
  });
}
