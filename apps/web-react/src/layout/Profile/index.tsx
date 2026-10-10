import { useNavigate } from "react-router-dom";
import { useAvatar } from "@/hooks/useAvatar";
import { useLogin } from "@/hooks/useLogin";
import { useUserStore } from "@/stores/user";

/** 对应 Vue 版 layout/Profile/index.vue —— Tailwind class 原样保留 */
export default function Profile({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const { avatar } = useAvatar();
  const { openLogin, logout } = useLogin();
  const user = useUserStore((s) => s.user);

  const displayName = user?.name ?? "游客";
  const bio = user?.bio ?? "";
  const isLoggedIn = !!user;

  return (
    <section
      className="w-80 overflow-hidden rounded-[14px] bg-linear-to-b from-white/95 to-slate-50/95 backdrop-blur shadow-lg ring-1 ring-slate-900/5"
      aria-label="用户资料卡"
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-3.5">
        <div className="grid size-11 shrink-0 place-items-center rounded-full border border-gray-200">
          <img
            className="size-10 rounded-full object-cover"
            src={avatar}
            loading="lazy"
            alt="用户头像"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex flex-col gap-1">
              <div
                className="truncate text-sm font-extrabold leading-5 text-slate-900"
                title={displayName}
              >
                {displayName}
              </div>
              {bio && (
                <div
                  className="truncate text-xs leading-4 text-slate-500/90"
                  title={bio}
                >
                  {bio}
                </div>
              )}
            </div>
          </div>
          {!isLoggedIn && (
            <div className="mt-1 text-xs leading-4 text-slate-500/90">
              登录后可同步词库进度与打卡数据
            </div>
          )}
        </div>
      </div>

      {isLoggedIn && (
        <div className="grid grid-cols-2 gap-2.5 px-4 pb-3 pt-2">
          <div className="rounded-xl border border-slate-900/5 bg-white/65 px-2.5 py-2.5">
            <div className="text-xs leading-4 text-slate-500/95">单词数量</div>
            <div className="mt-1 text-lg font-black leading-5.5 text-slate-900">
              {user?.wordNumber ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-50/90 px-2.5 py-2.5">
            <div className="text-xs leading-4 text-slate-500/95">打卡天数</div>
            <div className="mt-1 text-lg font-black leading-5.5 text-slate-900">
              {user?.dayNumber ?? 0}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2.5 border-t border-slate-900/5 bg-white/75 px-4 pb-3.5 pt-3">
        {!isLoggedIn ? (
          <button
            className="h-9 flex-1 cursor-pointer rounded-[10px] border border-blue-600/25 bg-blue-600/10 text-[13px] font-extrabold text-blue-700 transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_16px_rgba(15,23,42,0.10)] active:translate-y-0 active:shadow-none motion-reduce:transition-none"
            type="button"
            onClick={() => void openLogin()}
          >
            去登录
          </button>
        ) : (
          <>
            <button
              className="h-9 flex-1 cursor-pointer rounded-[10px] border border-slate-900/10 bg-white/90 text-[13px] font-extrabold text-slate-900/90 transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_16px_rgba(15,23,42,0.10)] active:translate-y-0 active:shadow-none motion-reduce:transition-none"
              type="button"
              onClick={() => {
                navigate("/setting");
                onClose?.();
              }}
            >
              个人资料
            </button>
            <button
              className="h-9 flex-1 cursor-pointer rounded-[10px] border border-red-500/20 bg-red-500/10 text-[13px] font-extrabold text-red-700 transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_16px_rgba(15,23,42,0.10)] active:translate-y-0 active:shadow-none motion-reduce:transition-none"
              type="button"
              onClick={() => {
                logout();
                onClose?.();
              }}
            >
              退出登录
            </button>
          </>
        )}
      </div>
    </section>
  );
}
