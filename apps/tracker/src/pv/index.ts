import type { PvDto } from "@en/common/tracker";
import { getConfig } from "@/config";
import { report } from "@/report";

const reportView = (visitorId: string) => {
  const config = getConfig();
  const url = config.baseUrl + config.pv!.api;
  // 因为hash模式的时候, location.pathname拿不到对应的hash路径，需要特别处理
  const isHash = window.location.href.includes("#");
  const body: PvDto = {
    visitorId,
    url: window.location.protocol + "//" + window.location.host,
    referrer: document.referrer,
    path: isHash ? "/" + window.location.hash : window.location.pathname,
  };
  report(url, body);
};
/** 获取不含 hash 的路径部分，用于判断真实路径是否变化 */
const getPathWithoutHash = () =>
  window.location.pathname + window.location.search;

export const reportPv = (visitorId: string) => {
  let prevPath = getPathWithoutHash();

  reportView(visitorId);

  // 监听路由hash变化
  window.addEventListener("hashchange", (e) => {
    reportView(visitorId);
  });

  // 监听路由popstate变化（浏览器的前进后退），只处理非 hash 引起的路径变化
  window.addEventListener("popstate", (e) => {
    const currentPath = getPathWithoutHash();
    if (currentPath !== prevPath) {
      prevPath = currentPath;
      reportView(visitorId);
    }
    // 如果只是 hash 变了，hashchange 已经处理过了，这里跳过
  });

  // 监听路由pushState变化,浏览器的history.pushState
  const originalPushState = window.history.pushState;
  window.history.pushState = function (...args) {
    originalPushState.apply(this, args);
    prevPath = getPathWithoutHash();
    reportView(visitorId);
  };

  // 监听路由replaceState变化,浏览器的history.replaceState
  const originalReplaceState = window.history.replaceState;
  window.history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    prevPath = getPathWithoutHash();
    reportView(visitorId);
  };
};
