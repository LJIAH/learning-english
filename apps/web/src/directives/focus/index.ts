import type { Directive, DirectiveBinding } from "vue";

interface FocusDirectiveValue {
  /** 是否在挂载后自动聚焦，默认 true */
  auto?: boolean;
  /** 聚焦时的延迟时间（ms），用于等待 DOM 渲染完成 */
  delay?: number;
}

const vFocus: Directive<HTMLElement, FocusDirectiveValue | undefined> = {
  mounted(
    el: HTMLElement,
    binding: DirectiveBinding<FocusDirectiveValue | undefined>,
  ) {
    const value = binding.value;
    const auto = value?.auto ?? true;
    const delay = value?.delay ?? 0;

    if (!auto) return;

    const focusTarget =
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT"
        ? el
        : ((el.querySelector(
            "input, textarea, select",
          ) as HTMLElement | null) ?? el);

    if (delay > 0) {
      setTimeout(() => focusTarget.focus(), delay);
    } else {
      // 使用 nextTick 级别的微任务，确保 DOM 完全就绪
      Promise.resolve().then(() => focusTarget.focus());
    }
  },
  updated(
    el: HTMLElement,
    binding: DirectiveBinding<FocusDirectiveValue | undefined>,
  ) {
    const oldValue = binding.oldValue;
    const newValue = binding.value;

    // 当值从 false 变为 true（或 auto 从 false 变为 true）时重新聚焦
    const oldAuto = oldValue?.auto ?? true;
    const newAuto = newValue?.auto ?? true;

    if (!oldAuto && newAuto) {
      const focusTarget =
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT"
          ? el
          : ((el.querySelector(
              "input, textarea, select",
            ) as HTMLElement | null) ?? el);

      const delay = newValue?.delay ?? 0;
      if (delay > 0) {
        setTimeout(() => focusTarget.focus(), delay);
      } else {
        Promise.resolve().then(() => focusTarget.focus());
      }
    }
  },
};

export default vFocus;
