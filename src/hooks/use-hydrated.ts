import { useEffect, useState } from "react";

/**
 * Returns true only after the component has hydrated on the client.
 * Use this to gate access to browser-only APIs (IndexedDB, localStorage)
 * so SSR renders a stable shell without crashing.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
