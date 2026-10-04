import type { Metadata } from "next";
import { getChurchConfigOrNotFound } from "@/lib/server/church";

export async function generateMetadata({
  params,
}: PageProps<"/[church]/newcomers">): Promise<Metadata> {
  const { church } = await params;
  return { title: `Newcomers · ${getChurchConfigOrNotFound(church).displayName}` };
}

export default async function NewcomersPage({ params }: PageProps<"/[church]/newcomers">) {
  const { church } = await params;
  const config = getChurchConfigOrNotFound(church);
  return (
    <>
      <header className="bg-primary px-5 pt-12 pb-5 text-on-primary">
        <p className="text-[13px] text-on-primary/80">{config.displayName}</p>
        <h1 className="mt-1 text-[24px] leading-tight font-bold">Newcomers</h1>
      </header>
      <main className="px-4 pt-4 pb-28">
        <p className="rounded-card border border-border bg-surface px-5 py-7 text-center text-[15px] text-muted">
          Newcomer follow-up is coming soon.
        </p>
      </main>
    </>
  );
}
