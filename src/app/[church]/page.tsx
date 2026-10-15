import { redirect } from "next/navigation";
import { getChurchConfigOrNotFound } from "@/lib/server/church";
import { getChurchBasePath } from "@/lib/server/church-paths";

export default async function ChurchHome({ params }: PageProps<"/[church]">) {
  const { church } = await params;
  const config = getChurchConfigOrNotFound(church);
  // Same-origin path built from the config slug only, never from request input.
  redirect(`${await getChurchBasePath(config.slug)}/attendance`);
}
