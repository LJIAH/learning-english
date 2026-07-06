# Report 上报模块

本模块提供两种数据上报方式，适用于不同的埋点/监控场景。

## 源码位置

`apps/tracker/src/report/index.ts`

## 两种上报方式

### 1. `report` — `navigator.sendBeacon`

```ts
export const report = async (url: string, body: any) => {
  const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
  navigator.sendBeacon(url, blob);
};
```

**优点**

- **专为页面卸载场景设计**：即使页面正在关闭（`unload`/`pagehide`），浏览器仍会保证请求被发出，特别适合埋点上报。
- **异步非阻塞**：不阻塞主线程，不影响页面跳转性能。
- **不需要等待响应**：无需 Promise 串联，开销小。

**缺点**

- **无法获取响应结果**：只返回布尔值表示是否成功入队，不能拿到服务端返回内容。
- **数据体积有限制**：通常 64KB 左右（各浏览器不同），超过会被拒绝。
- **请求头/方法受限**：只能 POST，无法自定义 headers（需通过 `Blob` 的 type 间接设置）。
- **兼容性**：老旧浏览器（IE）不支持。
- **错误处理弱**：失败后无法重试或精确感知。

---

### 2. `reportFetch` — `fetch` + `keepalive`

```ts
export const reportFetch = async (url: string, body: any) => {
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response.json();
};
```

**优点**

- **可获取响应内容**：`return response.json()`，适合需要服务端回执的场景。
- **支持自定义 headers**：可设置 `Content-Type`、鉴权等头信息，灵活度高。
- **`keepalive: true`**：让请求在页面卸载后仍能继续发送，兼顾了"卸载场景上报"能力。
- **可结合 Promise 链做重试/错误处理**：失败可捕获并处理。
- **兼容现代浏览器**，API 更通用。

**缺点**

- **`keepalive` 也有体积限制**：一般约 64KB，超过同样会被截断或拒绝。
- **相对 sendBeacon 开销略大**：需要建立完整 fetch 流程，且等待响应可能轻微影响跳转。
- **异步等待响应**：若服务端返回慢，可能阻塞后续逻辑（或导致页面卸载前未完成）。
- **错误未处理**：当前实现没有 `try/catch`，`response.json()` 失败会抛异常；且未判断 `response.ok`。

---

## 对比总结

| 维度             | `report` (sendBeacon) | `reportFetch` (fetch+keepalive) |
| ---------------- | --------------------- | ------------------------------- |
| 卸载时上报可靠性 | ★★★★★（原生保证）     | ★★★★（依赖 keepalive）          |
| 获取响应         | ❌                    | ✅                              |
| 自定义 headers   | ❌（受限）            | ✅                              |
| 数据体积         | ~64KB                 | ~64KB                           |
| 错误处理         | 弱                    | 可扩展（当前未做）              |
| 适用场景         | 纯发埋点、无需回执    | 需要回执/鉴权的上报             |

## 使用建议

- 对 `report`：检查 `sendBeacon` 返回值，失败时降级到 `reportFetch`。
- 对 `reportFetch`：加 `try/catch` 并判断 `response.ok`，避免异常吞没。
- 推荐组合使用：默认走 `report`，需要回执或自定义头时走 `reportFetch`。
