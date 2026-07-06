import { report } from "@/report";
import type { PerformanceDto, TrackerConfig } from "@en/common/tracker";
import { onCLS, onFCP, onLCP, onINP } from "web-vitals";

export const reportPerformance = (visitorId: string, config: TrackerConfig) => {
  const url = config.baseUrl + config.performance!.api;
  let fp = 0; // FP 不在 Core Web Vitals 中，web-vitals 不提供，需单独用 paint observer 采集
  let fcp = 0; // 首次内容绘制 (First Contentful Paint)
  let lcp = 0; // 最大内容绘制 (Largest Contentful Paint)
  let inp = 0; // 交互到下次绘制 (Interaction to Next Paint)
  let cls = 0; // 累计布局偏移 (Cumulative Layout Shift)

  // FP：web-vitals 不提供，保留原生 Observer
  const fpObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === "first-paint") fp = entry.startTime;
    }
  });
  fpObserver.observe({ type: "paint", buffered: true });

  // FCP / LCP / CLS / INP：web-vitals 内部已监听 visibilitychange 并在页面隐藏时自动上报最终值
  onFCP(({ value }) => {
    fcp = value;
  });
  onLCP(({ value }) => {
    lcp = value;
  });
  onCLS(({ value }) => {
    cls = value;
  });
  onINP(({ value }) => {
    inp = value;
  });

  // 页面隐藏时断开 FP Observer 并上报最终值（web-vitals 的指标已由库自行处理）
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") {
        // TODO: 在此上报 fp / fcp / lcp / inp / cls
        console.log({ fp, fcp, lcp, inp, cls });
        const body: PerformanceDto = {
          visitorId,
          fp,
          fcp,
          lcp,
          inp,
          cls,
        };
        report(url, body);
        fpObserver.disconnect();
      }
    },
    { once: true },
  );
};
