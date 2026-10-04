"use client";

export default function AttendanceError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col px-4 pt-16 pb-28">
      <div
        role="alert"
        className="rounded-card border border-border bg-surface px-5 py-7 text-center"
      >
        <h1 className="text-[18px] font-semibold text-ink">Attendance could not be loaded</h1>
        <p className="mt-2 text-[15px] text-muted">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 h-12 w-full rounded-card bg-primary px-4 text-[16px] font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
