import { signOutAction } from "@/app/[church]/sign-in/actions";

export function AttendanceHeader({
  churchName,
  dateLabel,
  title,
  subtitle,
  markingClosed,
  account,
}: {
  churchName: string;
  dateLabel: string;
  title: string;
  subtitle: string;
  /** Ink instead of the church color when the viewer cannot mark right now. */
  markingClosed: boolean;
  /** The signed-in member, shown with a "Sign out" button when real sign-in is on. */
  account?: { church: string; name: string };
}) {
  return (
    <header
      className={`${markingClosed ? "bg-ink" : "bg-primary"} px-5 ${account ? "pt-4" : "pt-12"} pb-5 text-on-primary`}
    >
      {account && (
        <div className="mb-3 flex min-h-11 items-center justify-end gap-2 text-[13px]">
          <span className="min-w-0 truncate text-on-primary/80">{account.name}</span>
          <form action={signOutAction.bind(null, account.church)}>
            <button
              type="submit"
              className="min-h-11 px-2 font-medium text-on-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-on-primary"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
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
