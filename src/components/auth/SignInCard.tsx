import Link from "next/link";
import type { SignInScreenState } from "@/lib/rules";

type CardState = Exclude<SignInScreenState, { kind: "signed-in" }>;

function message(state: CardState, churchName: string, churchHost: string | null): string | null {
  switch (state.kind) {
    case "sign-in":
      return null;
    case "not-on-team":
      return `This Google account isn't on the team list for ${churchName}. Ask an admin to add you, or use a different account.`;
    case "rate-limited":
      return "Too many sign-in attempts. Wait a few minutes and try again.";
    case "failed":
      return "Sign-in didn't work. Please try again.";
    case "wrong-host":
      return churchHost
        ? `To sign in, open ${churchHost}.`
        : "To sign in, open the church's own web address.";
    case "unavailable":
      return "Sign-in is only available on the live site. Use the development toolbar to switch between team and admin.";
  }
}

/** The sign-in screen: church name, "Attendance Database" and Google sign-in. */
export function SignInCard({
  churchName,
  churchHost,
  state,
  signInAction,
  attendanceHref,
}: {
  churchName: string;
  /** The church's own subdomain, when ROOT_DOMAIN is set. */
  churchHost: string | null;
  state: CardState;
  signInAction: () => Promise<void>;
  attendanceHref: string;
}) {
  const text = message(state, churchName, churchHost);
  const canSignIn =
    state.kind === "sign-in" ||
    state.kind === "not-on-team" ||
    state.kind === "rate-limited" ||
    state.kind === "failed";
  const isProblem = state.kind !== "sign-in" && state.kind !== "unavailable";

  return (
    <>
      <header className="bg-primary px-5 pt-20 pb-10 text-on-primary">
        <p className="text-[15px] font-medium text-on-primary/80">{churchName}</p>
        <h1 className="mt-1 text-[28px] leading-tight font-bold">Attendance Database</h1>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 pt-6 pb-10">
        {text && (
          <p
            role={isProblem ? "alert" : undefined}
            className={`rounded-card border px-5 py-4 text-[15px] ${
              isProblem
                ? "border-danger bg-surface text-ink"
                : "border-border bg-surface text-muted"
            }`}
          >
            {text}
          </p>
        )}

        {canSignIn && (
          <form action={signInAction}>
            <button
              type="submit"
              className="flex h-[52px] w-full items-center justify-center rounded-card bg-primary px-4 text-[17px] font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {state.kind === "not-on-team" ? "Use a different account" : "Continue with Google"}
            </button>
          </form>
        )}

        {state.kind === "unavailable" && (
          <Link
            href={attendanceHref}
            className="flex h-[52px] items-center justify-center rounded-card bg-primary px-4 text-[17px] font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Go to attendance
          </Link>
        )}

        <p className="text-center text-[13px] text-muted">
          Only approved team members can sign in.
        </p>
      </main>
    </>
  );
}
