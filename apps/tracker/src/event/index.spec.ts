import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventDto, TrackerConfig } from "@en/common/tracker";
import { setConfig } from "@/config";
import { reportEvent } from "@/event";
import { report } from "@/report";

vi.mock("@/report", () => ({
  report: vi.fn(),
  reportFetch: vi.fn(),
}));

const reportMock = vi.mocked(report);

const config: TrackerConfig = {
  baseUrl: "/api/v1",
  uv: { api: "/tracker/uv", updateApi: "/tracker/update-uv" },
  event: { api: "/tracker/event" },
};

/**
 * 监听挂在 document 上且不会随用例卸载，前一个用例的监听仍会在后续用例里触发；
 * 因此每个用例用独立 visitorId，只取本次产生的上报
 */
const bodiesFor = (visitorId: string) =>
  reportMock.mock.calls.map(([, body]) => body as EventDto).filter((body) => body.visitorId === visitorId);

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height }) as DOMRect;

beforeEach(() => {
  setConfig(config);
  document.body.innerHTML = "";
});

describe("reportEvent", () => {
  it("点击 button 时上报事件、位置尺寸与文本", () => {
    reportEvent("event-1");
    const button = document.createElement("button");
    button.textContent = "立即购买";
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue(rect(10, 20, 30, 40));
    document.body.appendChild(button);

    button.click();

    expect(bodiesFor("event-1")).toEqual([
      {
        visitorId: "event-1",
        event: "click",
        url: window.location.href,
        payload: {
          x: "10.00",
          y: "20.00",
          width: "30.00",
          height: "40.00",
          text: "立即购买",
        },
      },
    ]);
  });

  it("点击 button 内的 span 同样上报（按父元素判断）", () => {
    reportEvent("event-2");
    const button = document.createElement("button");
    const span = document.createElement("span");
    span.textContent = "图标";
    button.appendChild(span);
    document.body.appendChild(button);

    span.click();

    const bodies = bodiesFor("event-2");
    expect(bodies).toHaveLength(1);
    expect(bodies[0].event).toBe("click");
    // 上报的是被点击元素自身，不是外层 button
    expect(bodies[0].payload.text).toBe("图标");
  });

  it("点击既不是 button 也不是 span 的元素不上报", () => {
    reportEvent("event-3");
    const div = document.createElement("div");
    document.body.appendChild(div);

    div.click();

    expect(bodiesFor("event-3")).toHaveLength(0);
  });

  it("点击父元素不是 button 的 span 不上报", () => {
    reportEvent("event-4");
    const div = document.createElement("div");
    const span = document.createElement("span");
    div.appendChild(span);
    document.body.appendChild(div);

    span.click();

    expect(bodiesFor("event-4")).toHaveLength(0);
  });
});
