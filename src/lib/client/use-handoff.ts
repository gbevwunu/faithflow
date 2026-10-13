"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reads a one-time handoff value from browser storage after hydration. Returns
 * { ready: false } on the server and the first browser render, so markup always matches.
 */
export function useHandoff<T>(take: () => T | null): { ready: boolean; value: T | null } {
  const [state, setState] = useState<{ ready: boolean; value: T | null }>({
    ready: false,
    value: null,
  });
  const taken = useRef(false);

  useEffect(() => {
    if (taken.current) return;
    taken.current = true;
    // Browser storage is only readable after hydration; this syncs from that external store once.
    setState({ ready: true, value: take() });
  }, [take]);

  return state;
}
