import { redirect } from "next/navigation";
import { getChurchConfigOrNotFound } from "@/lib/server/church";

export default async function ChurchHome({ params }: PageProps<"/[church]">) {
  const { church } = await params;
  const config = getChurchConfigOrNotFound(church);
  redirect(`/${config.slug}/attendance`);
}
