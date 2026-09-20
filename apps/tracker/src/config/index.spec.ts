import { describe, expect, it } from "vitest";
import type { TrackerConfig } from "@en/common/tracker";
import { getConfig, setConfig } from "@/config";

const config: TrackerConfig = {
  baseUrl: "/api/v1",
  uv: { api: "/tracker/uv", updateApi: "/tracker/update-uv" },
};

describe("config", () => {
  it("未初始化时读取 config 抛出可定位的错误", () => {
    expect(() => getConfig()).toThrow(
      "[tracker] config 尚未初始化，请先实例化 Tracker 或调用 setConfig",
    );
  });

  it("setConfig 之后 getConfig 返回同一引用", () => {
    setConfig(config);

    expect(getConfig()).toBe(config);
  });
});
