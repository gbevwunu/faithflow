import Image from "next/image";
import Link from "next/link";
import { PLATFORM_PROVIDER } from "@/lib/platform";
import type { SignInScreenState } from "@/lib/rules";
import { GoogleButton } from "./GoogleButton";

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

/** The church's logo from config, or its initials in a circle of its primary color. */
function ChurchMark({
  churchName,
  initials,
  logoUrl,
}: {
  churchName: string;
  initials: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={`${churchName} logo`}
        width={72}
        height={72}
        unoptimized
        className="mx-auto size-[72px] object-contain"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex size-[72px] items-center justify-center rounded-full bg-primary text-[26px] font-bold text-on-primary"
    >
      {initials}
    </div>
  );
}

/** The sign-in screen: church mark, "Attendance Database", Google sign-in and footer. */
export function SignInCard({
  churchName,
  churchInitials,
  logoUrl,
  churchHost,
  state,
  signInAction,
  attendanceHref,
  privacyHref,
}: {
  churchName: string;
  /** Shown in the church mark when the church has no logo. */
  churchInitials: string;
  logoUrl: string | null;
  /** The church's own subdomain, when ROOT_DOMAIN is set. */
  churchHost: string | null;
  state: CardState;
  signInAction: () => Promise<void>;
  attendanceHref: string;
  privacyHref: string;
}) {
  const text = message(state, churchName, churchHost);
  const canSignIn =
    state.kind === "sign-in" ||
    state.kind === "not-on-team" ||
    state.kind === "rate-limited" ||
    state.kind === "failed";
  const isProblem = state.kind !== "sign-in" && state.kind !== "unavailable";
  const subtitle =
    state.kind === "not-on-team"
      ? "We couldn't sign you in."
      : "Sign in with your approved Google account.";

  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px] rounded-2xl border border-border bg-surface px-6 pt-8 pb-8 text-center">
          <ChurchMark churchName={churchName} initials={churchInitials} logoUrl={logoUrl} />
          <p className="mt-6 text-[15px] font-medium text-muted">{churchName}</p>
          <h1 className="mt-2 text-[28px] leading-tight font-bold text-ink">Attendance Database</h1>
          <p className="mt-3 text-[16px] leading-snug text-muted">{subtitle}</p>

          <div className="mt-8 flex flex-col gap-3">
            {text && (
              <p
                role={isProblem ? "alert" : undefined}
                className={`rounded-card border px-4 py-3 text-left text-[15px] leading-snug ${
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
                {/* After a refusal this reopens Google's account chooser to pick another account. */}
                <GoogleButton>Continue with Google</GoogleButton>
              </form>
            )}

            {state.kind === "unavailable" && (
              <Link
                href={attendanceHref}
                className="flex h-11 items-center justify-center rounded-full bg-primary px-4 text-[16px] font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Go to attendance
              </Link>
            )}
          </div>

          <p className="mt-4 text-[13px] text-muted">Only approved team members can sign in.</p>
        </div>
      </main>

      <footer className="flex items-center justify-center gap-2 px-4 pt-2 pb-[max(2rem,env(safe-area-inset-bottom))] text-[14px]">
        <Link
          href={privacyHref}
          className="rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Privacy
        </Link>
        <span aria-hidden="true" className="text-muted">
          ·
        </span>
        <span className="text-muted">Powered by {PLATFORM_PROVIDER}</span>
      </footer>
    </>
  );
}
