import { useEffect, useRef, useState } from "react";
import { store } from "../net.ts";
import { useNow, useStore } from "./hooks.ts";

const EXAMPLES = [
  "Gå till köket, hämta kaffe och fråga Emil om vi ska bygga om hela systemet i Rust",
  "Säg 'Nu är det fredagsfika!!' och börja dansa i loungen",
  "Gå till närmaste whiteboard och rita en helt obegriplig arkitekturskiss",
  "Säg: Vem har druckit upp all havremjölk?!",
  "Spring ut på balkongen och håll ett tal om tillgänglighet",
  "Starta ett kongatåg",
  "Krama Pedram och fråga hur han mår",
  "Smyg till serverrummet och viska 'hallå?'",
];

const QUICK: [string, string][] = [
  ["☕", "Hämta kaffe"],
  ["🪩", "Starta ett rave"],
  ["🚨", "Kalla till krismöte"],
  ["💃", "Starta ett kongatåg"],
  ["🌿", "Prata med Bengt"],
  ["🏛️", "Gå ut på Kungsbalkongen och håll ett tal"],
];

export function PromptBar({ onHelp }: { onHelp: () => void }) {
  const s = useStore();
  const now = useNow(500);
  const [text, setText] = useState("");
  const [example, setExample] = useState(0);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const me = s.me;

  useEffect(() => {
    const t = window.setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 6000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (s.lastAck) setPending(false);
  }, [s.lastAck?.at]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && document.activeElement === document.body) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!me) return null;
  const send = (t: string) => {
    const v = t.trim();
    if (!v || pending) return;
    store.send({ t: "prompt", text: v });
    setPending(true);
    setText("");
    window.setTimeout(() => setPending(false), 15000);
  };
  const ack = s.lastAck && now - s.lastAck.at < 7000 ? s.lastAck : null;
  const status =
    me.ctrl === "player"
      ? me.queue.length
        ? { icon: "🎮", text: "Följer din instruktion" }
        : { icon: "⏳", text: me.idleIn ? `Väntar på dig – autopiloten tar över om ${me.idleIn} s` : "Väntar på din nästa instruktion" }
      : me.ctrl === "scheme"
        ? { icon: "🎪", text: "Mitt i ett upptåg – skriv för att ta över" }
        : { icon: "🤖", text: "Autopilot – din konsult lever sitt eget liv" };

  return (
    <div className="promptbar">
      {(ack || pending) && (
        <div className={`ack ${ack && !ack.ok ? "ack-err" : ""}`} role="status">
          {pending && !ack ? (
            <span>💭 Din konsult funderar...</span>
          ) : (
            ack && (
              <>
                <span>
                  {ack.ok ? "✔" : "✖"} {ack.text}
                </span>
                {ack.via && <span className="via">via {ack.via}</span>}
              </>
            )
          )}
        </div>
      )}
      <div className="panel prompt-panel">
        <div className="prompt-status">
          <span className={`ctrl-badge ctrl-${me.ctrl}`}>
            {status.icon} {status.text}
          </span>
          {me.queue.length > 0 && (
            <span className="queue" aria-label="Handlingskö">
              {me.queue.slice(0, 5).map((q, i) => (
                <span key={i} className={`chip ${i === 0 ? "chip-now" : ""}`}>
                  {i === 0 ? "▶ " : ""}
                  {q}
                </span>
              ))}
              {me.queue.length > 5 && <span className="chip">+{me.queue.length - 5}</span>}
            </span>
          )}
          {me.ctrl !== "ai" && (
            <button className="btn btn-small" onClick={() => store.send({ t: "autopilot" })} title="Låt din konsult ta över själv">
              🤖 Autopilot
            </button>
          )}
        </div>
        <form
          className="prompt-form"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`T.ex. "${EXAMPLES[example]}"`}
            maxLength={300}
            aria-label="Instruktion till din konsult"
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Escape") (e.target as HTMLInputElement).blur();
            }}
          />
          <button className="btn btn-primary" type="submit" disabled={pending || !text.trim()}>
            Kör
          </button>
          <button type="button" className="icon-btn" onClick={onHelp} title="Tips och exempel" aria-label="Tips och exempel">
            ?
          </button>
        </form>
        <div className="quick">
          {QUICK.map(([icon, t]) => (
            <button key={t} className="chip chip-btn" onClick={() => send(t)} disabled={pending}>
              {icon} {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
