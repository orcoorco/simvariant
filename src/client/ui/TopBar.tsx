import { useEffect, useRef, useState } from "react";
import { CONSULTANTS } from "../../shared/consultants.ts";
import { useStore } from "./hooks.ts";
import { Portrait } from "./Portrait.tsx";

const WEATHER: Record<string, string> = { sol: "☀️", moln: "☁️", regn: "🌧️", sno: "❄️" };

interface Props {
  onLogin: () => void;
  onLogout: () => void;
  onPassword: () => void;
  onHelp: () => void;
  onFollowMine: () => void;
  followingMine: boolean;
  sound: boolean;
  onSound: () => void;
  names: boolean;
  onNames: () => void;
}

export function TopBar(p: Props) {
  const s = useStore();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);
  const w = s.world;
  const online = [...s.details.values()].filter((d) => d.online).length;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">
          Sim<span>Variant</span>
        </span>
        <span className="addr">Barnhusgatan 20 · sedan 1906</span>
      </div>
      <div className="world-info">
        {w && (
          <>
            <span className="pill" title={`${w.weekday} – Stockholmstid`}>
              🕰️ {w.clock}
            </span>
            <span className="pill" title="Vädret över Norra Bantorget">
              {WEATHER[w.weather] ?? "☁️"}
            </span>
            <span className="pill" title="Konsulter på plats">
              👥 {CONSULTANTS.length} på plats{online ? ` · ${online} inloggade` : ""}
            </span>
            <span className="pill hide-sm" title="Personer som tittar just nu">
              👀 {s.viewers}
            </span>
            <span className="pill hide-md" title="Koppar kaffe sedan start">
              ☕ {w.stats.kaffe}
            </span>
            {w.special && <span className="pill pill-special">🎪 {w.special}</span>}
          </>
        )}
        {!s.connected && <span className="pill pill-warn">Ansluter…</span>}
      </div>
      <div className="actions">
        <button className={`icon-btn ${p.sound ? "on" : ""}`} onClick={p.onSound} title={p.sound ? "Stäng av ljud" : "Slå på ljud"} aria-label="Ljud">
          {p.sound ? "🔊" : "🔈"}
        </button>
        <button className={`icon-btn ${p.names ? "on" : ""}`} onClick={p.onNames} title="Visa alla namn" aria-label="Visa alla namn">
          🏷️
        </button>
        <button className="icon-btn" onClick={p.onHelp} title="Hjälp" aria-label="Hjälp">
          ?
        </button>
        {s.me ? (
          <div className="me" ref={menuRef}>
            <button className={`btn btn-small ${p.followingMine ? "btn-on" : ""}`} onClick={p.onFollowMine} title="Följ min karaktär">
              📍 <span className="hide-sm">Följ mig</span>
            </button>
            <button className="me-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
              <Portrait id={s.me.id} size={24} />
              <span className="hide-sm">Inloggad som {s.me.name}</span>
              <span aria-hidden>▾</span>
            </button>
            {menu && (
              <div className="panel menu" role="menu">
                <button role="menuitem" onClick={() => (setMenu(false), p.onPassword())}>
                  🔑 Byt lösenord
                </button>
                <button role="menuitem" onClick={() => (setMenu(false), p.onLogout())}>
                  🚪 Logga ut
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-primary" onClick={p.onLogin}>
            Logga in
          </button>
        )}
      </div>
    </header>
  );
}
