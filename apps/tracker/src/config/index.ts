import type { TrackerConfig } from "@en/common/tracker";

let config: TrackerConfig | null = null;

export const setConfig = (cfg: TrackerConfig) => {
  config = cfg;
};

export const getConfig = (): TrackerConfig => {
  if (!config) {
    throw new Error(
      "[tracker] config 尚未初始化，请先实例化 Tracker 或调用 setConfig",
    );
  }
  return config;
};
