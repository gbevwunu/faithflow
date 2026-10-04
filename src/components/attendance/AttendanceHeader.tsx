export function AttendanceHeader({
  churchName,
  dateLabel,
  title,
  subtitle,
  markingClosed,
}: {
  churchName: string;
  dateLabel: string;
  title: string;
  subtitle: string;
  /** Ink instead of the church color when the viewer cannot mark right now. */
  markingClosed: boolean;
}) {
  return (
    <header
      className={`${markingClosed ? "bg-ink" : "bg-primary"} px-5 pt-12 pb-5 text-on-primary`}
    >
      <p className="text-[13px] text-on-primary/80">
        {churchName} · {dateLabel}
      </p>
      <h1 className="mt-0.5 text-[24px] leading-tight font-bold">{title}</h1>
      <p className="mt-0.5 text-[14px] text-on-primary/80">{subtitle}</p>
    </header>
  );
}

export const STATE_SUBTITLES = {
  open: "Attendance open",
  corrections: "Corrections in progress",
  closed: "Attendance closed",
} as const;
