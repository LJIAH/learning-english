import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLogin } from "@/hooks/useLogin";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

export type LoginType = "login" | "register";

/** 左栏形象图（登录/注册切换）—— 对应 Vue 版 ModelViewer 的 IMAGES */
const IMAGES: Record<LoginType, string> = {
  login: "/images/teacher-login.webp",
  register: "/images/teacher-register.webp",
};

const TAB_ACTIVE =
  "bg-indigo-500 text-white shadow-lg px-4 py-2 rounded-md text-sm font-medium transition-all";
const TAB_INACTIVE =
  "text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer";

/**
 * 登录/注册弹窗 —— 对应 Vue 版 Login/index.vue。
 *
 * 与 Vue 版的差异：左栏原本是 3D 模型（ModelViewer.vue），按约定 3D 只做在
 * React 首页，这里改用同一套形象图（Vue 版 ModelViewer 也是图片实现）。
 * 弹窗在 App.tsx 里懒加载 + 条件挂载，故组件挂载即代表「显示」。
 */
export default function Login() {
  const closeLogin = useLogin((s) => s.closeLogin);
  const [type, setType] = useState<LoginType>("login");

  // ESC 关闭（对应 Vue 版 useLogin 里的 keydown 监听）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLogin();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeLogin]);

  return (
    <>
      {/* 遮罩：点击关闭（Vue 版的 @click.self） */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={closeLogin}
      />

      <div className="fixed inset-30 z-50 flex items-center justify-center">
        <div
          className="relative flex h-160 w-250 overflow-hidden rounded-2xl bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="登录/注册"
        >
          <button
            className="absolute right-4 top-4 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-gray-700"
            aria-label="关闭"
            onClick={closeLogin}
          >
            <X className="size-4" />
          </button>

          {/* 左侧形象图 + 登录/注册切换 */}
          <div className="relative h-full w-135 shrink-0 overflow-hidden bg-linear-to-br from-gray-800 to-gray-900">
            <img
              key={type}
              src={IMAGES[type]}
              alt="AI 英语外教"
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover object-top"
            />

            <div className="absolute left-6 top-6 flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-[10px] bg-linear-to-br from-indigo-500 to-purple-600">
                <span className="text-xl font-bold text-white">E</span>
              </div>
              <span className="text-xl font-bold text-white">English App</span>
            </div>

            <div className="absolute right-6 top-6">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 p-1 backdrop-blur-sm">
                <button
                  className={type === "login" ? TAB_ACTIVE : TAB_INACTIVE}
                  onClick={() => setType("login")}
                >
                  登录
                </button>
                <button
                  className={type === "register" ? TAB_ACTIVE : TAB_INACTIVE}
                  onClick={() => setType("register")}
                >
                  注册
                </button>
              </div>
            </div>
          </div>

          {/* 右侧表单 */}
          <div className="flex min-w-64 flex-1 flex-col justify-center bg-white px-8 py-10">
            {type === "login" ? <LoginForm /> : <RegisterForm />}
          </div>
        </div>
      </div>
    </>
  );
}
