import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackerConfig } from "@en/common/tracker";
import { getConfig } from "@/config";
import { reportEvent } from "@/event";
import { reportError } from "@/error";
import { reportPv } from "@/pv";
import { reportPerformance } from "@/performance";
import { reportFetch } from "@/report";
import { getFingerprint } from "@/uv";
import { Tracker } from "./index";

vi.mock("@/uv", () => ({ getFingerprint: vi.fn(), getBrowerInfo: vi.fn() }));
vi.mock("@/report", () => ({ report: vi.fn(), reportFetch: vi.fn() }));
vi.mock("@/event", () => ({ reportEvent: vi.fn() }));
vi.mock("@/error", () => ({ reportError: vi.fn() }));
vi.mock("@/pv", () => ({ reportPv: vi.fn() }));
vi.mock("@/performance", () => ({ reportPerformance: vi.fn() }));

const fingerprintMock = vi.mocked(getFingerprint);
const reportFetchMock = vi.mocked(reportFetch);

let config: TrackerConfig;

/** 清空微任务队列，等 init() 内部链路跑完 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  config = {
    baseUrl: "/api/v1",
    uv: { api: "/tracker/uv", updateApi: "/tracker/update-uv" },
    pv: { api: "/tracker/pv" },
    event: { api: "/tracker/event" },
    error: { api: "/tracker/error" },
    performance: { api: "/tracker/performance" },
  };
});

describe("Tracker", () => {
  it("构造时写入全局 config，并在指纹就绪后注册四类上报", async () => {
    fingerprintMock.mockResolvedValue("fp-1");

    new Tracker(config);
    await flush();

    expect(getConfig()).toBe(config);
    expect(reportEvent).toHaveBeenCalledWith("fp-1");
    expect(reportError).toHaveBeenCalledWith("fp-1");
    expect(reportPv).toHaveBeenCalledWith("fp-1");
    expect(reportPerformance).toHaveBeenCalledWith("fp-1");
  });

  it("拿不到 visitorId 时跳过所有上报", async () => {
    fingerprintMock.mockResolvedValue("");

    new Tracker(config);
    await flush();

    expect(reportEvent).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
    expect(reportPv).not.toHaveBeenCalled();
    expect(reportPerformance).not.toHaveBeenCalled();
  });

  it("指纹计算失败时不产生未处理拒绝，排队中的 setUserId 仍会执行", async () => {
    fingerprintMock.mockRejectedValue(new Error("fingerprint blocked"));

    const tracker = new Tracker(config);
    tracker.setUserId("user-1");
    await flush();

    // init 内已消化异常 => readyPromise 兑现 => .then(apply) 正常执行
    expect(reportFetchMock).toHaveBeenCalledWith("/api/v1/tracker/update-uv", {
      visitorId: "",
      userId: "user-1",
    });
  });

  it("visitorId 已就绪时 setUserId 立即上报并写回 config", async () => {
    fingerprintMock.mockResolvedValue("fp-1");

    const tracker = new Tracker(config);
    await flush();

    tracker.setUserId("user-9");

    expect(reportFetchMock).toHaveBeenCalledWith("/api/v1/tracker/update-uv", {
      visitorId: "fp-1",
      userId: "user-9",
    });
    expect(config.userId).toBe("user-9");
  });

  it("visitorId 未就绪时 setUserId 排队，等 init 完成后带上 visitorId 上报", async () => {
    let resolveFingerprint!: (visitorId: string) => void;
    fingerprintMock.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveFingerprint = resolve;
      }),
    );

    const tracker = new Tracker(config);
    tracker.setUserId("user-1");
    expect(reportFetchMock).not.toHaveBeenCalled();

    resolveFingerprint("fp-2");
    await flush();

    expect(reportFetchMock).toHaveBeenCalledWith("/api/v1/tracker/update-uv", {
      visitorId: "fp-2",
      userId: "user-1",
    });
  });
});
