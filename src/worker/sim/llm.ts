// Valfri LLM-koppling. Utan nyckel används den lokala motorn helt.
//   GOOGLE_API_KEY (+ GEMINI_MODEL)        → Google Gemini
//   ANTHROPIC_API_KEY (+ ANTHROPIC_MODEL)  → Anthropic Claude
//   LLM_PROVIDER = google | anthropic | none  (valfritt, om båda finns)

export interface LlmEnv {
  GOOGLE_API_KEY?: string;
  GEMINI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  LLM_PROVIDER?: string;
}

export interface LlmClient {
  label: string;
  json<T>(system: string, user: string, opts?: { maxTokens?: number; timeoutMs?: number }): Promise<T | null>;
}

function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    /* fortsätt */
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* fortsätt */
    }
  }
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(t.slice(a, b + 1));
    } catch {
      return null;
    }
  }
  return null;
}

async function withTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function gemini(key: string, model: string): LlmClient {
  return {
    label: `Gemini (${model})`,
    async json<T>(system: string, user: string, opts: { maxTokens?: number; timeoutMs?: number } = {}) {
      try {
        const res = await withTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: user }] }],
              generationConfig: { responseMimeType: "application/json", maxOutputTokens: opts.maxTokens ?? 2048 },
            }),
          },
          opts.timeoutMs ?? 12000,
        );
        if (!res.ok) {
          console.warn("Gemini", res.status, (await res.text()).slice(0, 300));
          return null;
        }
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
        const text = (data.candidates?.[0]?.content?.parts ?? [])
          .filter((p) => !p.thought && p.text)
          .map((p) => p.text)
          .join("");
        return (extractJson(text) as T) ?? null;
      } catch (err) {
        console.warn("Gemini-fel", err);
        return null;
      }
    },
  };
}

function anthropic(key: string, model: string): LlmClient {
  return {
    label: `Claude (${model})`,
    async json<T>(system: string, user: string, opts: { maxTokens?: number; timeoutMs?: number } = {}) {
      try {
        const res = await withTimeout(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": key,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: opts.maxTokens ?? 1500,
              system: `${system}\n\nSvara ENDAST med ett giltigt JSON-objekt, utan någon annan text.`,
              messages: [{ role: "user", content: user }],
            }),
          },
          opts.timeoutMs ?? 15000,
        );
        if (!res.ok) {
          console.warn("Claude", res.status, (await res.text()).slice(0, 300));
          return null;
        }
        const data = (await res.json()) as { content?: { type: string; text?: string }[] };
        const text = (data.content ?? [])
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("");
        return (extractJson(text) as T) ?? null;
      } catch (err) {
        console.warn("Claude-fel", err);
        return null;
      }
    },
  };
}

export function makeLlm(env: LlmEnv): LlmClient | null {
  const pref = (env.LLM_PROVIDER ?? "").trim().toLowerCase();
  if (pref === "none" || pref === "local" || pref === "lokal") return null;
  const g = env.GOOGLE_API_KEY?.trim();
  const a = env.ANTHROPIC_API_KEY?.trim();
  const gModel = env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const aModel = env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";
  if (pref === "anthropic" && a) return anthropic(a, aModel);
  if (pref === "google" && g) return gemini(g, gModel);
  if (g) return gemini(g, gModel);
  if (a) return anthropic(a, aModel);
  return null;
}
