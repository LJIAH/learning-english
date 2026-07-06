import { ref, onBeforeUnmount } from "vue";

/**
 * useVoiceToText 配置项
 */
export interface VoiceOptions {
  /** 识别语言，默认 "zh-CN"，英文可设 "en-US" */
  lang?: string;
  /** 是否连续识别：false=说完一句话自动结束，true=持续监听不自动停 */
  continuous?: boolean;
  /** 是否返回临时结果：true=边说边出字，false=只在一句话说完后返回 */
  interimResults?: boolean;
}

// 浏览器兼容：标准 API 为 SpeechRecognition，Chrome 旧版使用 webkitSpeechRecognition
const getRecognitionCtor = (): typeof SpeechRecognition | null => {
  if (typeof SpeechRecognition !== "undefined") return SpeechRecognition;
  if (typeof webkitSpeechRecognition !== "undefined")
    return webkitSpeechRecognition;
  return null;
};

// ============================================================
// 单例模式：SpeechRecognition 是浏览器底层资源，全局只能有一个活跃实例
// 多个实例会互相冲突；响应式状态也共享，保证所有调用方看到同一份数据
// ============================================================

/** 全局唯一的识别器实例（懒初始化） */
let recognition: SpeechRecognition | null = null;

/** 是否正在收音中 */
const isListening = ref(false);

/** 浏览器是否支持语音识别（若检测到网络/权限错误也视为不可用） */
const isSupported = ref(true);

/** 已确认的最终文本（累积追加，不会丢） */
const finalText = ref("");

/** 当前正在生成的临时文本（边说边变，确认后清空并入 finalText） */
const interimText = ref("");

/** 最近的错误信息，空字符串表示无错误 */
const error = ref("");

// ============================================================
// 组合式函数
// ============================================================
export const useVoiceToText = (options: VoiceOptions = {}) => {
  const { lang = "zh-CN", continuous = true, interimResults = true } = options;

  /**
   * 获取或创建识别器实例（懒初始化 + 配置刷新）
   * - 首次调用：创建单例实例并绑定事件回调
   * - 后续调用：只刷新 lang / continuous / interimResults 配置后复用已有实例
   */
  const ensureRecognition = (): SpeechRecognition | null => {
    // 单例已存在，只刷新配置后复用
    if (recognition) {
      recognition.lang = lang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      return recognition;
    }

    // 首次创建
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      error.value = "当前浏览器不支持语音识别 (SpeechRecognition)";
      isSupported.value = false;
      return null;
    }

    recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1; // 只取最佳匹配，节省开销

    // --- 事件回调（只绑定一次）---

    /**
     * onresult：收到识别结果
     * - isFinal=true  → 追加到 finalText（已确认的句子）
     * - isFinal=false → 更新 interimText（边说话边出的临时文本，会被下一次结果覆盖）
     *
     * 例如用户说 "Hello world"：
     *   第1次回调 → "Hello"      (interim, 临时)
     *   第2次回调 → "Hello world"(final,   最终) → finalText 追加 "Hello world"，interimText 清空
     */
    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      // 从 resultIndex 开始遍历，只处理本轮新增的结果
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const alternative = result[0];
        if (!alternative) continue;
        const transcript = alternative.transcript;
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        finalText.value += final;
      }
      interimText.value = interim;
    };

    /**
     * onerror：识别出错（权限不足、网络问题、不支持等）
     * 常见错误码：not-allowed / no-speech / audio-capture / network / aborted
     */
    recognition.onerror = (event) => {
      const errorMap: Record<string, string> = {
        network: "语音识别服务无法连接，请检查网络代理或翻墙设置",
        "not-allowed": "麦克风权限被拒绝，请在浏览器设置中允许使用麦克风",
        "no-speech": "没有检测到语音，请重试",
        "audio-capture": "无法捕获音频，请检查麦克风设备",
        aborted: "语音识别已取消",
      };
      error.value = errorMap[event.error] || event.error || "语音识别出错";
    };

    /** onend：收音结束（自动结束 / 手动 stop / abort 都会触发） */
    recognition.onend = () => {
      isListening.value = false;
    };

    /** onstart：开始收音，清除上一次的错误信息 */
    recognition.onstart = () => {
      error.value = "";
    };

    return recognition;
  };

  /** 开始收音 */
  const start = () => {
    const rec = ensureRecognition();
    if (!rec) return; // 浏览器不支持
    if (isListening.value) return; // 已在收音，避免重复 start
    try {
      rec.start();
      isListening.value = true;
    } catch (e) {
      error.value = (e as Error).message || "启动语音识别失败";
    }
  };

  /** 停止收音（会触发 onend，将当前临时结果最终化） */
  const stop = () => {
    if (!recognition || !isListening.value) return;
    recognition.stop();
    isListening.value = false;
  };

  /** 清空所有识别结果和错误 */
  const reset = () => {
    finalText.value = "";
    interimText.value = "";
    error.value = "";
  };

  /**
   * 组件卸载时自动停止收音
   * 注意：因为是单例共享资源，只 stop 不 abort 不置 null，
   * 避免影响页面中其他正在使用本 hook 的组件
   */
  onBeforeUnmount(() => {
    stop();
  });

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
