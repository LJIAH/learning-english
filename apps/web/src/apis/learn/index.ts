import { serverRequest } from "..";
import type { Word } from "@en/common/word";
import type { ResultLearn } from "@en/common/learn";

export const getWordList = (id: string) =>
  serverRequest.get<Word[]>(`/learn/word/${id}`);

export const saveWordMaster = (wordIds: string[]) =>
  serverRequest.post<ResultLearn>("/learn/word/master", { wordIds });
