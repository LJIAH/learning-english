export default [
  {
    path: "setting",
    component: () => import("@/views/Setting/index.vue"),
    meta: { requiresAuth: true },
  },
];
