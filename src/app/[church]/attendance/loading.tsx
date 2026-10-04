export default function AttendanceLoading() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col">
      <p className="sr-only" role="status">
        Loading attendance
      </p>
      <div className="h-[136px] bg-primary" />
      <div className="flex flex-col gap-4 px-4 pt-4" aria-hidden="true">
        <div className="h-12 animate-pulse rounded-card bg-primary-light" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[65px] animate-pulse rounded-card bg-primary-light" />
          ))}
        </div>
        <div className="h-11 animate-pulse rounded-input bg-primary-light" />
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex h-[61px] items-center gap-3 border-b border-border px-3.5 last:border-b-0"
            >
              <div className="size-9 animate-pulse rounded-full bg-primary-light" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/5 animate-pulse rounded bg-primary-light" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-primary-light" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
