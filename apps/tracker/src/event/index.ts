import type { EventDto } from "@en/common/tracker";
import { getConfig } from "@/config";
import { report } from "@/report";
export const reportEvent = (visitorId: string) => {
  const config = getConfig();
  const url = config.baseUrl + config.event!.api;
  const buttonName = "BUTTON";
  const spanName = "SPAN";
  const inputName = "INPUT";
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    function sendEvent() {
      const react = target.getBoundingClientRect();
      const body: EventDto = {
        visitorId,
        event: e.type,
        url: window.location.href,
        payload: {
          x: react.left.toFixed(2) || 0,
          y: react.top.toFixed(2) || 0,
          width: react.width.toFixed(2) || 0,
          height: react.height.toFixed(2) || 0,
          text: target.textContent,
        },
      };
      report(url, body);
    }
    if (target.nodeName === buttonName) {
      sendEvent();
    }
    if (
      target.nodeName === spanName &&
      target.parentElement?.nodeName === buttonName
    ) {
      sendEvent();
    }
  });
};
