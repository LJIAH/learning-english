export default [
  {
    path: "chat",
    component: () => import("@/views/Chat/index.vue"),
    meta: { requiresAuth: true },
  },
];
