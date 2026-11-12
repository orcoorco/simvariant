// Worker-ingång: /api/* går till den enda Durable Object-instansen (kontoret).
// Allt annat serveras som statiska filer (React-klienten) via Workers Static Assets.
import { Office, type Env } from "./office.ts";

export { Office };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const id = env.OFFICE.idFromName("barnhusgatan-20");
      return env.OFFICE.get(id).fetch(request);
    }
    return new Response("Hittades inte", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
