import type { CourseList } from "@en/common/course";
import { serverRequest } from "./request";

/** 课程接口 —— 对应 Vue 版 apis/course/index.ts。 */

export const getCourseList = () =>
  serverRequest.get<CourseList>("/course/list");

export const getMyCourse = () => serverRequest.get<CourseList>("/course/my");
