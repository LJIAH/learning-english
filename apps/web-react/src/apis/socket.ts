import type { Socket } from "socket.io-client";
import { socketUrl } from "./request";
import { useUserStore } from "@/stores/user";

/**
 * socket 客户端单例 —— 移植自 Vue 版 hooks/useSocket.ts。
 *
 * ★ 这里刻意**不叫 `useSocket`**：Vue 的 `useXxx` 是组合式 API 的命名约定，
 * 而它内部没有任何 hook 调用，本质是模块级单例工厂。沿用 `use*` 命名会被
 * react-hooks/rules-of-hooks 当成 hook（在 effect 回调里调用即报错），
 * 也会误导后来者以为必须写在组件顶层。命名与同目录的 apis/sse.ts 对齐。
 *
 * 与 Vue 版的差异只在「怎么拿用户」：
 *   Vue   : useUserStore()（Pinia hook，必须在 setup 里调用）
 *   React : useUserStore.getState().user?.id（zustand 非响应式读取，任意位置可调）
 * 其余逐行一致：动态 import（把 socket.io-client 移出首屏包）、重连参数、
 * query.userId（后端据此把连接 join 进 user_${userId} 房间）。
 */
let socket: Socket | null = null;

// 连接 socket
const connect = async () => {
  const userId = useUserStore.getState().user?.id;
  if (!userId) return; // 没有 userId 不可以连接
  if (socket) return; // 已经连接就不要重复连接
  // socket.io-client 只有登录后才会用到，动态加载把它移出首屏包
  const { io } = await import("socket.io-client");
  if (socket) return; // 动态加载期间可能已被其它调用方连上
  // socketUrl 留空 ⇒ 传 undefined，socket.io 会连当前页面 origin
  // （dev 由 vite 代理转发，prod 由 nginx 反代 —— 两者都是同源，不触发 CORS）
  socket = io(socketUrl || undefined, {
    transports: ["websocket"],
    autoConnect: true, // 是否自动连接
    reconnection: true, // 是否自动重连
    reconnectionAttempts: 5, // 重连次数
    reconnectionDelay: 1000, // 重连时间
    reconnectionDelayMax: 5000, // 最大重连时间
    timeout: 20000, // 超时时间
    query: {
      userId,
    },
  });
  // 防止开发环境热更新后 socket 仍被引用为旧实例
  if (import.meta.hot) {
    import.meta.hot.data.socket = socket;
  }
};

// 断开 socket
const disconnect = () => {
  if (socket) {
    socket.disconnect(); // 断开连接
    socket.removeAllListeners(); // 移除所有事件监听
    socket = null; // 清空 socket
    if (import.meta.hot) {
      import.meta.hot.data.socket = null;
    }
  }
};

// 获取 socket（可能为 null：未登录 / 尚未连上）
const getSocket = (): Socket | null => {
  if (socket) {
    return socket;
  }
  if (import.meta.hot) {
    return import.meta.hot.data.socket as Socket;
  }
  return null;
};

export const socketClient = {
  connect,
  disconnect,
  getSocket,
};
