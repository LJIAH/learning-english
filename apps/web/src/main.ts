import { createApp } from "vue";
import vFocus from "./directives/focus";
import vSafeHtml from "./directives/safe-html";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./assets/base.css";
// Element Plus 已改为按需引入（见 vite.config.ts 中的 unplugin 配置）：
// - 模板里的 el-* 组件及其样式由 Components 插件自动注入
// - 下面只为「服务式 API」显式补齐样式（组件本身在代码里是显式 import 的）
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.directive("focus", vFocus);
app.directive("safe-html", vSafeHtml);
app.use(router);

app.mount("#app");
