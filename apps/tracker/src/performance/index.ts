import type { PerformanceDto } from "@en/common/tracker";
import { getConfig } from "@/config";
import { report } from "@/report";

/**
 * 创建 PerformanceObserver 并开始监听
 * @param type    监听类型
 * @param handler 收到条目时的处理回调
 * @param extra   额外的 observe 选项（如 durationThreshold）
 * @returns observer 实例（供外部 disconnect）
 */
const createObserver = (
  type: string,
  handler: (list: PerformanceObserverEntryList) => void,
  extra?: Record<string, any>,
) => {
  const observer = new PerformanceObserver(handler);
  observer.observe({ type, buffered: true, ...extra });
  return observer;
};

export const reportPerformance = (visitorId: string) => {
  const config = getConfig();
  const url = config.baseUrl + config.performance!.api;
  let fp = 0; // 首次绘制 (First Paint)：页面首次开始渲染的时间点
  let fcp = 0; // 首次内容绘制 (First Contentful Paint)：页面首次有内容（文本/图片等）渲染的时间点
  let lcp = 0; // 最大内容绘制 (Largest Contentful Paint)：视口内最大可见内容元素完成渲染的时间
  let inp = 0; // 交互到下次绘制 (Interaction to Next Paint)：用户交互到页面响应下一次绘制的延迟时间
  let cls = 0; // 累计布局偏移 (Cumulative Layout Shift)：页面生命周期内所有意外布局偏移的累积分数

  const observers: PerformanceObserver[] = [];

  // 1. 监听 FP 和 FCP（通过 paint 类型一次性拿到两个）
  observers.push(
    createObserver("paint", (list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-paint") fp = entry.startTime;
        if (entry.name === "first-contentful-paint") fcp = entry.startTime;
      }
    }),
  );

  // 2. 监听 LCP：会多次触发（页面加载中越来越大的元素出现），始终取最后一次
  observers.push(
    createObserver("largest-contentful-paint", (list) => {
      const entries = list.getEntries();
      lcp = entries.at(-1)!.startTime || 0;
    }),
  );

  // 3. 监听 CLS：累计所有非用户交互触发的布局偏移值
  let clsValue = 0;
  observers.push(
    createObserver("layout-shift", (list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          cls = clsValue;
        }
      }
    }),
  );

  // 4. 监听 INP：优先用 event 类型（更精确），不支持则降级为 first-input（FID）
  try {
    observers.push(
      createObserver(
        "event",
        (list) => {
          for (const entry of list.getEntries()) {
            inp = Math.max(inp, entry.duration);
          }
        },
        { durationThreshold: 40 },
      ),
    );
  } catch {
    observers.push(
      createObserver("first-input", (list) => {
        for (const entry of list.getEntries()) {
          inp = (entry as any).processingStart - entry.startTime;
        }
      }),
    );
  }

  // 页面隐藏时断开所有 Observer 并上报最终值
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      const body: PerformanceDto = {
        visitorId,
        fp,
        fcp,
        lcp,
        inp,
        cls,
      };
      report(url, body);
      observers.forEach((o) => o.disconnect());
    }
  });
};
