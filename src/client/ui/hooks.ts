import { useEffect, useState, useSyncExternalStore } from "react";
import { store } from "../net.ts";

export function useStore() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function relLabel(v: number): string {
  if (v >= 60) return "Bästis";
  if (v >= 25) return "Polare";
  if (v >= -10) return "Kollega";
  if (v >= -40) return "Lite irriterad på";
  return "Ärkerival";
}
