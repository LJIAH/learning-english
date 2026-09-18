<template>
  <!-- Element Plus 按需引入后不再有 app.use(ElementPlus) 提供 locale，
       改由 el-config-provider 在根组件统一注入中文文案 -->
  <el-config-provider :locale="zhCn">
    <RouterView />
    <!-- 弹窗组件按需挂载：首次打开时才加载对应 chunk（含表单/上传/接口层等较重的代码） -->
    <Search v-if="isShowSearch" />
    <Login v-if="isShowLogin" />
  </el-config-provider>
</template>

<script lang="ts" setup>
import { RouterView } from "vue-router";
import { defineAsyncComponent, onMounted, watch } from "vue";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { useUserStore } from "./stores/user.ts";
import { useLogin } from "./hooks/useLogin.ts";
import { useSearch } from "./hooks/useSearch.ts";
import type { Tracker as TrackerInstance } from "@en/tracker";

// 异步组件：只有 v-if 为真（弹窗首次打开）时才会渲染对应 chunk。
// loader 提为具名函数供下方空闲预取复用（必须引用同一个函数，
// 否则会指向不同的模块记录，预取就白做了）
const loadSearch = () => import("./components/Search/index.vue");
const loadLogin = () => import("./components/Login/index.vue");

/**
 * 弹窗 chunk 加载失败（网络抖动）时，defineAsyncComponent 会把该实例标记为失败，
 * 而 v-if 已经为 true 不会重新触发加载——表现为「点了没反应」。
 * 这里失败自动重试兜底（最多 2 次）。
 */
const Search = defineAsyncComponent({
  loader: loadSearch,
  timeout: 10000,
  onError(_error, retry, fail, attempts) {
    if (attempts <= 2) retry();
    else fail();
  },
});
const Login = defineAsyncComponent({
  loader: loadLogin,
  timeout: 10000,
  onError(_error, retry, fail, attempts) {
    if (attempts <= 2) retry();
    else fail();
  },
});

const { isShowLogin } = useLogin();
const { isShowSearch } = useSearch();
const userStore = useUserStore();

// ------------------------------------------------------------------
// 埋点 SDK：整包（含指纹采集）延迟到浏览器空闲时再加载并初始化。
// 只是把这段开销从首屏渲染路径上挪开，UV/PV/错误/Web Vitals 上报能力不变。
// ------------------------------------------------------------------
let tracker: TrackerInstance | null = null;

const initTracker = async () => {
  const { Tracker } = await import("@en/tracker");
  tracker = new Tracker({
    baseUrl: "/api/v1",
    uv: {
      api: "/tracker/uv",
      updateApi: "/tracker/update-uv",
    },
    pv: {
      api: "/tracker/pv",
    },
    event: {
      api: "/tracker/event",
    },
    error: {
      api: "/tracker/error",
    },
    performance: {
      api: "/tracker/performance",
    },
  });
  // 初始化完成时如果用户已登录，补一次用户绑定
  const userId = userStore.user?.id;
  if (userId) tracker.setUserId(userId);
};

const requestIdle = (cb: () => void) => {
  const w = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      opts?: { timeout: number },
    ) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(cb, { timeout: 2000 });
  } else {
    setTimeout(cb, 1000);
  }
};

onMounted(() => {
  requestIdle(() => {
    void initTracker();
  });

  // 弹窗预取：等页面全部加载完成（含 hero 图等关键资源）后，在浏览器空闲时
  // 提前把弹窗 chunk 拉进模块缓存。只改变“何时下载”，不影响首屏关键路径，
  // 但首次点击弹窗时无需再等网络，消除“点一下没反应、要点两次”的体感
  const prefetchDialogs = () => {
    requestIdle(() => {
      void loadLogin();
      void loadSearch();
    });
  };
  if (document.readyState === "complete") {
    prefetchDialogs();
  } else {
    window.addEventListener("load", prefetchDialogs, { once: true });
  }
});

// ------------------------------------------------------------------
// 登录状态变化：绑定埋点用户 + 建立/断开 socket 连接。
// socket.io-client 只在登录后才需要，随 useSocket 一起动态引入，不进首屏包。
// ------------------------------------------------------------------
watch(
  () => userStore.user?.id,
  (newVal) => {
    if (newVal) {
      tracker?.setUserId(newVal);
      void (async () => {
        const { useSocket } = await import("./hooks/useSocket.ts");
        await useSocket().connect();
      })();
    } else {
      void (async () => {
        const { useSocket } = await import("./hooks/useSocket.ts");
        useSocket().disconnect();
      })();
    }
  },
  {
    immediate: true,
  },
);
</script>
