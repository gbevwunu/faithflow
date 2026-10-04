export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-chip bg-warning-light px-2 py-0.5 text-[11px] font-semibold text-warning">
      {children}
    </span>
  );
}
