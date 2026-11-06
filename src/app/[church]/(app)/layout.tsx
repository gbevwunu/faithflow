import { DevToolbar } from "@/components/dev/DevToolbar";
import { BottomNav } from "@/components/ui";
import { getChurchConfigOrNotFound } from "@/lib/server/church";
import { getChurchBasePath } from "@/lib/server/church-paths";
import { devToolsEnabled } from "@/lib/server/dev-tools";
import { loadDevToolbar } from "@/lib/server/dev-toolbar";

/**
 * The app screens: navigation and, in development, the dev toolbar. Each page checks the
 * session itself, because a layout is not re-rendered on every navigation.
 */
export default async function AppLayout({ children, params }: LayoutProps<"/[church]">) {
  const { church } = await params;
  const config = getChurchConfigOrNotFound(church);
  const basePath = await getChurchBasePath(config.slug);
  const devToolbar = devToolsEnabled() ? await loadDevToolbar(config) : null;

  return (
    <>
      {children}
      {devToolbar && <DevToolbar data={devToolbar} />}
      <BottomNav basePath={basePath} />
    </>
  );
}
