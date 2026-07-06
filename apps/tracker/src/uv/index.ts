import type { UvDto } from "@en/common/tracker";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { UAParser } from "ua-parser-js";
import { getConfig } from "@/config";
import { reportFetch } from "@/report";

export const getBrowerInfo = () => {
  const ua = new UAParser();
  return {
    browser: ua.getBrowser().name || "",
    os: ua.getOS().name || "",
    device: ua.getDevice().type || "desktop",
  };
};

export const getFingerprint = async () => {
  const config = getConfig();
  const browserInfo = getBrowerInfo();
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  const visitorId = result.visitorId;
  const body: UvDto = {
    ...browserInfo,
    anonymousId: visitorId,
  };
  const url = config.baseUrl + config.uv.api;
  const res = await reportFetch(url, body);
  return res.data;
};
