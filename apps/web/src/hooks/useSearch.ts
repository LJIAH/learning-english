import { ref } from "vue";

/**
 * 全局搜索弹窗状态。
 *
 * 原先由 Search 组件自己持有 isShow 并在组件内注册 Ctrl+F 监听，
 * 导致该组件必须常驻页面（连带 axios / 接口层一起进入首屏包）。
 * 现在把状态与快捷键提升到模块级：App.vue 按需挂载组件，快捷键始终可用。
 */
const isShowSearch = ref(false);

const openSearch = () => {
  isShowSearch.value = true;
  document.body.style.overflow = "hidden"; // 隐藏滚动条
};

const closeSearch = () => {
  isShowSearch.value = false;
  document.body.style.overflow = "auto"; // 恢复滚动条
};

let shortcutBound = false;
const bindShortcut = () => {
  if (shortcutBound || typeof window === "undefined") return;
  shortcutBound = true;
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key === "f") {
      event.preventDefault();
      openSearch();
    }
    if (event.key === "Escape" && isShowSearch.value) {
      closeSearch();
    }
  });
};

export const useSearch = () => {
  bindShortcut();
  return { isShowSearch, openSearch, closeSearch };
};
