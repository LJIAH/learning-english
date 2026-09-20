import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorDto, TrackerConfig } from "@en/common/tracker";
import { setConfig } from "@/config";
import { reportError } from "@/error";
import { report } from "@/report";

vi.mock("@/report", () => ({
  report: vi.fn(),
  reportFetch: vi.fn(),
}));

const reportMock = vi.mocked(report);

const config: TrackerConfig = {
  baseUrl: "/api/v1",
  uv: { api: "/tracker/uv", updateApi: "/tracker/update-uv" },
  error: { api: "/tracker/error" },
};

/** window 上的监听会跨用例累积，按 visitorId 只取本次用例产生的上报 */
const bodiesFor = (visitorId: string) =>
  reportMock.mock.calls.map(([, body]) => body as ErrorDto).filter((body) => body.visitorId === visitorId);

const dispatchUnhandledRejection = (reason: unknown) => {
  const event =
    typeof PromiseRejectionEvent === "function"
      ? new PromiseRejectionEvent("unhandledrejection", { promise: Promise.resolve(), reason })
      : Object.assign(new Event("unhandledrejection"), { reason });
  window.dispatchEvent(event);
};

beforeEach(() => {
  setConfig(config);
});

describe("reportError", () => {
  it("window error 上报 JS 运行时错误的 message / stack", () => {
    reportError("error-1");
    const error = new Error("boom");

    window.dispatchEvent(new ErrorEvent("error", { error, filename: "https://en.example.com/app.js" }));

    expect(bodiesFor("error-1")).toEqual([
      {
        visitorId: "error-1",
        error: "js",
        message: "boom",
        stack: error.stack,
        url: "https://en.example.com/app.js",
      },
    ]);
  });

  it("reason 为 Error 时上报 promise 错误的 message / stack", () => {
    reportError("error-2");
    const reason = new Error("promise boom");

    dispatchUnhandledRejection(reason);

    expect(bodiesFor("error-2")).toEqual([
      {
        visitorId: "error-2",
        error: "promise",
        message: "promise boom",
        stack: reason.stack,
        url: window.location.href,
      },
    ]);
  });

  it("reason 非 Error 时序列化 reason，堆栈记为 Promise Rejection", () => {
    reportError("error-3");

    dispatchUnhandledRejection({ code: 500 });

    expect(bodiesFor("error-3")).toEqual([
      {
        visitorId: "error-3",
        error: "promise",
        message: '{"code":500}',
        stack: "Promise Rejection",
        url: window.location.href,
      },
    ]);
  });
});
