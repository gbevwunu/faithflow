import { CheckIcon } from "@/components/ui";

export function TickButton({
  name,
  marked,
  disabled,
  pending,
  onToggle,
}: {
  name: string;
  marked: boolean;
  disabled: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={marked}
      aria-label={`Mark ${name} present`}
      aria-busy={pending || undefined}
      disabled={disabled}
      onClick={onToggle}
      className="group -mr-1.5 grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed"
    >
      <span
        className={`grid size-8 place-items-center rounded-full border-2 transition-colors ${
          marked
            ? "border-success bg-success text-on-primary group-disabled:opacity-45"
            : "border-muted bg-surface group-disabled:border-border group-disabled:bg-background"
        } ${pending ? "opacity-70" : ""}`}
      >
        {marked && <CheckIcon className="size-4" />}
      </span>
    </button>
  );
}
