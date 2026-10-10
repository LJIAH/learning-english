import DOMPurify from "dompurify";

/**
 * HTML 清洗 —— 对应 Vue 版 utils/sanitize.ts 与 v-safe-html 指令。
 *
 * AI 返回的内容可能包含脚本，Markdown 解析后必须先净化再插入 DOM，
 * 否则是 XSS 入口。
 */
export const sanitizeHtml = (html: string) => DOMPurify.sanitize(html);
