import { useEffect, useRef, useState, type ReactNode } from "react";
import { changePassword, login } from "../api.ts";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // onClose skapas på nytt vid varje omritning (livedata ~1/s) – håll den i en ref
  // så att effekterna nedan bara körs när modalen öppnas.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>("input") ?? ref.current?.querySelector<HTMLElement>("button");
    first?.focus();
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Stäng">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoginModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Logga in" onClose={onClose}>
      <p className="muted">Logga in med din Variant-mejl för att styra din egen konsult på Barnhusgatan.</p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          setBusy(true);
          try {
            await login(email, password);
            onDone();
          } catch (ex) {
            setErr((ex as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          E-post
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="fornamn.efternamn@variant.se" required />
        </label>
        <label>
          Lösenord
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {err && <div className="form-err">{err}</div>}
        <button className="btn btn-primary btn-wide" disabled={busy}>
          {busy ? "Loggar in..." : "Logga in"}
        </button>
        <p className="muted small">Första gången? Lösenordet har du fått av en kollega. Det är gult och böjt.</p>
      </form>
    </Modal>
  );
}

export function PasswordModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Byt lösenord" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          if (next !== repeat) return setErr("De nya lösenorden matchar inte.");
          if (next.length < 6) return setErr("Minst 6 tecken, tack.");
          setBusy(true);
          try {
            await changePassword(current, next);
            onDone();
          } catch (ex) {
            setErr((ex as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nuvarande lösenord
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label>
          Nytt lösenord
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} />
        </label>
        <label>
          Upprepa nytt lösenord
          <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required minLength={6} />
        </label>
        {err && <div className="form-err">{err}</div>}
        <button className="btn btn-primary btn-wide" disabled={busy}>
          {busy ? "Sparar..." : "Spara nytt lösenord"}
        </button>
      </form>
    </Modal>
  );
}

export function HelpModal({ onClose, llm }: { onClose: () => void; llm: string }) {
  return (
    <Modal title="Så funkar SimVariant" onClose={onClose}>
      <div className="help">
        <p>
          Det här är Variants kontor på <strong>Barnhusgatan 20</strong>, live. Alla som tittar ser samma värld. Konsulterna lever sina egna liv – tills någon loggar in och tar
          över.
        </p>
        <h3>Titta</h3>
        <ul>
          <li>Dra för att panorera, scrolla eller nyp för att zooma.</li>
          <li>Klicka på en konsult för att se humör, behov, tankar och relationer.</li>
          <li>Klicka på saker. Allt är inte vad det ser ut att vara.</li>
        </ul>
        <h3>Styr din konsult</h3>
        <ul>
          <li>"Gå till köket, hämta kaffe och fråga Emil om vi ska bygga om allt i Rust"</li>
          <li>"Säg 'Nu är det fredagsfika!!' och börja dansa i loungen"</li>
          <li>"Gå till närmaste whiteboard och rita en obegriplig arkitekturskiss"</li>
          <li>"Starta ett rave / kongatåg / stolrace / krismöte / karaoke / pausgympa"</li>
          <li>"Krama Sara D", "Göm Staffans kopp", "Prata med Bengt", "Smyg till serverrummet"</li>
          <li>"Byt musik", "Spela jazz", "Sätt på något lugnt", "Stäng av musiken" – jukeboxen står i loungen</li>
        </ul>
        <h3>Musik</h3>
        <p className="muted">Musiken är delad – alla hör samma låt (slå på den med 🔇/🔊 uppe i mitten). Konsulterna har olika musiksmak och byter gärna låt. Ibland blir det musikkrig.</p>
        <p className="muted">När din instruktion är klar och du varit inaktiv i 25 sekunder tar autopiloten över igen.</p>
        <h3>Hemligheter</h3>
        <p className="muted">
          Det finns gott om easter eggs. Några tips: kaffemaskinen har känslor. Strindberg bodde runt hörnet. Spöken gillar kakelugnar. Och tangentbordet minns gamla koder.
        </p>
        <p className="muted small">AI-motor: {llm}</p>
      </div>
    </Modal>
  );
}
