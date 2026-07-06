export default [
  {
    path: "courses",
    component: () => import("@/views/Course/index.vue"),
  },
  {
    path: "courses/learn/:courseId/:title",
    component: () => import("@/views/Course/Learn/index.vue"),
  },
];
