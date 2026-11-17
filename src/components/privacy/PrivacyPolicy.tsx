import Link from "next/link";
import { formatLongDate } from "@/lib/format";
import { PLATFORM_PROVIDER } from "@/lib/platform";

/** The date this policy text last changed. Update it whenever the wording below changes. */
export const PRIVACY_LAST_UPDATED = "2026-11-16";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface px-5 py-5">
      <h2 className="text-[17px] leading-snug font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const paragraph = "text-[15px] leading-relaxed text-muted";
const list = "flex list-disc flex-col gap-1 pl-5 text-[15px] leading-relaxed text-muted";

/** The public privacy page: plain-language notice, no session and no personal data. */
export function PrivacyPolicy({
  churchName,
  contactEmail,
  signInHref,
}: {
  churchName: string;
  contactEmail: string;
  signInHref: string;
}) {
  return (
    <>
      <header className="bg-primary px-5 pt-12 pb-5 text-on-primary">
        <p className="text-[13px] text-on-primary/80">{churchName}</p>
        <h1 className="mt-1 text-[24px] leading-tight font-bold">Privacy</h1>
        <p className="mt-2 text-[13px] text-on-primary/80">
          Last updated {formatLongDate(PRIVACY_LAST_UPDATED)}
        </p>
      </header>

      <main className="flex flex-col gap-4 px-4 pt-4 pb-10">
        <p className={paragraph}>
          This page explains, in plain language, what information {churchName} keeps in its
          attendance app, why, and who can see it.
        </p>

        <Section title="Who runs this">
          <p className={paragraph}>
            {churchName} runs this app and is responsible for the information in it. The app itself
            is provided by {PLATFORM_PROVIDER}, which builds and hosts it for the church.
          </p>
        </Section>

        <Section title="What we collect">
          <p className={paragraph}>For church team members who sign in:</p>
          <ul className={list}>
            <li>Name and Google email address, used only for signing in.</li>
          </ul>
          <p className={paragraph}>For members and newcomers:</p>
          <ul className={list}>
            <li>Name, phone number and email address.</li>
            <li>Attendance at services.</li>
            <li>
              For newcomers, optionally: birthday (day and month only), occupation, and how they
              heard about the church.
            </li>
          </ul>
        </Section>

        <Section title="Why we collect it">
          <p className={paragraph}>
            The church uses this information to keep track of attendance, to follow up with
            newcomers, and for pastoral care. It is not used for anything else.
          </p>
        </Section>

        <Section title="Google sign-in">
          <p className={paragraph}>
            Team members sign in with their Google account. The app receives only the team
            member&apos;s name and email address from Google. It has no access to their email
            messages, contacts, files or any other Google data.
          </p>
        </Section>

        <Section title="Where it is stored">
          <p className={paragraph}>
            Everything is stored in the church&apos;s own Google Sheets. Nothing is sold, and
            nothing is shared with third parties for marketing.
          </p>
        </Section>

        <Section title="Who can see it">
          <p className={paragraph}>
            Only approved church team members can sign in and see this information.
          </p>
        </Section>

        <Section title="Messages">
          <p className={paragraph}>
            The church may send follow-up messages. Anyone can opt out at any time by replying STOP,
            and no further follow-up messages will be sent.
          </p>
        </Section>

        <Section title="Questions or removal">
          <p className={paragraph}>
            To ask a question about your information, or to have it corrected or removed, contact
            the church at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-primary underline underline-offset-2"
            >
              {contactEmail}
            </a>
            .
          </p>
        </Section>

        <p className="text-center text-[13px] text-muted">
          Church team member?{" "}
          <Link href={signInHref} className="font-medium text-primary underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </main>
    </>
  );
}
