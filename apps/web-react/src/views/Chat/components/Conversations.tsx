import { useEffect, useState } from "react";
import type { ChatMode, ChatRoleType } from "@en/common/chat";
import { getChatModeList } from "@/apis/chat";

interface ConversationsProps {
  onGetRole: (role: ChatRoleType) => void;
}

/** 对应 Vue 版 Chat/components/Conversations.vue */
export default function Conversations({ onGetRole }: ConversationsProps) {
  const [chatMode, setChatMode] = useState<ChatMode[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const res = await getChatModeList();
      if (cancelled) return;
      setChatMode(res.data);
      const first = res.data[0];
      if (first) {
        setActive(first.id);
        onGetRole(first.role);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [onGetRole]);

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
