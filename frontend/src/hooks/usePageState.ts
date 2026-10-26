import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "react-router-dom";

// Keep page controls across navigation/reloads in this tab; never cache readings.
export function usePageState<T>(name: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const { pathname } = useLocation();
  const key = `climasense:page:v1:${pathname}:${name}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw !== null) {
        const saved: unknown = JSON.parse(raw);
        if (Array.isArray(initial)) {
          if (Array.isArray(saved) && saved.every(item => typeof item === "string")) return saved as T;
        } else if (typeof saved === typeof initial && saved !== null) return saved as T;
      }
    } catch { /* Storage may be unavailable; retain normal component state. */ }
    return initial;
  });
  useEffect(() => {
    try { window.sessionStorage.setItem(key, JSON.stringify(value)); }
    catch { /* A blocked/full storage must not break the page. */ }
  }, [key, value]);
  return [value, setValue];
}
