import type { CSSProperties } from "react";
import { DevToolbar } from "@/components/dev/DevToolbar";
import { BottomNav } from "@/components/ui";
import { getChurchConfigOrNotFound } from "@/lib/server/church";
import { devToolsEnabled } from "@/lib/server/dev-tools";
import { loadDevToolbar } from "@/lib/server/dev-toolbar";

export default async function ChurchLayout({ children, params }: LayoutProps<"/[church]">) {
  const { church } = await params;
  const config = getChurchConfigOrNotFound(church);
  const devToolbar = devToolsEnabled() ? await loadDevToolbar(config) : null;

  return (
    <div
      style={{ "--ff-primary": config.branding.primaryColor } as CSSProperties}
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background"
    >
      {children}
      {devToolbar && <DevToolbar data={devToolbar} />}
      <BottomNav church={config.slug} />
    </div>
  );
}
