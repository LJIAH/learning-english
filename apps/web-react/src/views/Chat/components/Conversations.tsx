import { useEffect, useRef, useState } from "react";
import type { ChatMode, ChatRoleType } from "@en/common/chat";
import { getChatModeList } from "@/apis/chat";

interface ConversationsProps {
  onGetRole: (role: ChatRoleType) => void;
}

/** 对应 Vue 版 Chat/components/Conversations.vue */
export default function Conversations({ onGetRole }: ConversationsProps) {
  const [chatMode, setChatMode] = useState<ChatMode[]>([]);
  const [active, setActive] = useState<string>("");

  /**
   * 用 ref 持有最新的 onGetRole，让「初始化」这个副作用**只在挂载时跑一次**
   * （对应 Vue 版的 onMounted）。
   *
   * 踩过的坑：原先写成 useEffect(..., [onGetRole])，而父组件传的是内联箭头函数
   * ——每次渲染都是新身份 → 副作用每次渲染都重跑 → 里面的 setActive(first.id)
   * 会把用户刚点选的模式**弹回第一项**，表现为「侧边栏切换不了」，
   * 同时还在不停重发 /prompt/list 与 /chat/history。
   */
  const onGetRoleRef = useRef(onGetRole);
  useEffect(() => {
    onGetRoleRef.current = onGetRole;
  });

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const res = await getChatModeList();
      if (cancelled) return;
      const list = res.data ?? [];
      setChatMode(list);
      const first = list[0];
      if (first) {
        setActive(first.id);
        onGetRoleRef.current(first.role);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const changeActive = (value: ChatMode) => {
    setActive(value.id);
    onGetRole(value.role);
  };

  return (
    <div className="w-[256px] rounded-[5px] border border-t-0 border-r border-b-0 border-l-0 border-gray-200 bg-purple-50 p-5">
      {chatMode.map((value) => (
        <div
          key={value.id}
          onClick={() => changeActive(value)}
          className={`rounded-[5px] p-2 transition-all duration-300 ${
            active === value.id ? "bg-purple-300" : ""
          }`}
        >
          <div className="cursor-pointer p-2 px-4 text-sm text-gray-700">
            {value.label}
          </div>
        </div>
      ))}
    </div>
  );
}
