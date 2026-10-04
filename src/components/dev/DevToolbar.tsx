"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearDevNowAction, setDevNowAction, setDevRoleAction } from "@/app/[church]/dev-actions";
import type { TeamRole } from "@/lib/config";
import { capitalize, formatClockTime, formatServiceDate } from "@/lib/format";
import type { DevToolbarData } from "@/lib/server/dev-toolbar";

/** Development-only controls for the fake session and fake clock. Never rendered in production. */
export function DevToolbar({ data }: { data: DevToolbarData }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [custom, setCustom] = useState("");

  function run(action: () => Promise<{ ok: boolean }>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  const nowDate = new Intl.DateTimeFormat("en-CA", { timeZone: data.timezone }).format(
    new Date(data.now),
  );
  const nowLabel = `${formatServiceDate(nowDate)} · ${formatClockTime(data.now, data.timezone)}`;
  const current = data.roles.find((r) => r.role === data.role);

  const buttonClass =
    "min-h-[36px] rounded-input border px-2.5 text-[13px] focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
  const pressedClass = (pressed: boolean) =>
    pressed ? "border-ink bg-ink text-on-primary" : "border-border bg-surface text-ink";

  return (
    <details className="mx-4 mb-24 rounded-card border border-dashed border-muted bg-surface text-[13px] text-ink">
      <summary className="cursor-pointer px-3.5 py-3 font-medium">
        Dev tools · {current ? `${capitalize(current.role)} (${current.name})` : "No session"} ·{" "}
        {data.nowFaked ? `Fake time ${nowLabel}` : "Real time"}
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-3.5 py-3" aria-busy={busy}>
        <p className="text-muted">Development only. Not available on production deployments.</p>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Signed in as</legend>
          <div className="flex flex-wrap gap-2">
            {data.roles.map(({ role, name }) => (
              <button
                key={role}
                type="button"
                aria-pressed={data.role === role}
                disabled={busy}
                onClick={() => run(() => setDevRoleAction(role satisfies TeamRole))}
                className={`${buttonClass} ${pressedClass(data.role === role)}`}
              >
                {capitalize(role)} · {name}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Time ({data.timezone})</legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={!data.nowFaked}
              disabled={busy}
              onClick={() => run(clearDevNowAction)}
              className={`${buttonClass} ${pressedClass(!data.nowFaked)}`}
            >
              Real time
            </button>
            {data.presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    setDevNowAction({ church: data.church, date: preset.date, time: preset.time }),
                  )
                }
                className={`${buttonClass} ${pressedClass(false)}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const [date, time] = custom.split("T");
              if (date && time) {
                run(() => setDevNowAction({ church: data.church, date, time: time.slice(0, 5) }));
              }
            }}
          >
            <label className="sr-only" htmlFor="dev-fake-now">
              Custom time in church timezone
            </label>
            <input
              id="dev-fake-now"
              type="datetime-local"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="min-h-[36px] flex-1 rounded-input border border-border bg-surface px-2"
            />
            <button
              type="submit"
              disabled={busy || !custom}
              className={`${buttonClass} ${pressedClass(false)}`}
            >
              Set
            </button>
          </form>
        </fieldset>
      </div>
    </details>
  );
}
