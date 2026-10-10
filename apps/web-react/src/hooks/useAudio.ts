import { useCallback } from "react";

export interface Options {
  pitch?: number; // 音调 0-2
  rate?: number; // 语速 0-1
  volume?: number; // 音量 0-1
  lang?: string; // 语言
}

/**
 * 单词发音 —— 对应 Vue 版 hooks/useAudio.ts。
 *
 * 该文件原本就没有任何框架依赖（只用 Web Speech API），因此是原样搬运。
 * 唯一改动：playAudio 用 useCallback 固定引用，避免每次渲染生成新函数
 * 导致依赖它的子组件重复渲染。
 */
let instance: SpeechSynthesisUtterance | null = null;

const getInstance = (options: Options) => {
  if (!instance) {
    instance = new SpeechSynthesisUtterance();
    const { pitch = 1, rate = 0.7, volume = 1, lang = "en-US" } = options;
    instance.pitch = pitch;
    instance.rate = rate;
    instance.volume = volume;
    instance.lang = lang;
  }
  return instance;
};

export const useAudio = (options: Options) => {
  const playAudio = useCallback(
    (word: string) => {
      const pronounce = getInstance(options);
      pronounce.text = word;
      window.speechSynthesis.speak(pronounce);
    },
    // options 为字面量对象，字段在首次创建单例时已固化，无需进入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { playAudio };
};
