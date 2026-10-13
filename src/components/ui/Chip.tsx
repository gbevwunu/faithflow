export function Chip({
  id,
  pressed,
  onClick,
  describedBy,
  children,
}: {
  id?: string;
  pressed: boolean;
  onClick: () => void;
  describedBy?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-describedby={describedBy}
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
