import { useEffect, useRef } from "react";
import { renderPortrait } from "../game/view.ts";

/** Pixelporträtt av en konsult eller NPC (ritas av spelmotorns sprite-generator). */
export function Portrait({ id, size, className }: { id: string; size: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    try {
      const c = renderPortrait(id, size);
      c.style.width = `${size}px`;
      c.style.height = `${size}px`;
      c.style.imageRendering = "pixelated";
      el.appendChild(c);
    } catch {
      el.textContent = "?";
    }
  }, [id, size]);
  return <div ref={ref} className={`portrait ${className ?? ""}`} style={{ width: size, height: size }} aria-hidden="true" />;
}
