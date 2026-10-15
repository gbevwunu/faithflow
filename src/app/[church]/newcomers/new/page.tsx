import type { Metadata } from "next";
import Link from "next/link";
import { NewcomerForm } from "@/components/newcomer/NewcomerForm";
import { capitalize, formatMonthDay } from "@/lib/format";
import { getLatestServiceDate, getMarkingWindow } from "@/lib/rules";
import { getChurchConfigOrNotFound } from "@/lib/server/church";
import { getChurchBasePath } from "@/lib/server/church-paths";
import { getNow, getSession } from "@/lib/server/request-context";

export async function generateMetadata({
  params,
}: PageProps<"/[church]/newcomers/new">): Promise<Metadata> {
  const { church } = await params;
  return { title: `Add newcomer · ${getChurchConfigOrNotFound(church).displayName}` };
}

export default async function AddNewcomerPage({ params }: PageProps<"/[church]/newcomers/new">) {
  const { church } = await params;
  const config = getChurchConfigOrNotFound(church);
  const basePath = await getChurchBasePath(config.slug);
  const session = await getSession(config);
  const now = await getNow();
  const allowed = session ? getMarkingWindow(now, session.role, config).allowed : false;
  const serviceTitle = `${capitalize(config.schedule.serviceDay)} Service`;
  const dateLabel = formatMonthDay(getLatestServiceDate(now, config));

  return (
    <>
      <header className={`${allowed ? "bg-primary" : "bg-ink"} px-5 pt-10 pb-5 text-on-primary`}>
        <Link
          href={`${basePath}/attendance`}
          className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-[14px] text-on-primary/80 focus-visible:outline-2 focus-visible:outline-on-primary"
        >
          <span aria-hidden="true">←</span> Back to attendance
        </Link>
        <h1 className="text-[24px] leading-tight font-bold">Add newcomer</h1>
        <p className="mt-0.5 text-[14px] text-on-primary/80">
          {serviceTitle} · {dateLabel}
          {allowed && " · * required"}
        </p>
      </header>

      {allowed ? (
        <NewcomerForm church={config.slug} basePath={basePath} />
      ) : (
        <main className="px-4 pt-4 pb-28">
          <p className="rounded-card border border-border bg-surface px-5 py-7 text-center text-[15px] text-muted">
            {session
              ? "Adding newcomers is closed right now. It follows the same times as ticking attendance."
              : "Sign-in is not available yet. Only signed-in team members can add newcomers."}
          </p>
        </main>
      )}
    </>
  );
}
