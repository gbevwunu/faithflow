const LABEL = "Search name or last 4 phone digits";

export function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={LABEL}
        aria-label={LABEL}
        autoComplete="off"
        enterKeyHint="search"
        className="h-[44px] w-full appearance-none rounded-input border border-border bg-surface pr-11 pl-4 text-[16px] text-ink placeholder:text-muted focus:border-primary focus:outline-2 focus:outline-primary/20 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value !== "" && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute top-0 right-0 grid size-11 place-items-center rounded-input text-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
