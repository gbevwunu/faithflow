import type { Metadata } from "next";
import { PrivacyPolicy } from "@/components/privacy/PrivacyPolicy";
import { getChurchConfigOrNotFound } from "@/lib/server/church";
import { getChurchBasePath } from "@/lib/server/church-paths";

export async function generateMetadata({
  params,
}: PageProps<"/[church]/privacy">): Promise<Metadata> {
  const { church } = await params;
  return { title: `Privacy · ${getChurchConfigOrNotFound(church).displayName}` };
}

/**
 * The church's public privacy page. It sits outside the (app) route group and never reads
 * the session, so anyone can open it, signed in or not.
 */
export default async function PrivacyPage({ params }: PageProps<"/[church]/privacy">) {
  const { church } = await params;
  const config = getChurchConfigOrNotFound(church);
  const basePath = await getChurchBasePath(config.slug);
  return (
    <PrivacyPolicy
      churchName={config.displayName}
      contactEmail={config.privacyContactEmail}
      signInHref={`${basePath}/sign-in`}
    />
  );
}
