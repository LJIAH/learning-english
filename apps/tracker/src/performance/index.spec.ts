import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PerformanceDto, TrackerConfig } from "@en/common/tracker";
import { setConfig } from "@/config";
import { reportPerformance } from "@/performance";
import { report } from "@/report";

vi.mock("@/report", () => ({
  report: vi.fn(),
  reportFetch: vi.fn(),
}));

const reportMock = vi.mocked(report);

const config: TrackerConfig = {
  baseUrl: "/api/v1",
  uv: { api: "/tracker/uv", updateApi: "/tracker/update-uv" },
  performance: { api: "/tracker/performance" },
};

type Entry = {
  name?: string;
  startTime?: number;
  duration?: number;
  value?: number;
  hadRecentInput?: boolean;
  processingStart?: number;
};

type ObserverCallback = (list: { getEntries: () => Entry[] }) => void;

/** 顶替 jsdom 未实现的 PerformanceObserver，便于按需投喂性能条目并观察 disconnect */
class MockPerformanceObserver {
  static instances: MockPerformanceObserver[] = [];
  static failOnType: string | null = null;

  readonly observed: Record<string, unknown>[] = [];
  disconnected = false;

  constructor(private readonly callback: ObserverCallback) {
    MockPerformanceObserver.instances.push(this);
  }

  observe(options: Record<string, unknown>) {
    if (options.type === MockPerformanceObserver.failOnType) {
      throw new Error(`unsupported entry type: ${String(options.type)}`);
    }
    this.observed.push(options);
  }

  disconnect() {
    this.disconnected = true;
  }

  emit(entries: Entry[]) {
    this.callback({ getEntries: () => entries });
  }
}

const observerFor = (type: string) => {
  const observer = MockPerformanceObserver.instances.find((item) => item.observed.some((opt) => opt.type === type));
  if (!observer) throw new Error(`没有创建监听 ${type} 的 observer`);
  return observer;
};

/** visibilitychange 监听会跨用例挂在同一个 document 上，按 visitorId 只取本次用例产生的上报 */
const bodiesFor = (visitorId: string) =>
  reportMock.mock.calls.map(([, body]) => body as PerformanceDto).filter((body) => body.visitorId === visitorId);

const hidePage = () => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  setConfig(config);
  MockPerformanceObserver.instances = [];
  MockPerformanceObserver.failOnType = null;
  vi.stubGlobal("PerformanceObserver", MockPerformanceObserver);
});

afterEach(() => {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  vi.unstubAllGlobals();
});

describe("reportPerformance", () => {
  it("分别监听 paint / LCP / layout-shift / event 四类指标", () => {
    reportPerformance("perf-1");

    expect(MockPerformanceObserver.instances.flatMap((item) => item.observed.map((opt) => opt.type))).toEqual([
      "paint",
      "largest-contentful-paint",
      "layout-shift",
      "event",
    ]);
    expect(observerFor("paint").observed[0]).toEqual({ type: "paint", buffered: true });
    expect(observerFor("event").observed[0]).toEqual({ type: "event", buffered: true, durationThreshold: 40 });
  });

  it("页面隐藏时汇总各指标并上报，同时断开所有 observer", () => {
    reportPerformance("perf-2");

    observerFor("paint").emit([
      { name: "first-paint", startTime: 12 },
      { name: "first-contentful-paint", startTime: 34 },
    ]);
    // LCP 会随页面加载多次触发，始终取最后一次
    observerFor("largest-contentful-paint").emit([{ startTime: 100 }]);
    observerFor("largest-contentful-paint").emit([{ startTime: 250 }]);
    // CLS 只累计非用户交互引发的偏移
    observerFor("layout-shift").emit([
      { hadRecentInput: false, value: 0.25 },
      { hadRecentInput: true, value: 1 },
    ]);
    observerFor("layout-shift").emit([{ hadRecentInput: false, value: 0.5 }]);
    // INP 取最大交互延迟
    observerFor("event").emit([{ duration: 80 }, { duration: 120 }]);

    hidePage();

    expect(bodiesFor("perf-2")).toEqual([
      { visitorId: "perf-2", fp: 12, fcp: 34, lcp: 250, inp: 120, cls: 0.75 },
    ]);
    expect(MockPerformanceObserver.instances.every((item) => item.disconnected)).toBe(true);
  });

  it("页面仍可见时不触发上报", () => {
    reportPerformance("perf-3");

    document.dispatchEvent(new Event("visibilitychange"));

    expect(bodiesFor("perf-3")).toHaveLength(0);
  });

  it("浏览器不支持 event 类型时降级为 first-input", () => {
    MockPerformanceObserver.failOnType = "event";

    reportPerformance("perf-4");
    observerFor("first-input").emit([{ startTime: 100, processingStart: 160 }]);

    hidePage();

    expect(bodiesFor("perf-4")).toEqual([{ visitorId: "perf-4", fp: 0, fcp: 0, lcp: 0, inp: 60, cls: 0 }]);
  });
});
