import type { CSSProperties } from "react";
import { getChurchConfigOrNotFound } from "@/lib/server/church";

/** Church branding for every church page, including sign-in. */
export default async function ChurchLayout({ children, params }: LayoutProps<"/[church]">) {
  const { church } = await params;
  const config = getChurchConfigOrNotFound(church);

  return (
    <div
      style={{ "--ff-primary": config.branding.primaryColor } as CSSProperties}
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background"
    >
      {children}
    </div>
  );
}
