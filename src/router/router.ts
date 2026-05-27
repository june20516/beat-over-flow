import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function getPathname(): string {
  return window.location.pathname;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState(null, "", to);
  notify();
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, getPathname);
}

export type Route =
  | { kind: "home" }
  | { kind: "projectList" }
  | { kind: "editor"; projectId: string }
  | { kind: "play" }
  | { kind: "notFound" };

export function matchRoute(pathname: string): Route {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return { kind: "home" };
  if (segments[0] === "edit") {
    if (segments.length === 1) return { kind: "projectList" };
    if (segments.length === 2) return { kind: "editor", projectId: segments[1] };
    return { kind: "notFound" };
  }
  if (segments[0] === "play" && segments.length === 1) return { kind: "play" };
  return { kind: "notFound" };
}
