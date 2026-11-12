# SimVariant 🏢🍌

Ett delat, levande pixel-simspel som utspelar sig i realtid på Variants kontor – sekelskiftesvåningen på **Barnhusgatan 20** i Stockholm (byggd 1906). Alla som tittar ser samma värld. Konsulterna lever sina egna, ganska kaotiska liv, tills någon loggar in och styr sin egen karaktär med fri text.

## Starta

```bash
npm install && npm run dev
```

Öppna sedan <http://localhost:5173>. Kontoret syns direkt, utan inloggning.

**Logga in:** med din Variant-mejl (skiftlägesokänsligt) och standardlösenordet `BANAN`. Byt sedan lösenord via kontomenyn uppe till höger.

### Valfri LLM

Spelet är fullt spelbart utan API-nyckel, eftersom en inbyggd lokal motor tolkar svenska kommandon och genererar dialoger. Vill du ha LLM-tolkning av prompts och LLM-skrivna samtal och idéer kopierar du `.env.example` till `.env` (eller `.dev.vars`) och fyller i:

```bash
GOOGLE_API_KEY=...          # Google Gemini (standardmodell gemini-3.6-flash, ändra med GEMINI_MODEL)
# eller
ANTHROPIC_API_KEY=...       # Anthropic Claude (standardmodell claude-opus-5-5, ändra med ANTHROPIC_MODEL)
```

Om LLM:en svarar fel eller för långsamt faller spelet tillbaka på den lokala motorn. Vilken motor som används syns i hjälprutan (`?`).

### Deploy

```bash
npx wrangler secret put GOOGLE_API_KEY   # valfritt
npm run deploy
```

Allt körs på Cloudflare: Workers serverar React-klienten och API:t, och en Durable Object med inbyggd SQLite är själva kontoret.

## Vad finns i spelet

- **Planlösningen från planskissen**: entrén/kapprummet, passagen, pentryt/matsalen, serverrummet, RWC/WC, Kontor Norr, burspråkskontoret, storkontoret, stora och runda mötesrummet, loungen, samtalsrummet, Kungsbalkongen och trapphuset. Rummen rastreras från planskissens geometri (`src/shared/map.ts`) med väggar, dörröppningar, fönster och A*-pathfinding.
- **19 konsulter** från Stockholmskontoret, med utseende från CV-fotona och personlighet, intressen och egenheter från CV-texterna.
- **Behov och kaosmätare**: koffein, energi, fokus, socialt sug, inspiration, hunger och kaos styr en nyttobaserad AI med slumpinslag och jokerkort.
- **Upptåg**: debatter vid kaffemaskinen, kontorsrave, kongatåg, stolrace, synkroniserad pausgympa, krismöten vid whiteboarden, karaoke, guidad tur, mannequin challenge, koppgömning, CSS-kriser, dramatiska tupplurar, fika och all-hands.
- **Social smitta**: den som ser eller hör något kan kommentera, gå dit, haka på eller fly till ett tystare rum. Konsulterna för korta samtal med varandra.
- **Världshändelser**: kaffemaskinen går sönder (och får medvetande), strömavbrott, brandövning, Wi-Fi-kris, Figma nere, mystiska paket, väderomslag och löpsedlar.
- **Textstyrning**: "Gå till köket, hämta kaffe och fråga Emil om vi ska bygga om hela systemet i Rust" blir en handlingskö. När den är klar och du varit inaktiv i 25 sekunder tar autopiloten över igen.
- **Barnhusgatan Live**: en logg över allt som spårar ur, filtrerbar.
- **Easter eggs**: många. Klicka på saker. Läs konsolen. Prata med Bengt. Prova gamla koder.

## Arkitektur

```
src/shared/     karta (planskiss → rutnät), konsulter, protokoll
src/worker/     Cloudflare Worker + Durable Object "Office"
  office.ts       WebSockets, tick-loop (10 Hz), SQLite: users/sessions/kv/log
  auth.ts         PBKDF2-hashade lösenord, HttpOnly-sessionscookies
  sim/world.ts    simuleringskärnan: aktörer, handlingsköer, platser, smitta
  sim/brain.ts    behov, beslut, reaktioner, samtal
  sim/schemes.ts  flerpersonsupptåg
  sim/events.ts   världshändelser, tidsstyrda händelser, NPC:er, pokes
  sim/commands.ts svensk kommandotolk + LLM-tolkning + easter eggs
  sim/content.ts  innehållsbanken (repliker, idéer, debatter …)
  sim/llm.ts      Gemini/Claude via fetch
src/client/     Vite + React + Canvas
  game/           pixelrenderare, sprites, kamera, effekter
  ui/             toppfält, inspektör, live-logg, promptfält, modaler
```

Simuleringen är server-auktoritativ. Klienterna får ögonblicksbilder 10 gånger per sekund och interpolerar mjukt. Simuleringen fortsätter även när ingen tittar: ett Durable Object-larm håller kontoret vid liv, och kontoret simuleras ikapp efter en paus. Lösenord, sessioner, världsläge och logg sparas i Durable Objectens SQLite och överlever omstarter.

E-postadresserna finns bara på servern (`src/worker/accounts.ts`) och skickas aldrig till webbläsaren.
