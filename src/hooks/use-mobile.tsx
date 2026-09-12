import * as React from "react";

/** The mobile layout applies to viewports narrower than 768px. */
export const MOBILE_BREAKPOINT = 768;
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export function isMobileViewport(width: number) {
  return width < MOBILE_BREAKPOINT;
}

type MediaQueryListener = () => void;

let mediaQuery: MediaQueryList | null = null;
const listeners = new Set<MediaQueryListener>();

function getMediaQuery() {
  if (typeof window === "undefined") return null;
  mediaQuery ??= window.matchMedia(MOBILE_MEDIA_QUERY);
  return mediaQuery;
}

function subscribe(listener: MediaQueryListener) {
  const query = getMediaQuery();
  if (!query) return () => undefined;

  listeners.add(listener);
  if (listeners.size === 1) query.addEventListener("change", notifyListeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      query.removeEventListener("change", notifyListeners);
      mediaQuery = null;
    }
  };
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function getSnapshot() {
  return getMediaQuery()?.matches ?? false;
}

function getServerSnapshot() {
  return false;
}

/**
 * Returns the mobile state without reading `window` during server render. A
 * shared media-query subscription prevents one listener per use.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
