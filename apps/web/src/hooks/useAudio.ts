export interface Options {
  pitch?: number; // 音调 0-2
  rate?: number; // 语速 0-1
  volume?: number; // 音量 0-1
  lang?: string; // 语言
}
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
  const pronounce = getInstance(options);
  const playAudio = (word: string) => {
    pronounce.text = word;
    window.speechSynthesis.speak(pronounce);
  };
  return { playAudio };
};
