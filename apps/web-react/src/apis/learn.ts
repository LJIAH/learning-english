import type { ResultLearn } from "@en/common/learn";
import type { Word } from "@en/common/word";
import { serverRequest } from "./request";

/** 学习接口 —— 对应 Vue 版 apis/learn/index.ts。 */

export const getWordList = (id: string) =>
  serverRequest.get<Word[]>(`/learn/word/${id}`);

export const saveWordMaster = (wordIds: string[]) =>
  serverRequest.post<ResultLearn>("/learn/word/master", { wordIds });
