import type { Course, CourseList } from "@en/common/course";

/**
 * 课程接口 —— 对应 Vue 版 apis/course/index.ts，当前为 mock 实现。
 * 类型复用 @en/common/course。
 */

/** 对应 Vue 版的 `uploadUrl`（VITE_UPLOAD_URL）。mock 阶段为空，url 直接是本地路径 */
export const uploadUrl = import.meta.env.VITE_UPLOAD_URL ?? "";

const IMAGES = [
  "/images/teacher-home.webp",
  "/images/teacher-login.webp",
  "/images/teacher-register.webp",
];

const COURSES: Course[] = [
  {
    id: "c1",
    name: "高考核心词汇 3500",
    value: "gk-3500",
    description:
      "覆盖高考考纲全部核心词汇，按词频分级，配套真题例句与艾宾浩斯复习计划。",
    teacher: "李维",
    url: IMAGES[0]!,
    price: "199.00",
  },
  {
    id: "c2",
    name: "考研英语词汇 5500",
    value: "ky-5500",
    description:
      "紧扣考研英语大纲，含熟词僻义与长难句拆解，适合长线备考与冲刺阶段。",
    teacher: "沈知遥",
    url: IMAGES[1]!,
    price: "299.00",
  },
  {
    id: "c3",
    name: "四级高频词汇精讲",
    value: "cet4",
    description: "精选四级高频 2000 词，配真题语境与听力场景，一个月见效。",
    teacher: "周叙",
    url: IMAGES[2]!,
    price: "129.00",
  },
  {
    id: "c4",
    name: "六级冲刺词汇",
    value: "cet6",
    description: "六级难点词与学术词表，搭配阅读提速训练，突破 550 分瓶颈。",
    teacher: "沈知遥",
    url: IMAGES[0]!,
    price: "159.00",
  },
  {
    id: "c5",
    name: "雅思学术词汇",
    value: "ielts",
    description: "雅思学术类高频词与同义替换，含写作与口语话题词库。",
    teacher: "Evelyn",
    url: IMAGES[1]!,
    price: "359.00",
  },
  {
    id: "c6",
    name: "托福核心词汇",
    value: "toefl",
    description: "托福学科分类词汇与听力笔记法，配 TPO 真题精讲。",
    teacher: "Evelyn",
    url: IMAGES[2]!,
    price: "399.00",
  },
];

export async function getCourseList(): Promise<{
  success: boolean;
  data: CourseList;
}> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return { success: true, data: COURSES };
}

/** 已购课程：mock 取前两门 */
export async function getMyCourse(): Promise<{
  success: boolean;
  data: CourseList;
}> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return { success: true, data: COURSES.slice(0, 2) };
}
