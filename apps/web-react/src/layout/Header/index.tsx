import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { toast } from "@/stores/toast";
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
 *   el-popover   → 自实现（**悬停展开 + 延迟收起 + 点击外部关闭**）
 *                  el-popover 默认 trigger 是 hover，故不能做成点击切换
 *   ElMessage    → 极简 toast（stores/toast），见 @/components/Toaster
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
  /** 卡片的 fixed 定位（相对视口）：卡片被 portal 到 body，不再靠 CSS 相对定位 */
  const [cardPos, setCardPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 资料卡触发方式：悬停。
   *
   * Vue 版是 `<el-popover :width="340">` 且**没写 trigger** —— Element Plus 的
   * el-popover 默认 trigger 就是 hover。最初移植成「点击切换」属于行为回归。
   *
   * ★ 卡片必须 portal 到 body，不能渲染在原地：header 内层是 overflow-x-auto
   * （overflow-x 非 visible 时 overflow-y 会计算成 auto），会把悬挂在 header
   * 下方的卡片整个裁掉 —— 表现为「卡片渲染了但看不见、鼠标位置下是页面元素」。
   * Vue 版没这问题，正是因为 el-popover 默认 teleport 到 body。
   */
  const updateCardPos = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    // 对齐 Vue 版的 absolute right-0 top-full mt-2
    setCardPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  };

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openProfile = () => {
    cancelClose();
    updateCardPos();
    setShowProfile(true);
  };

  /**
   * 延迟关闭：卡片 portal 到 body 后，鼠标从头像移向卡片必然离开触发器的
   * DOM 子树（两者之间还有 8px 间隙），所以必须留一个短延迟，
   * 并由卡片自身的 mouseenter 取消掉它。
   */
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setShowProfile(false);
      closeTimer.current = null;
    }, 180);
  };

  useEffect(() => () => cancelClose(), []);

  // 打开期间跟随滚动/缩放重算位置；点击卡片与触发器之外关闭
  useEffect(() => {
    if (!showProfile) return;

    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !cardRef.current?.contains(t)) {
        setShowProfile(false);
      }
    };
    const onReflow = () => updateCardPos();

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [showProfile]);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const handleNav = async (nav: NavItem) => {
    if (nav.requiresAuth) {
      try {
        await openLogin();
        navigate(nav.path);
      } catch {
        toast.error("请先登录");
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

        <div
          className="relative shrink-0"
          ref={triggerRef}
          onMouseEnter={openProfile}
          onMouseLeave={scheduleClose}
        >
          <div
            // 点击也打开（不做 toggle）：触屏/无鼠标场景下 hover 不可用；
            // 若用 toggle，悬停展开后随手点一下头像反而会把卡片关掉
            onClick={openProfile}
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

          {showProfile &&
            cardPos &&
            createPortal(
              <div
                ref={cardRef}
                className="fixed z-30"
                style={{ top: cardPos.top, right: cardPos.right }}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <Profile onClose={() => setShowProfile(false)} />
              </div>,
              document.body,
            )}
        </div>
      </div>
    </header>
  );
}
