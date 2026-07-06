import { serverRequest } from "..";
import type { CourseList } from "@en/common/course";

export const getCourseList = () =>
  serverRequest.get<CourseList>("/course/list");

export const getMyCourse = () => serverRequest.get<CourseList>("/course/my");
