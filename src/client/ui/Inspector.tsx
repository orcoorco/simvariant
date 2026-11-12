import { CONSULTANT_BY_ID, NPCS } from "../../shared/consultants.ts";
import type { Needs } from "../../shared/protocol.ts";
import { relLabel, useStore } from "./hooks.ts";
import { Portrait } from "./Portrait.tsx";

const NEEDS: [keyof Needs, string, string, string][] = [
  ["koffein", "☕", "Koffein", "#c98a52"],
  ["energi", "⚡", "Energi", "#ffd86b"],
  ["fokus", "🎯", "Fokus", "#7fb7ff"],
  ["socialt", "💬", "Socialt sug", "#ff9fd0"],
  ["inspiration", "💡", "Inspiration", "#b3e88f"],
  ["hunger", "🍔", "Hunger", "#ff9a62"],
  ["kaos", "🌀", "Kaos", "#ff5d73"],
];

const CTRL: Record<string, [string, string]> = {
  ai: ["🤖", "Autopilot – lever sitt eget liv"],
  player: ["🎮", "Styrs av spelaren just nu"],
  scheme: ["🎪", "Mitt i ett upptåg"],
};

export function Inspector({ id, onClose, onFollow, following }: { id: string; onClose: () => void; onFollow: (id: string) => void; following: boolean }) {
  const s = useStore();
  const c = CONSULTANT_BY_ID[id];
  if (!c) {
    const n = NPCS.find((q) => q.id === id);
    if (!n) return null;
    return (
      <aside className="panel inspector" aria-label={`Information om ${n.name}`}>
        <button className="icon-btn close" onClick={onClose} aria-label="Stäng">
          ✕
        </button>
        <div className="insp-head">
          <Portrait id={n.id} size={72} />
          <div>
            <h2>{n.name}</h2>
            <div className="muted">{n.title}</div>
          </div>
        </div>
        <p className="bio">{n.bio}</p>
        <div className="insp-actions">
          <button className={`btn ${following ? "btn-on" : ""}`} onClick={() => onFollow(n.id)}>
            {following ? "📍 Följer" : "📍 Följ"}
          </button>
        </div>
      </aside>
    );
  }
  const d = s.details.get(id);
  const ctrl = CTRL[d?.ctrl ?? "ai"];
  const isMe = s.me?.id === id;
  return (
    <aside className="panel inspector" aria-label={`Information om ${c.name}`}>
      <button className="icon-btn close" onClick={onClose} aria-label="Stäng">
        ✕
      </button>
      <div className="insp-head">
        <Portrait id={c.id} size={72} />
        <div className="insp-title">
          <h2>
            {c.name} {isMe && <span className="chip chip-me">du</span>}
          </h2>
          <div className="muted">{c.title}</div>
          <div className="chips">
            {c.fields.map((f) => (
              <span key={f} className="chip">
                {f}
              </span>
            ))}
            {d?.online && <span className="chip chip-online">● inloggad</span>}
          </div>
        </div>
      </div>

      {d && (
        <>
          <div className="insp-status">
            <div className="mood">
              <span className="mood-icon">{d.moodIcon}</span>
              <div>
                <div className="label">Humör</div>
                <strong>{d.mood}</strong>
              </div>
            </div>
            <div className="mood">
              <span className="mood-icon">{ctrl[0]}</span>
              <div>
                <div className="label">Styrning</div>
                <strong>{ctrl[1]}</strong>
              </div>
            </div>
          </div>
          <div className="activity">
            <span className="label">Gör just nu</span> {d.act} <span className="muted">· {d.room}</span>
          </div>
          <div className="thought" title="Senaste tanke">
            <span aria-hidden>💭</span> {d.thought}
          </div>
          <div className="needs">
            {NEEDS.map(([k, icon, label, color]) => (
              <div key={k} className="need" title={`${label}: ${d.needs[k]}%`}>
                <span className="need-icon" aria-hidden>
                  {icon}
                </span>
                <span className="need-label">{label}</span>
                <span className="bar">
                  <span style={{ width: `${Math.max(2, Math.min(100, d.needs[k]))}%`, background: color }} />
                </span>
              </div>
            ))}
          </div>
          {d.rel.length > 0 && (
            <div className="section">
              <h3>Relationer</h3>
              <ul className="rels">
                {d.rel.map(([rid, v]) => {
                  const o = CONSULTANT_BY_ID[rid];
                  if (!o) return null;
                  return (
                    <li key={rid}>
                      <span className="dot" style={{ background: o.color }} />
                      <span className="rel-name">{o.first}</span>
                      <span className={`rel-tag ${v >= 25 ? "pos" : v < -10 ? "neg" : ""}`}>{relLabel(v)}</span>
                      <span className="rel-bar">
                        <span style={{ width: `${Math.abs(v) / 2}%`, left: v >= 0 ? "50%" : `${50 - Math.abs(v) / 2}%`, background: v >= 0 ? "#7fd1a8" : "#ff5d73" }} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {d.mem.length > 0 && (
            <div className="section">
              <h3>Minnen</h3>
              <ul className="mems">
                {d.mem.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <div className="section">
        <h3>Profil</h3>
        <p className="bio">{c.bio}</p>
        <p className="quirk">
          <span aria-hidden>✨</span> {c.quirkText}
        </p>
      </div>
      <div className="insp-actions">
        <button className={`btn ${following ? "btn-on" : ""}`} onClick={() => onFollow(c.id)}>
          {following ? "📍 Följer" : "📍 Följ"}
        </button>
      </div>
    </aside>
  );
}
