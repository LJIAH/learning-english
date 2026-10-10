import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BookMarked,
  BookOpen,
  House,
  Settings,
  Sparkles,
  Star,
  Sun,
  type LucideIcon,
} from "lucide-react";
import Profile from "@/layout/Profile";
import { useAvatar } from "@/hooks/useAvatar";
import { useLogin } from "@/hooks/useLogin";
import { useUserStore } from "@/stores/user";

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  requiresAuth?: boolean;
};

/**
 * 对应 Vue 版 layout/Header/index.vue。
 *
 * 两处 Element Plus 替换：
 *   el-icon      → 直接用 lucide-react 图标组件（无需容器包装）
 *   el-popover   → 自实现（点击切换 + 点击外部关闭），见 useClickOutside
 *   ElMessage    → 暂以 console 代替，接入 UI 层后统一替换
 */
const navItems: NavItem[] = [
  { path: "/", label: "主页", icon: House },
  { path: "/chat", label: "AI", icon: Sparkles, requiresAuth: true },
  { path: "/word-book", label: "词库", icon: BookMarked },
  { path: "/courses", label: "课程", icon: BookOpen },
  { path: "/setting", label: "设置", icon: Settings, requiresAuth: true },
];

export default function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { avatar } = useAvatar();
  const { openLogin } = useLogin();
  const user = useUserStore((s) => s.user);

  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭资料卡
  useEffect(() => {
    if (!showProfile) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node))
        setShowProfile(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showProfile]);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const handleNav = async (nav: NavItem) => {
    if (nav.requiresAuth) {
      try {
        await openLogin();
        navigate(nav.path);
      } catch {
        // TODO: 接入 UI 层后替换为 toast 提示「请先登录」
        console.warn("[header] 请先登录");
      }
      return;
    }
    navigate(nav.path);
  };

  return (
    <header className="flex items-center h-20 border-b border-gray-200 justify-center sticky top-0 bg-white z-10">
      <div className="max-w-300 w-full mx-auto px-6 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="text-2xl font-bold bg-indigo-700 text-white rounded-[10px] px-2 py-1 w-10 flex items-center justify-center h-10">
          E
        </div>
        <div className="text-2xl font-bold">English App</div>

        {navItems.map((nav) => {
          const Icon = nav.icon;
          return (
            <div
              key={nav.path}
              onClick={() => void handleNav(nav)}
              className={`flex items-center gap-2 cursor-pointer rounded-[10px] px-3 py-2 shrink-0 transition-colors duration-200 ${
                isActive(nav.path)
                  ? "text-indigo-600 bg-indigo-50"
                  : "text-gray-500 hover:text-indigo-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="size-4" />
              <span>{nav.label}</span>
            </div>
          );
        })}

        <div className="flex items-center gap-2 bg-blue-200 text-blue-700 rounded-full px-2 py-1 shrink-0">
          <Sun className="size-4" />
          <span className="font-bold text-sm">{user?.wordNumber ?? 0}</span>
        </div>

        <div className="flex items-center gap-2 bg-amber-200 text-amber-700 rounded-full px-2 py-1 shrink-0">
          <Star className="size-4" />
          <span className="font-bold text-sm">{user?.dayNumber ?? 0}</span>
        </div>

        <div className="relative shrink-0" ref={profileRef}>
          <div
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center gap-2 border-l cursor-pointer border-gray-200 pl-4"
          >
            <img
              className="w-10 h-10 rounded-full ml-2 mr-2"
              src={avatar}
              width="40"
              height="40"
              decoding="async"
              alt="用户头像"
            />
            <span className="text-sm font-bold">{user?.name ?? "游客"}</span>
          </div>

          {showProfile && (
            <div className="absolute right-0 top-full z-20 mt-2">
              <Profile onClose={() => setShowProfile(false)} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
