import { serverRequest } from "..";
import type { AxiosRequestConfig } from "axios";
import type { WordList, WordQuery } from "@en/common/word";

export const getWordBookList = (
  params: WordQuery,
  config?: AxiosRequestConfig,
) => serverRequest.get<WordList>("/word-book", params, config);
