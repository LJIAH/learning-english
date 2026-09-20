import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PvDto, TrackerConfig } from "@en/common/tracker";
import { setConfig } from "@/config";
import { reportPv } from "@/pv";
import { report } from "@/report";

vi.mock("@/report", () => ({
  report: vi.fn(),
  reportFetch: vi.fn(),
}));

const reportMock = vi.mocked(report);

const config: TrackerConfig = {
  baseUrl: "/api/v1",
  uv: { api: "/tracker/uv", updateApi: "/tracker/update-uv" },
  pv: { api: "/tracker/pv" },
};

// reportPv 会改写 history 方法；保存原生实现，用于重置状态和「只改地址不触发上报」
const nativePushState = window.history.pushState;
const nativeReplaceState = window.history.replaceState;

/** 监听挂在 window 上会跨用例累积，按 visitorId 只取本次用例产生的上报 */
const bodiesFor = (visitorId: string) =>
  reportMock.mock.calls.map(([, body]) => body as PvDto).filter((body) => body.visitorId === visitorId);

const lastBodyFor = (visitorId: string) => bodiesFor(visitorId).at(-1);

const goto = (url: string) => nativeReplaceState.call(window.history, {}, "", url);

beforeEach(() => {
  setConfig(config);
  window.history.pushState = nativePushState;
  window.history.replaceState = nativeReplaceState;
  goto("/");
});

describe("reportPv", () => {
  it("初始化时立即上报一次 PV", () => {
    reportPv("pv-1");

    expect(bodiesFor("pv-1")).toEqual([
      {
        visitorId: "pv-1",
        url: "https://en.example.com",
        referrer: "",
        path: "/",
      },
    ]);
  });

  it("hash 变化时上报，path 取 hash 部分", () => {
    reportPv("pv-2");
    goto("/#/course/1");

    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(bodiesFor("pv-2")).toHaveLength(2);
    expect(lastBodyFor("pv-2")?.path).toBe("/#/course/1");
  });

  it("history.pushState 后上报新路径", () => {
    reportPv("pv-3");

    window.history.pushState({}, "", "/pricing?from=nav");

    expect(bodiesFor("pv-3")).toHaveLength(2);
    expect(lastBodyFor("pv-3")?.path).toBe("/pricing");
  });

  it("history.replaceState 后上报新路径", () => {
    reportPv("pv-4");

    window.history.replaceState({}, "", "/about");

    expect(bodiesFor("pv-4")).toHaveLength(2);
    expect(lastBodyFor("pv-4")?.path).toBe("/about");
  });

  it("popstate 且真实路径变化时上报（浏览器前进后退）", () => {
    reportPv("pv-5");
    nativePushState.call(window.history, {}, "", "/courses");

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(bodiesFor("pv-5")).toHaveLength(2);
    expect(lastBodyFor("pv-5")?.path).toBe("/courses");
  });

  it("popstate 但真实路径未变（仅 hash 变化）时不重复上报", () => {
    reportPv("pv-6");
    nativePushState.call(window.history, {}, "", "/#/other");

    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(bodiesFor("pv-6")).toHaveLength(1);
  });

  it("popstate 同一路径只上报一次，路径再次变化时继续上报", () => {
    reportPv("pv-7");
    nativePushState.call(window.history, {}, "", "/courses");

    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    nativePushState.call(window.history, {}, "", "/courses/1");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(bodiesFor("pv-7").map((body) => body.path)).toEqual(["/", "/courses", "/courses/1"]);
  });
});
