"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { markPresentAction, unmarkAction } from "@/app/[church]/attendance/actions";
import { Chip } from "@/components/ui";
import { formatServiceDate } from "@/lib/format";
import { searchRoster } from "@/lib/rules";
import type { AttendanceScreenData } from "@/lib/server/attendance-screen";
import type { ClientMark, ClientRosterEntry } from "@/lib/server/client-roster";
import { AttendanceHeader, STATE_SUBTITLES } from "./AttendanceHeader";
import { CountdownBanner } from "./CountdownBanner";
import { CounterCards } from "./CounterCards";
import { EmptySearch } from "./EmptySearch";
import { RosterRow } from "./RosterRow";
import { SearchField } from "./SearchField";
import { useServerClock } from "./use-server-clock";

type Filter = "all" | "not-ticked" | "newcomers";
type Marks = Record<string, ClientMark | null>;

const marksFrom = (roster: ClientRosterEntry[]): Marks =>
  Object.fromEntries(roster.map((entry) => [entry.id, entry.mark]));

const searchFields = (entry: ClientRosterEntry) => ({
  firstName: entry.firstName,
  lastName: entry.lastName,
  phone: entry.phoneLast4,
});

export function AttendanceScreen({ data }: { data: AttendanceScreenData }) {
  const router = useRouter();
  const now = useServerClock(data.now);

  // Local copy of marks for optimistic updates, reset whenever the server sends a new roster.
  const [baseRoster, setBaseRoster] = useState(data.roster);
  const [marks, setMarks] = useState<Marks>(() => marksFrom(data.roster));
  if (baseRoster !== data.roster) {
    setBaseRoster(data.roster);
    setMarks(marksFrom(data.roster));
  }

  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<number | undefined>(undefined);

  const msToTeamLock = Date.parse(data.teamLockAt) - now;
  const msToCorrectionEnd = Date.parse(data.correctionEndAt) - now;

  // When the window closes (or opens) while the page is open, fetch the new state.
  const crossedBoundary =
    data.isServiceDay &&
    ((data.state === "open" && msToTeamLock <= 0) ||
      (data.state === "corrections" && msToCorrectionEnd <= 0));
  useEffect(() => {
    if (crossedBoundary) router.refresh();
  }, [crossedBoundary, router]);

  useEffect(() => () => window.clearTimeout(errorTimer.current), []);

  function showError(message: string) {
    setError(message);
    window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setError(null), 5000);
  }

  const canMark = data.allowed && !crossedBoundary;

  async function toggle(entry: ClientRosterEntry) {
    if (!canMark || pending.has(entry.id)) return;
    const previous = marks[entry.id] ?? null;
    const marking = previous === null;

    setMarks((m) => ({
      ...m,
      [entry.id]: marking
        ? { markedByName: data.viewerName, markedAt: new Date(now).toISOString() }
        : null,
    }));
    setPending((p) => new Set(p).add(entry.id));

    try {
      const input = { church: data.church, personId: entry.id };
      const result = marking ? await markPresentAction(input) : await unmarkAction(input);
      if (result.ok) {
        setMarks((m) => ({ ...m, [entry.id]: result.mark }));
      } else {
        setMarks((m) => ({ ...m, [entry.id]: previous }));
        showError(result.error);
        if (result.code === "window-closed") router.refresh();
      }
    } catch {
      setMarks((m) => ({ ...m, [entry.id]: previous }));
      showError("Could not reach the server. Your change was not saved.");
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(entry.id);
        return next;
      });
    }
  }

  const rows = useMemo(
    () => data.roster.map((entry) => ({ ...entry, mark: marks[entry.id] ?? null })),
    [data.roster, marks],
  );
  const present = rows.filter((r) => r.mark !== null).length;
  const newcomersPresent = rows.filter((r) => r.list === "newcomer" && r.mark !== null).length;

  const visible = useMemo(() => {
    const filtered = rows.filter((r) =>
      filter === "not-ticked"
        ? r.mark === null
        : filter === "newcomers"
          ? r.list === "newcomer"
          : true,
    );
    return searchRoster(filtered, query, searchFields);
  }, [rows, filter, query]);

  const searching = query.trim() !== "";

  return (
    <>
      <AttendanceHeader
        churchName={data.churchName}
        dateLabel={formatServiceDate(data.serviceDate)}
        title={data.serviceTitle}
        subtitle={STATE_SUBTITLES[data.state]}
        markingClosed={!canMark}
      />

      <main className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-28">
        <CountdownBanner
          state={data.state}
          role={data.role}
          isServiceDay={data.isServiceDay}
          serviceDay={data.serviceDay}
          teamLockTime={data.teamLockTime}
          correctionEndTime={data.correctionEndTime}
          msToTeamLock={msToTeamLock}
          msToCorrectionEnd={msToCorrectionEnd}
        />

        <CounterCards
          present={present}
          notTicked={rows.length - present}
          newcomers={newcomersPresent}
        />

        <div className="flex flex-col gap-3">
          <SearchField value={query} onChange={setQuery} />

          <div role="group" aria-label="Filter" className="-mb-2 flex gap-2 overflow-x-auto py-2">
            <Chip pressed={filter === "all"} onClick={() => setFilter("all")}>
              All {rows.length}
            </Chip>
            <Chip pressed={filter === "not-ticked"} onClick={() => setFilter("not-ticked")}>
              Not ticked
            </Chip>
            <Chip pressed={filter === "newcomers"} onClick={() => setFilter("newcomers")}>
              Newcomers
            </Chip>
          </div>
        </div>

        <p className="sr-only" role="status">
          {searching ? `${visible.length} ${visible.length === 1 ? "result" : "results"}` : ""}
        </p>

        {visible.length > 0 ? (
          <ul
            aria-label="Roster"
            className="overflow-hidden rounded-card border border-border bg-surface"
          >
            {visible.map((entry) => (
              <RosterRow
                key={entry.id}
                firstName={entry.firstName}
                lastName={entry.lastName}
                list={entry.list}
                phoneLast4={entry.phoneLast4}
                mark={entry.mark}
                timezone={data.timezone}
                disabled={!canMark}
                pending={pending.has(entry.id)}
                onToggle={() => toggle(entry)}
              />
            ))}
          </ul>
        ) : searching ? (
          <EmptySearch query={query} />
        ) : (
          <p className="rounded-card border border-border bg-surface px-5 py-7 text-center text-[15px] text-muted">
            {filter === "not-ticked" ? "Everyone on the list is ticked." : "No one to show."}
          </p>
        )}
      </main>

      <div
        role="alert"
        aria-live="assertive"
        className="pointer-events-none fixed inset-x-0 bottom-[76px] z-30 mx-auto flex max-w-[430px] justify-center px-4"
      >
        {error && (
          <p className="pointer-events-auto rounded-card bg-ink px-4 py-3 text-[14px] text-on-primary shadow-lg">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
