import { createApp } from "vue";
import vFocus from "./directives/focus";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./assets/base.css";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import zhCn from "element-plus/es/locale/lang/zh-cn";

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.use(ElementPlus, {
  locale: zhCn,
});
app.directive("focus", vFocus);
app.use(router);

app.mount("#app");
