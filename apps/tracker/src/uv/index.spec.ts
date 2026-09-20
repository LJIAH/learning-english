import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackerConfig } from "@en/common/tracker";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { setConfig } from "@/config";
import { reportFetch } from "@/report";
import { getBrowerInfo, getFingerprint } from "@/uv";

/** UA 解析结果由用例驱动，避免依赖真实浏览器环境 */
const ua = vi.hoisted(() => ({
  browser: "Chrome" as string | undefined,
  os: "Windows" as string | undefined,
  device: undefined as string | undefined,
}));

vi.mock("ua-parser-js", () => ({
  UAParser: vi.fn(function () {
    return {
      getBrowser: () => ({ name: ua.browser }),
      getOS: () => ({ name: ua.os }),
      getDevice: () => ({ type: ua.device }),
    };
  }),
}));

vi.mock("@fingerprintjs/fingerprintjs", () => ({
  default: { load: vi.fn() },
}));

vi.mock("@/report", () => ({
  report: vi.fn(),
  reportFetch: vi.fn(),
}));

const reportFetchMock = vi.mocked(reportFetch);
const loadMock = vi.mocked(FingerprintJS.load);

const config: TrackerConfig = {
  baseUrl: "/api/v1",
  uv: { api: "/tracker/uv", updateApi: "/tracker/update-uv" },
};

const stubFingerprint = (visitorId: string) => {
  loadMock.mockResolvedValue({
    get: async () => ({ visitorId }),
  } as unknown as Awaited<ReturnType<typeof FingerprintJS.load>>);
};

beforeEach(() => {
  setConfig(config);
  ua.browser = "Chrome";
  ua.os = "Windows";
  ua.device = undefined;
});

describe("getBrowerInfo", () => {
  it("返回浏览器 / 系统，设备类型缺省为 desktop", () => {
    expect(getBrowerInfo()).toEqual({ browser: "Chrome", os: "Windows", device: "desktop" });
  });

  it("移动端返回具体设备类型", () => {
    ua.device = "mobile";

    expect(getBrowerInfo()).toEqual({ browser: "Chrome", os: "Windows", device: "mobile" });
  });
});

describe("getFingerprint", () => {
  it("携带浏览器信息与匿名 ID 上报 UV，并返回服务端给出的 visitorId", async () => {
    stubFingerprint("fp-abc");
    reportFetchMock.mockResolvedValue({ data: "visitor-1" });

    await expect(getFingerprint()).resolves.toBe("visitor-1");

    expect(reportFetchMock).toHaveBeenCalledWith("/api/v1/tracker/uv", {
      browser: "Chrome",
      os: "Windows",
      device: "desktop",
      anonymousId: "fp-abc",
    });
  });

  it("上报失败（返回 null）时不抛错，得到 undefined", async () => {
    stubFingerprint("fp-abc");
    reportFetchMock.mockResolvedValue(null);

    await expect(getFingerprint()).resolves.toBeUndefined();
  });

  it("指纹计算失败时向上抛出，由调用方兜底", async () => {
    loadMock.mockRejectedValue(new Error("fingerprint blocked"));

    await expect(getFingerprint()).rejects.toThrow("fingerprint blocked");
  });
});
