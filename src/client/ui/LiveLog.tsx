import { useMemo, useState } from "react";
import type { LogTag } from "../../shared/protocol.ts";
import { fmtTime, useStore } from "./hooks.ts";

const FILTERS: [string, string, LogTag[] | null][] = [
  ["all", "Allt", null],
  ["chaos", "Kaos", ["chaos", "world"]],
  ["say", "Prat", ["say", "social"]],
  ["player", "Spelare", ["player"]],
  ["secret", "Hemligt", ["secret"]],
];

export function LiveLog({ open, onToggle, onFocus }: { open: boolean; onToggle: () => void; onFocus: (id: string) => void }) {
  const s = useStore();
  const [filter, setFilter] = useState("all");
  const tags = FILTERS.find((f) => f[0] === filter)?.[2] ?? null;
  const entries = useMemo(() => {
    const list = tags ? s.log.filter((e) => tags.includes(e.tag)) : s.log;
    return list.slice(-120).reverse();
  }, [s.log.length, s.version, filter]);

  return (
    <aside className={`panel livelog ${open ? "open" : "closed"}`} aria-label="Barnhusgatan Live">
      <button className="livelog-toggle" onClick={onToggle} aria-expanded={open} title={open ? "Fäll in" : "Visa Barnhusgatan Live"}>
        <span className="live-dot" /> {open ? "Barnhusgatan Live" : "Live"}
        <span className="chev" aria-hidden>
          {open ? "›" : "‹"}
        </span>
      </button>
      {open && (
        <>
          <div className="filters" role="tablist">
            {FILTERS.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={filter === key} className={`chip chip-btn ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
          <ol className="log-list">
            {entries.map((e) => (
              <li key={`${e.id}-${e.ts}`} className={`log-item tag-${e.tag} ${e.who ? "clickable" : ""}`} onClick={() => e.who && onFocus(e.who)}>
                <span className="log-time">{fmtTime(e.ts)}</span>
                <span className="log-icon" aria-hidden>
                  {e.icon}
                </span>
                <span className="log-text">
                  {e.text}
                  {e.room && <span className="log-room"> · {e.room}</span>}
                </span>
              </li>
            ))}
            {!entries.length && <li className="muted empty">Tyst på Barnhusgatan... än så länge.</li>}
          </ol>
        </>
      )}
    </aside>
  );
}
