"use client";

import { useEffect, useState } from "react";

/**
 * A result that survives leaving the screen and coming back.
 *
 * Every screen held its result in plain useState. The nav links are real navigations, so
 * going Board, Autopsy, Board threw the run away and left an empty page, and a four
 * minute paid run had to be repeated to look at it again. Reported twice.
 *
 * sessionStorage rather than a store, because the nav is real page loads. It clears when
 * the tab closes, so nothing stale survives into a new session.
 */
export function useKept<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  // read after mount: the server has no sessionStorage and hydration must match
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // corrupt or disabled storage is not a reason to fail the screen
    }
  }, [key]);

  /** Same contract as useState, functional updates included, so callers do not change. */
  const set = (v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      try {
        if (next === null || next === undefined) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        // quota or disabled storage: the value still lands in state
      }
      return next;
    });
  };

  return [value, set];
}
