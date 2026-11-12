import { useCallback, useEffect, useRef, useState } from "react";
import { logout } from "./api.ts";
import { GameView } from "./game/view.ts";
import { store } from "./net.ts";
import { music } from "./music.ts";
import { initSoundPref, playSound, setSoundEnabled } from "./sound.ts";
import { useStore } from "./ui/hooks.ts";
import { Inspector } from "./ui/Inspector.tsx";
import { LiveLog } from "./ui/LiveLog.tsx";
import { HelpModal, LoginModal, PasswordModal } from "./ui/Modals.tsx";
import { PromptBar } from "./ui/PromptBar.tsx";
import { TopBar } from "./ui/TopBar.tsx";

let connected = false;

interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}
let toastSeq = 1;

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

export function App() {
  const s = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<GameView | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "login" | "password" | "help">(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [logOpen, setLogOpen] = useState(() => window.innerWidth > 980);
  const [miniOpen, setMiniOpen] = useState(() => window.innerWidth > 700);
  const [sound, setSound] = useState(() => initSoundPref());
  const [names, setNames] = useState(false);
  const [musicOn, setMusicOn] = useState(() => music.isEnabled());
  const retro = useRef(false);
  const remindedFor = useRef<string | null>(null);

  const toast = useCallback((text: string, action?: Toast["action"], ms = 7000) => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-3), { id, text, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  // Anslut en gång (StrictMode kör effekter två gånger i dev)
  useEffect(() => {
    if (!connected) {
      connected = true;
      store.connect();
    }
  }, []);

  // Spelvyn
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const v = new GameView(canvas, {
      store,
      onSelect: (id) => setSelected(id),
      onPoke: (what) => store.send({ t: "poke", what }),
    });
    viewRef.current = v;
    if (miniRef.current) v.attachMinimap(miniRef.current);
    return () => {
      v.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (miniOpen && miniRef.current) viewRef.current?.attachMinimap(miniRef.current);
  }, [miniOpen]);
  useEffect(() => viewRef.current?.setSelected(selected), [selected]);
  useEffect(() => viewRef.current?.setMine(s.me?.id ?? null), [s.me?.id]);
  useEffect(() => viewRef.current?.setShowNames(names), [names]);

  // Synka följ-läget (kameran kan släppa följningen när man drar)
  useEffect(() => {
    const t = window.setInterval(() => {
      const f = viewRef.current?.getFollow() ?? null;
      setFollowing((cur) => (cur === f ? cur : f));
    }, 400);
    return () => window.clearInterval(t);
  }, []);

  // Delad bakgrundsmusik: följ serverns låtval
  const mus = s.world?.music;
  useEffect(() => {
    if (!mus) return;
    music.setServerOffset(store.serverOffset);
    music.setState(mus);
  }, [mus?.track, mus?.at]);
  // Webbläsare kräver en användargest innan ljud får starta
  useEffect(() => {
    const go = () => music.resumeIfEnabled();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);

  // Påminnelse om standardlösenordet
  useEffect(() => {
    const me = s.me;
    if (me?.mustChange && remindedFor.current !== me.id) {
      remindedFor.current = me.id;
      toast("Du är inloggad med standardlösenordet 🍌 – byt gärna till ett eget.", { label: "Byt nu", run: () => setModal("password") }, 12000);
    }
  }, [s.me?.id, s.me?.mustChange, toast]);

  // Tangentbord: Escape, konami-koden
  useEffect(() => {
    let seq: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") setSelected(null);
      seq = [...seq, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length);
      if (seq.join(",") === KONAMI.join(",")) {
        retro.current = !retro.current;
        viewRef.current?.setRetro(retro.current);
        playSound("tada");
        toast(retro.current ? "🕹️ RETRO-LÄGE AKTIVERAT. Välkommen till 1987." : "Tillbaka till nutiden.");
        seq = [];
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toast]);

  const follow = (id: string) => {
    const v = viewRef.current;
    if (!v) return;
    if (v.getFollow() === id) {
      v.setFollow(null);
      setFollowing(null);
    } else {
      v.setFollow(id);
      setFollowing(id);
    }
  };

  const focusChar = (id: string) => {
    setSelected(id);
    viewRef.current?.centerOn(id);
  };

  return (
    <div className="app">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Kontoret på Barnhusgatan 20 – levande pixelvy" />

      <TopBar
        onLogin={() => setModal("login")}
        onLogout={async () => {
          try {
            await logout();
          } finally {
            store.reconnect();
            toast("Du är utloggad. Din konsult lever vidare på egen hand.");
          }
        }}
        onPassword={() => setModal("password")}
        onHelp={() => setModal("help")}
        onFollowMine={() => s.me && follow(s.me.id)}
        followingMine={!!s.me && following === s.me.id}
        sound={sound}
        onSound={() => {
          setSoundEnabled(!sound);
          setSound(!sound);
          if (!sound) playSound("pop");
        }}
        names={names}
        onNames={() => setNames((n) => !n)}
        musicOn={musicOn}
        onMusic={() => {
          music.setServerOffset(store.serverOffset);
          if (s.world?.music) music.setState(s.world.music);
          music.setEnabled(!musicOn);
          setMusicOn(!musicOn);
        }}
      />

      {s.world?.banner && (
        <div className="banner" role="marquee" aria-live="polite">
          <span>📰 {s.world.banner} · 📰 {s.world.banner}</span>
        </div>
      )}

      {selected && <Inspector id={selected} onClose={() => setSelected(null)} onFollow={follow} following={following === selected} />}

      <LiveLog open={logOpen} onToggle={() => setLogOpen((o) => !o)} onFocus={focusChar} />

      <div className={`minimap-wrap panel ${miniOpen ? "" : "closed"}`}>
        <button className="mini-toggle" onClick={() => setMiniOpen((o) => !o)} aria-expanded={miniOpen}>
          🗺️ {miniOpen ? "Karta" : ""}
        </button>
        {miniOpen && <canvas ref={miniRef} className="minimap" width={96} height={200} aria-label="Minikarta över våningen" />}
      </div>

      {s.me ? (
        <PromptBar onHelp={() => setModal("help")} />
      ) : (
        <div className="guestbar panel">
          <span>👀 Du tittar som gäst. Logga in för att styra din egen konsult.</span>
          <button className="btn btn-primary btn-small" onClick={() => setModal("login")}>
            Logga in
          </button>
          <button
            className="btn btn-small"
            onClick={() => {
              store.send({ t: "doorbell" });
              playSound("bell");
            }}
            title="Ring på dörren till Barnhusgatan 20"
          >
            🔔 Ring på dörren
          </button>
        </div>
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast panel">
            <span>{t.text}</span>
            {t.action && (
              <button
                className="btn btn-small btn-primary"
                onClick={() => {
                  t.action!.run();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {modal === "login" && (
        <LoginModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            store.reconnect();
            toast("Välkommen in! Skriv en instruktion längst ner – eller låt autopiloten sköta det.");
          }}
        />
      )}
      {modal === "password" && (
        <PasswordModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            toast("Lösenordet är bytt. 🍌 är historia.");
          }}
        />
      )}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} llm={s.llm} />}
    </div>
  );
}
