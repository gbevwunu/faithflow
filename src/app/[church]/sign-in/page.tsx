import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignInCard } from "@/components/auth/SignInCard";
import { churchSlugFromHost, getSignInScreenState, type SessionResolution } from "@/lib/rules";
import { realSignInEnabled } from "@/lib/server/auth-mode";
import { getChurchConfigOrNotFound } from "@/lib/server/church";
import { getChurchBasePath } from "@/lib/server/church-paths";
import { signInWithGoogleAction } from "./actions";

export async function generateMetadata({
  params,
}: PageProps<"/[church]/sign-in">): Promise<Metadata> {
  const { church } = await params;
  return { title: `Sign in · ${getChurchConfigOrNotFound(church).displayName}` };
}

export default async function SignInPage({ params, searchParams }: PageProps<"/[church]/sign-in">) {
  const { church } = await params;
  const { error } = await searchParams;
  const config = getChurchConfigOrNotFound(church);
  const basePath = await getChurchBasePath(config.slug);
  const rootDomain = process.env.ROOT_DOMAIN?.trim() || null;
  const onChurchHost =
    churchSlugFromHost((await headers()).get("host"), rootDomain) === config.slug;

  const realSignIn = realSignInEnabled();
  let session: SessionResolution["status"] = "signed-out";
  if (realSignIn) {
    const { resolveGoogleSession } = await import("@/lib/server/auth-session");
    session = (await resolveGoogleSession(config)).status;
  }

  const state = getSignInScreenState({
    realSignIn,
    onChurchHost,
    session,
    error: typeof error === "string" ? error : undefined,
  });
  if (state.kind === "signed-in") redirect(`${basePath}/attendance`);

  return (
    <SignInCard
      churchName={config.displayName}
      churchHost={rootDomain ? `${config.slug}.${rootDomain}` : null}
      state={state}
      signInAction={signInWithGoogleAction.bind(null, config.slug)}
      attendanceHref={`${basePath}/attendance`}
    />
  );
}
