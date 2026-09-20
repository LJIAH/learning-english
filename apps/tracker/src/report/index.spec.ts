import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { report, reportFetch } from "@/report";

const sendBeacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);

const jsonResponse = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as unknown as Response;

const brokenJsonResponse = (ok: boolean, status: number) =>
  ({
    ok,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token < in JSON at position 0");
    },
  }) as unknown as Response;

beforeEach(() => {
  // jsdom 未实现 navigator.sendBeacon，注入可观测的替身
  Object.defineProperty(navigator, "sendBeacon", {
    value: sendBeacon,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("report", () => {
  it("把 body 序列化成 application/json 的 Blob 交给 sendBeacon", async () => {
    const body = { visitorId: "visitor-1", path: "/" };

    await report("/api/v1/tracker/pv", body);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(url).toBe("/api/v1/tracker/pv");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/json");
    await expect(blob.text()).resolves.toBe(JSON.stringify(body));
  });
});

describe("reportFetch", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  it("以 keepalive 的 POST 上报并返回解析后的响应体", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: "visitor-1" }));

    await expect(reportFetch("/api/v1/tracker/uv", { anonymousId: "fp-1" })).resolves.toEqual({
      data: "visitor-1",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/tracker/uv", {
      method: "POST",
      body: JSON.stringify({ anonymousId: "fp-1" }),
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    });
  });

  it("响应非 2xx（如网关 502）时静默返回 null，不抛异常", async () => {
    // 网关错误页不是 JSON，json() 会抛 SyntaxError，必须被兜住
    fetchMock.mockResolvedValue(brokenJsonResponse(false, 502));

    await expect(reportFetch("/api/v1/tracker/uv", {})).resolves.toBeNull();
  });

  it("请求本身失败（断网 / 被拦截）时静默返回 null", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(reportFetch("/api/v1/tracker/uv", {})).resolves.toBeNull();
  });

  it("响应体为空导致解析失败时静默返回 null", async () => {
    fetchMock.mockResolvedValue(brokenJsonResponse(true, 200));

    await expect(reportFetch("/api/v1/tracker/uv", {})).resolves.toBeNull();
  });
});
