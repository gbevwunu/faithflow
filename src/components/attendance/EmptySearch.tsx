export function EmptySearch({ query }: { query: string }) {
  const trimmed = query.trim();
  const isDigits = /^\d{4}$/.test(trimmed);
  return (
    <div className="rounded-card border border-border bg-surface px-5 py-7 text-center">
      <h2 className="text-[18px] font-semibold text-ink">
        {isDigits
          ? `No one with a phone ending in ${trimmed}`
          : `No one named “${trimmed}” on the list`}
      </h2>
      <p className="mt-2 text-[15px] text-muted">
        Check the spelling or try their last 4 phone digits. If they are new today, add them now.
      </p>
      <button
        type="button"
        disabled
        className="mt-6 h-12 w-full rounded-card bg-primary px-4 text-[16px] font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDigits ? "Add as newcomer" : `Add ${trimmed} as newcomer`}
      </button>
      <p className="mt-2 text-[13px] text-muted">Adding newcomers is coming soon.</p>
    </div>
  );
}
