import { useEffect } from "react";
import { create } from "zustand";

/**
 * useVoiceToText 配置项（与 Vue 版一致）
 */
export interface VoiceOptions {
  /** 识别语言，默认 "zh-CN"，英文可设 "en-US" */
  lang?: string;
  /** 是否连续识别：false=说完一句话自动结束，true=持续监听不自动停 */
  continuous?: boolean;
  /** 是否返回临时结果：true=边说边出字，false=只在一句话说完后返回 */
  interimResults?: boolean;
}

type ResolvedOptions = Required<VoiceOptions>;

const DEFAULT_OPTIONS: ResolvedOptions = {
  lang: "zh-CN",
  continuous: true,
  interimResults: true,
};

// 浏览器兼容：标准 API 为 SpeechRecognition，Chrome 旧版使用 webkitSpeechRecognition
const getRecognitionCtor = (): typeof SpeechRecognition | null => {
  if (typeof SpeechRecognition !== "undefined") return SpeechRecognition;
  if (typeof webkitSpeechRecognition !== "undefined")
    return webkitSpeechRecognition;
  return null;
};

interface VoiceState {
  /** 是否正在收音中 */
  isListening: boolean;
  /** 浏览器是否支持语音识别（检测到不支持时置 false） */
  isSupported: boolean;
  /** 已确认的最终文本（累积追加，不会丢） */
  finalText: string;
  /** 当前正在生成的临时文本（边说边变，确认后清空并入 finalText） */
  interimText: string;
  /** 最近的错误信息，空字符串表示无错误 */
  error: string;
}

/**
 * 识别状态放 zustand store —— 与 Vue 版把 ref 放在模块级同理。
 *
 * SpeechRecognition 是浏览器底层资源，全局只能有一个活跃实例（多实例会互相冲突），
 * 所以「识别器」与「状态」都必须是模块级单例：所有调用方看到同一份数据。
 * 状态放在 store 里而不是组件 state，也正因为事件回调发生在 React 之外
 * （回调里用 useVoiceToTextStore.setState 直接写入，不依赖组件生命周期）。
 */
const useVoiceToTextStore = create<VoiceState>()(() => ({
  isListening: false,
  isSupported: true,
  finalText: "",
  interimText: "",
  error: "",
}));

/** 供调用方直接订阅（例如把识别结果同步进输入框） */
export { useVoiceToTextStore };

const setState = useVoiceToTextStore.setState;

/** 全局唯一的识别器实例（懒初始化） */
let recognition: SpeechRecognition | null = null;

/** 最近一次由组件传入的配置，start() 时生效（对应 Vue 版在 ensureRecognition 里刷新配置） */
let currentOptions: ResolvedOptions = { ...DEFAULT_OPTIONS };

/**
 * 获取或创建识别器实例（懒初始化 + 配置刷新）
 * - 首次调用：创建单例实例并绑定事件回调
 * - 后续调用：只刷新 lang / continuous / interimResults 配置后复用已有实例
 */
const ensureRecognition = (): SpeechRecognition | null => {
  if (recognition) {
    recognition.lang = currentOptions.lang;
    recognition.continuous = currentOptions.continuous;
    recognition.interimResults = currentOptions.interimResults;
    return recognition;
  }

  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    setState({
      error: "当前浏览器不支持语音识别 (SpeechRecognition)",
      isSupported: false,
    });
    return null;
  }

  const rec = new Ctor();
  rec.lang = currentOptions.lang;
  rec.continuous = currentOptions.continuous;
  rec.interimResults = currentOptions.interimResults;
  rec.maxAlternatives = 1; // 只取最佳匹配，节省开销

  // --- 事件回调（只绑定一次）---

  /**
   * onresult：收到识别结果
   * - isFinal=true  → 追加到 finalText（已确认的句子）
   * - isFinal=false → 更新 interimText（边说边出的临时文本，会被下一次结果覆盖）
   *
   * 例如用户说 "Hello world"：
   *   第1次回调 → "Hello"       (interim, 临时)
   *   第2次回调 → "Hello world" (final,   最终) → finalText 追加，interimText 清空
   */
  rec.onresult = (event) => {
    let interim = "";
    let final = "";
    // 从 resultIndex 开始遍历，只处理本轮新增的结果
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result) continue;
      const alternative = result[0];
      if (!alternative) continue;
      if (result.isFinal) {
        final += alternative.transcript;
      } else {
        interim += alternative.transcript;
      }
    }
    // 用函数式 setState 读取最新值，避免回调闭包里的旧值
    if (final) {
      setState((s) => ({ finalText: s.finalText + final }));
    }
    setState({ interimText: interim });
  };

  /**
   * onerror：识别出错（权限不足、网络问题、不支持等）
   * 常见错误码：not-allowed / no-speech / audio-capture / network / aborted
   */
  rec.onerror = (event) => {
    const errorMap: Record<string, string> = {
      network: "语音识别服务无法连接，请检查网络代理或翻墙设置",
      "not-allowed": "麦克风权限被拒绝，请在浏览器设置中允许使用麦克风",
      "no-speech": "没有检测到语音，请重试",
      "audio-capture": "无法捕获音频，请检查麦克风设备",
      aborted: "语音识别已取消",
    };
    setState({ error: errorMap[event.error] || event.error || "语音识别出错" });
  };

  /** onend：收音结束（自动结束 / 手动 stop / abort 都会触发） */
  rec.onend = () => setState({ isListening: false });

  /** onstart：开始收音，清除上一次的错误信息 */
  rec.onstart = () => setState({ error: "" });

  recognition = rec;
  return rec;
};

/** 开始收音 */
const start = () => {
  const rec = ensureRecognition();
  if (!rec) return; // 浏览器不支持
  if (useVoiceToTextStore.getState().isListening) return; // 已在收音，避免重复 start
  try {
    rec.start();
    setState({ isListening: true });
  } catch (e) {
    setState({ error: (e as Error).message || "启动语音识别失败" });
  }
};

/** 停止收音（会触发 onend，将当前临时结果最终化） */
const stop = () => {
  if (!recognition || !useVoiceToTextStore.getState().isListening) return;
  recognition.stop();
  setState({ isListening: false });
};

/** 清空所有识别结果和错误 */
const reset = () => setState({ finalText: "", interimText: "", error: "" });

/**
 * 语音转文字 —— 对应 Vue 版 hooks/useVoiceToText.ts。
 *
 * 用法差异（与其它 hook 的移植一致）：
 *   Vue   : const { isListening, finalText } = useVoiceToText()   // 返回 ref
 *   React : const { isListening, finalText } = useVoiceToText()   // 返回当前值，变化会触发重渲染
 */
export const useVoiceToText = (options?: VoiceOptions) => {
  const isListening = useVoiceToTextStore((s) => s.isListening);
  const isSupported = useVoiceToTextStore((s) => s.isSupported);
  const finalText = useVoiceToTextStore((s) => s.finalText);
  const interimText = useVoiceToTextStore((s) => s.interimText);
  const error = useVoiceToTextStore((s) => s.error);

  // 把本次传入的配置同步到模块级：start() 在 React 之外调用，拿不到组件参数
  const { lang, continuous, interimResults } = options ?? {};
  useEffect(() => {
    currentOptions = {
      lang: lang ?? DEFAULT_OPTIONS.lang,
      continuous: continuous ?? DEFAULT_OPTIONS.continuous,
      interimResults: interimResults ?? DEFAULT_OPTIONS.interimResults,
    };
  }, [lang, continuous, interimResults]);

  /**
   * 组件卸载时停止收音（对应 Vue 的 onBeforeUnmount）。
   * 注意：因为是单例共享资源，只 stop 不 abort 不置 null，
   * 避免影响页面中其他正在使用本 hook 的组件。
   */
  useEffect(() => () => stop(), []);

  return {
    isListening,
    isSupported,
    finalText,
    interimText,
    error,
    start,
    stop,
    reset,
  };
};
