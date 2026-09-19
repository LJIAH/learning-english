import type { TrackerConfig } from "@en/common/tracker";
import { setConfig } from "@/config";
import { getFingerprint } from "@/uv";
import { reportEvent } from "@/event";
import { reportError } from "@/error";
import { reportPv } from "@/pv";
import { reportPerformance } from "@/performance";
import { reportFetch } from "@/report";
export class Tracker {
  private visitorId: string = "";
  // init 是异步的，外部可能在 init 完成前就调用 setUserId 等方法，
  // 用 readyPromise 保证这些调用在 visitorId 就绪后才真正执行
  private readyPromise: Promise<void>;
  constructor(private readonly config: TrackerConfig) {
    // 初始化全局 config，各上报模块通过 getConfig() 读取，无需逐层透传
    setConfig(this.config);
    this.readyPromise = this.init();
  }
  protected async init() {
    try {
      this.visitorId = await getFingerprint();
      // UV 注册失败（无 visitorId）时跳过后续上报，避免发送无归属的埋点数据
      if (!this.visitorId) return;
      reportEvent(this.visitorId);
      reportError(this.visitorId);
      reportPv(this.visitorId);
      reportPerformance(this.visitorId);
    } catch {
      // 埋点是旁路能力：初始化失败静默降级，readyPromise 永不 reject
    }
  }
  // 设置用户id,用于uv统计
  setUserId(userId: string) {
    const apply = () => {
      const url = this.config.baseUrl + this.config.uv!.updateApi;
      const body = {
        visitorId: this.visitorId,
        userId,
      };
      reportFetch(url, body);
      this.config.userId = userId;
    };
    // visitorId 已就绪则立即执行，否则等 init 完成后再执行
    if (this.visitorId) {
      apply();
    } else {
      this.readyPromise.then(apply);
    }
  }
}

// const tracker = new Tracker({
//   baseUrl: "/api/v1",
//   uv: {
//     api: "/tracker/uv",
//     updateApi: "/tracker/update-uv",
//   },
//   pv: {
//     api: "/tracker/pv",
//   },
//   event: {
//     api: "/tracker/event",
//   },
//   error: {
//     api: "/tracker/error",
//   },
//   performance: {
//     api: "/tracker/performance",
//   },
// });
// tracker.setUserId("cmqqutcte0000t0uw5o8xtejz");
// setTimeout(() => {
//   throw new Error("test error");
// }, 5000);
