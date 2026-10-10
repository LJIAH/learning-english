import type { Word } from "@en/common/word";
import { WORDS } from "./word-book";

/**
 * 学习接口 —— 对应 Vue 版 apis/learn/index.ts，当前为 mock 实现。
 *
 * 复用 apis/word-book 的 WORDS 作为词源，避免再造一份假数据。
 */

const GROUP_SIZE = 10;

/** 按 courseId 稳定地取一组词（同一课程每次拿到同一组，便于观察效果） */
const pickGroup = (courseId: string): Word[] => {
  const seed = [...courseId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const start = seed % Math.max(1, WORDS.length - GROUP_SIZE);
  return WORDS.slice(start, start + GROUP_SIZE);
};

export async function getWordList(courseId: string): Promise<{
  success: boolean;
  data?: Word[];
  message?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (!courseId) return { success: false, message: "课程 ID 不能为空" };
  return { success: true, data: pickGroup(courseId) };
}

export async function saveWordMaster(wordIds: string[]): Promise<{
  success: boolean;
  data?: { wordNumber: number };
  message?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    success: true,
    data: { wordNumber: wordIds.length },
    message: "已保存本组学习记录",
  };
}
