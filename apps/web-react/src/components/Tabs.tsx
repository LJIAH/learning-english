export interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  value: string;
  items: TabItem[];
  onChange: (key: string) => void;
  className?: string;
}

/** 对应 el-tabs（type="card"）—— Tailwind 手写 */
export default function Tabs({
  value,
  items,
  onChange,
  className = "",
}: TabsProps) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`cursor-pointer rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium transition-colors ${
            item.key === value
              ? "border-zinc-200 bg-white text-indigo-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
