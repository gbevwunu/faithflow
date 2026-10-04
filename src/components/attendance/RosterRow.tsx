import { Avatar, Pill } from "@/components/ui";
import { formatClockTime } from "@/lib/format";
import type { ClientMark } from "@/lib/server/client-roster";
import type { PersonList } from "@/lib/data";
import { TickButton } from "./TickButton";

export function RosterRow({
  firstName,
  lastName,
  list,
  phoneLast4,
  mark,
  timezone,
  disabled,
  pending,
  onToggle,
}: {
  firstName: string;
  lastName: string;
  list: PersonList;
  phoneLast4: string;
  mark: ClientMark | null;
  timezone: string;
  disabled: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  const name = `${firstName} ${lastName}`;
  return (
    <li className="flex min-h-[61px] items-center gap-3 border-b border-border px-3.5 py-2 last:border-b-0">
      <Avatar firstName={firstName} lastName={lastName} tone={list} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[16px] leading-snug text-ink">
          <span className="truncate">{name}</span>
          {list === "newcomer" && <Pill>Newcomer</Pill>}
        </p>
        {mark ? (
          <p className="flex min-w-0 text-[13px] text-success-text">
            <span className="truncate">Ticked by {mark.markedByName}</span>
            <span className="shrink-0 whitespace-pre">
              {" "}
              · {formatClockTime(mark.markedAt, timezone)}
            </span>
          </p>
        ) : (
          <p className="truncate text-[13px] text-muted">
            {list === "newcomer" ? "Newcomer" : "Member"} · <span aria-hidden="true">•••</span>
            <span className="sr-only">phone ending in</span> {phoneLast4}
          </p>
        )}
      </div>
      <TickButton
        name={name}
        marked={mark !== null}
        disabled={disabled}
        pending={pending}
        onToggle={onToggle}
      />
    </li>
  );
}
