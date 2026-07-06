已完成，以下是封装说明：

**[focus.ts](file:///g:/test/Nest/english/apps/web/src/directives/focus.ts)** — 指令实现

- **基础用法**：`v-focus` — 元素挂载后自动聚焦
- **传入配置**：
  - `v-focus="{ auto: false }"` — 禁用自动聚焦
  - `v-focus="{ delay: 300 }"` — 延迟 300ms 后聚焦（适用于动画/弹窗场景）
- **智能查找**：若绑定元素不是表单控件，会自动查找内部第一个 `input`/`textarea`/`select`
- **响应式更新**：当 `auto` 从 `false` 变为 `true` 时自动重新聚焦

**[main.ts](file:///g:/test/Nest/english/apps/web/src/main.ts)** — 全局注册为 `v-focus`

**使用示例：**

```vue
<!-- 最简用法 -->
<input v-focus />

<!-- 延迟聚焦 -->
<input v-focus="{ delay: 200 }" />

<!-- 条件控制 -->
<input v-focus="{ auto: showDialog }" />
```
