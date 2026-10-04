export function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`relative h-7 rounded-chip border px-3 text-[13px] font-medium whitespace-nowrap transition-colors after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        pressed
          ? "border-primary bg-primary text-on-primary"
          : "border-border bg-surface text-ink hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}
