export const report = async (url: string, body: any) => {
  const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
  navigator.sendBeacon(url, blob);
};

export const reportFetch = async (url: string, body: any) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
      },
    });
    // 网关异常（如 502）时响应体不是 JSON，需显式兜底
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // 上报是旁路能力：任何失败都静默降级，绝不向宿主页面抛异常
    return null;
  }
};
