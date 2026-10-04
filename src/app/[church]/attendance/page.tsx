import type { Metadata } from "next";
import { AttendanceHeader } from "@/components/attendance/AttendanceHeader";
import { AttendanceScreen } from "@/components/attendance/AttendanceScreen";
import { capitalize, formatServiceDate } from "@/lib/format";
import { getLatestServiceDate } from "@/lib/rules";
import { loadAttendanceScreen } from "@/lib/server/attendance-screen";
import { getChurchConfigOrNotFound } from "@/lib/server/church";
import { getDataSource } from "@/lib/server/data-source";
import { getNow, getSession } from "@/lib/server/request-context";

export async function generateMetadata({
  params,
}: PageProps<"/[church]/attendance">): Promise<Metadata> {
  const { church } = await params;
  return { title: `Attendance · ${getChurchConfigOrNotFound(church).displayName}` };
}

export default async function AttendancePage({ params }: PageProps<"/[church]/attendance">) {
  const { church } = await params;
  const config = getChurchConfigOrNotFound(church);
  const session = await getSession(config);
  const now = await getNow();

  if (!session) {
    return (
      <>
        <AttendanceHeader
          churchName={config.displayName}
          dateLabel={formatServiceDate(getLatestServiceDate(now, config))}
          title={`${capitalize(config.schedule.serviceDay)} Service`}
          subtitle="Sign in required"
          markingClosed
        />
        <main className="px-4 pt-4 pb-28">
          <p className="rounded-card border border-border bg-surface px-5 py-7 text-center text-[15px] text-muted">
            Sign-in is not available yet. Attendance is only shown to signed-in team members.
          </p>
        </main>
      </>
    );
  }

  const data = await loadAttendanceScreen(config, session, now, getDataSource(config));
  return <AttendanceScreen data={data} />;
}
