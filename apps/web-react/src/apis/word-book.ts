import type { WordList, WordQuery } from "@en/common/word";
import { serverRequest } from "./request";

/**
 * 词库接口 —— 对应 Vue 版 apis/word-book/index.ts。
 * 类型复用 @en/common/word（Monorepo 共享层：两个前端共享同一份领域模型）。
 */
export const getWordBookList = (params: WordQuery) =>
  serverRequest.get<WordList>("/word-book", params);
