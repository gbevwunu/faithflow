"use client";

import { useEffect, useState } from "react";

/**
 * The server's notion of now, advanced by the browser's clock since the page loaded.
 * Keeps countdowns consistent with the server, including a faked development clock.
 * Renders with the server's instant first, so server and browser output match.
 */
export function useServerClock(serverNow: string, intervalMs = 15_000): number {
  const serverMs = Date.parse(serverNow);
  const [now, setNow] = useState(serverMs);

  useEffect(() => {
    const offset = serverMs - Date.now();
    const tick = () => setNow(Date.now() + offset);
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [serverMs, intervalMs]);

  return now;
}
