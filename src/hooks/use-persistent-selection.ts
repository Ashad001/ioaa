"use client";

/**
 * Gate selection that survives a refresh.
 *
 * Written against `useSyncExternalStore` rather than "read in an effect, then
 * setState": sessionStorage is an external system, and treating it as one means
 * the first render already has the saved value instead of flashing an empty
 * selection and correcting itself a frame later. Losing a gate selection to an
 * accidental reload is exactly the kind of small infuriating thing this avoids.
 */
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const EMPTY: string[] = [];

/** Cache the parsed array per key so getSnapshot returns a stable reference. */
const cache = new Map<string, { raw: string | null; value: string[] }>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readSnapshot(key: string): string[] {
  const raw = sessionStorage.getItem(key);
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value;

  let value: string[] = EMPTY;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) value = parsed.filter((entry): entry is string => typeof entry === "string");
    } catch {
      value = EMPTY;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function usePersistentSelection(key: string) {
  const selected = useSyncExternalStore(
    subscribe,
    useCallback(() => readSnapshot(key), [key]),
    // The server has no session storage, so the server snapshot is empty. The
    // saved value arrives on the client's first render, not in an effect.
    useCallback(() => EMPTY, []),
  );

  const write = useCallback(
    (next: string[]) => {
      sessionStorage.setItem(key, JSON.stringify(next));
      for (const listener of listeners) listener();
    },
    [key],
  );

  const toggle = useCallback(
    (id: string) => {
      const current = readSnapshot(key);
      write(current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
    },
    [key, write],
  );

  const clear = useCallback(() => write(EMPTY), [write]);

  return { selected, toggle, clear };
}
