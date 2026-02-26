interface Props {
  page: number
  totalPages: number
  pageSize: number
  totalCount: number
  onSetPage: (page: number) => void
  onSetPageSize: (size: number) => void
}

export default function PaginationBar({
  page,
  totalPages,
  pageSize,
  totalCount,
  onSetPage,
  onSetPageSize
}: Props): React.JSX.Element {
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--cos-border)] text-[10px] text-[var(--cos-text-muted)]">
      <span>
        {totalCount > 0 ? `${start}-${end} of ${totalCount.toLocaleString()}` : 'No rows'}
      </span>

      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onSetPageSize(Number(e.target.value))}
          className="bg-[var(--cos-bg-secondary)] text-[var(--cos-text-secondary)] border border-[var(--cos-border)] rounded px-1 py-0.5 text-[10px]"
        >
          {[25, 50, 100, 200].map((s) => (
            <option key={s} value={s}>
              {s}/page
            </option>
          ))}
        </select>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onSetPage(1)}
            disabled={page <= 1}
            className="px-1.5 py-0.5 rounded hover:bg-[var(--cos-bg-hover)] disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            &laquo;
          </button>
          <button
            onClick={() => onSetPage(page - 1)}
            disabled={page <= 1}
            className="px-1.5 py-0.5 rounded hover:bg-[var(--cos-bg-hover)] disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            &lsaquo;
          </button>
          <span className="px-2 text-[var(--cos-text-secondary)]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onSetPage(page + 1)}
            disabled={page >= totalPages}
            className="px-1.5 py-0.5 rounded hover:bg-[var(--cos-bg-hover)] disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            &rsaquo;
          </button>
          <button
            onClick={() => onSetPage(totalPages)}
            disabled={page >= totalPages}
            className="px-1.5 py-0.5 rounded hover:bg-[var(--cos-bg-hover)] disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            &raquo;
          </button>
        </div>
      </div>
    </div>
  )
}
