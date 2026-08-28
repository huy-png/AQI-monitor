import { env } from "../config/env";

export type RuntimeDataSource = "mock" | "api" | "firebase";
export type SelectableDataSource = "api" | "firebase";

const STORAGE_KEY = "climasense:data-source";
const EVENT_NAME = "climasense:data-source-changed";

function isRuntimeDataSource(value: string | null): value is RuntimeDataSource {
  return value === "mock" || value === "api" || value === "firebase";
}

function isSelectableDataSource(value: string | null): value is SelectableDataSource {
  return value === "api" || value === "firebase";
}

export function getRuntimeDataSource(): RuntimeDataSource {
  const stored = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
  if (isRuntimeDataSource(stored)) return stored;
  return env.dataSource;
}

export function getSelectedDataSource(): SelectableDataSource {
  const source = getRuntimeDataSource();
  return source === "firebase" ? "firebase" : "api";
}

export function setSelectedDataSource(source: SelectableDataSource) {
  window.localStorage.setItem(STORAGE_KEY, source);
  window.dispatchEvent(new window.CustomEvent(EVENT_NAME, { detail: source }));
}

export function subscribeToDataSourceChanges(onChange: (source: RuntimeDataSource) => void) {
  const handleCustomEvent = (event: globalThis.Event) => {
    const detail = "detail" in event ? String(event.detail) : null;
    if (isSelectableDataSource(detail)) onChange(detail);
  };
  const handleStorageEvent = (event: globalThis.StorageEvent) => {
    if (event.key === STORAGE_KEY && isRuntimeDataSource(event.newValue)) onChange(event.newValue);
  };

  window.addEventListener(EVENT_NAME, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);
  return () => {
    window.removeEventListener(EVENT_NAME, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}
