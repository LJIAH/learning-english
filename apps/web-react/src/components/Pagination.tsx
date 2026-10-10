interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * 分页 —— 替代 Element Plus 的 el-pagination（background 模式）。
 *
 * 用 Tailwind 手写而非引入 UI 库，原因：UI 库自带设计语言（圆角、主色、间距），
 * 换库后无法与 Vue 版保持一致。手写反而更贴近。
 *
 * 已知限制：页码全部平铺，未做折叠。当前 mock 数据只有 2 页，
 * 接入真实数据（可能上百页）前需补「省略号 + 首尾页」逻辑。
 */
export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  const btnBase =
    "min-w-8 h-8 px-2 rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer";

  return (
    <div className="flex items-center justify-center gap-2 select-none">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={`${btnBase} bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-gray-100 disabled:hover:text-gray-600`}
      >
        上一页
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={`${btnBase} ${
            p === page
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
          }`}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className={`${btnBase} bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-gray-100 disabled:hover:text-gray-600`}
      >
        下一页
      </button>
    </div>
  );
}
