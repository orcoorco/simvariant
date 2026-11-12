// Konsulterna på Variants Stockholmskontor (Barnhusgatan 20).
// Underlag: konsultdokumentet (roller, profiler) + variant.se/se/varianter (kontor Stockholm).
// OBS: e-postadresser ligger INTE här (den här filen skickas till webbläsaren) –
// de finns bara på servern i src/worker/accounts.ts.

export type HairStyle =
  | "bald"
  | "buzz"
  | "short"
  | "side"
  | "pixie"
  | "bob"
  | "shoulder"
  | "long"
  | "wavy"
  | "curly";

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  beard?: "stubble" | "short" | "full";
  beardColor?: string;
  glasses?: string; // bågfärg
  glassesStyle?: "round" | "square";
  cap?: string;
  top: string;
  topStyle: "tshirt" | "shirt" | "blazer" | "sweater" | "blouse" | "jacket";
  inner?: string; // färg/mönster under kavaj ("zebra" = zebramönster)
  pants: string;
  shoes: string;
  lips?: string;
  earrings?: string;
}

export interface Traits {
  kaos: number; // benägenhet för vilda infall 0–1
  social: number; // dras till folk
  fokus: number; // förmåga att sitta still och jobba
  nyfiken: number; // går och tittar när något händer
  drama: number; // stora gester, högljudd
  smyg: number; // busar i smyg
  energi: number; // grundtempo
}

export interface Consultant {
  id: string;
  name: string;
  first: string;
  title: string;
  fields: string[];
  bio: string;
  look: Look;
  traits: Traits;
  interests: string[]; // ämnesnycklar i innehållsbanken
  catch: string[]; // signaturrepliker
  work: string[]; // vad personen gör vid skrivbordet
  quirk: string; // id för personlig specialhandling
  quirkText: string;
  desk: [number, number] | null; // fast plats (kontorsstol), null = flexar
  color: string; // namnskyltens accentfärg
}

const SKIN_LIGHT = "#f2d0b4";
const SKIN_FAIR = "#f6dcc6";
const SKIN_WARM = "#e9bf9c";
const SKIN_TAN = "#c98f63";
const SKIN_BROWN = "#9c6844";

export const CONSULTANTS: Consultant[] = [
  {
    id: "alexander",
    name: "Alexander Klimberg",
    first: "Alexander",
    title: "Senior UX Designer",
    fields: ["Design"],
    bio: "Mångsidig UX-designer som gör komplexa system intuitiva. Lever för användarresearch, workshops och design sprints.",
    look: { skin: SKIN_FAIR, hair: "#a07a4f", hairStyle: "side", top: "#a9d8bf", topStyle: "shirt", pants: "#3b4252", shoes: "#2b2b2b" },
    traits: { kaos: 0.45, social: 0.75, fokus: 0.55, nyfiken: 0.8, drama: 0.5, smyg: 0.3, energi: 0.7 },
    interests: ["workshop", "research", "postits", "ai", "figma"],
    catch: [
      "Ska vi köra en snabb workshop på det?",
      "Har vi pratat med användarna om det här?",
      "Jag hämtar post-its. Många post-its.",
      "Det här skriker design sprint.",
    ],
    work: ["Faciliterar en workshop med sig själv", "Klustrar post-its i Miro", "Prototypar i Figma", "Skriver intervjuguide"],
    quirk: "workshop",
    quirkText: "Gör om allt till en workshop – även lunchvalet.",
    desk: [23, 30],
    color: "#7fd1a8",
  },
  {
    id: "david",
    name: "David Dinka",
    first: "David",
    title: "Strategic Advisor",
    fields: ["Ledning", "Design", "Strategi"],
    bio: "Senior rådgivare och transformationsledare med 20+ år av strategisk förändring och organisationsutveckling.",
    look: { skin: SKIN_LIGHT, hair: "#d9b9a0", hairStyle: "bald", glasses: "#1b1b1b", glassesStyle: "square", top: "#1f1f24", topStyle: "shirt", pants: "#22252b", shoes: "#111" },
    traits: { kaos: 0.4, social: 0.7, fokus: 0.6, nyfiken: 0.6, drama: 0.7, smyg: 0.2, energi: 0.55 },
    interests: ["strategi", "forandring", "ai", "ledarskap"],
    catch: [
      "Det här är egentligen en förändringsledningsfråga.",
      "Vi behöver en målbild för kaffet.",
      "Låt oss zooma ut. Längre. Ännu längre.",
      "Kultur äter strategi till frukost. Och kanelbullar till fika.",
    ],
    work: ["Ritar en transformationsresa", "Skriver ett strategidokument på 3 sidor", "Coachar en ledningsgrupp via Teams"],
    quirk: "transform",
    quirkText: "Gör varje liten sak till en transformationsresa i tre faser.",
    desk: null,
    color: "#c9b8ff",
  },
  {
    id: "ellen",
    name: "Ellen Cárdenas",
    first: "Ellen",
    title: "UX Designer / UX Lead",
    fields: ["Design"],
    bio: "Senior UX Lead med 20+ år inom medtech, life science och SaaS – där användbarhet, säkerhet och precision är allt.",
    look: { skin: SKIN_FAIR, hair: "#c8693a", hairStyle: "long", top: "#e8692a", topStyle: "blouse", pants: "#2f3440", shoes: "#5a3222", earrings: "#e7c46a" },
    traits: { kaos: 0.3, social: 0.6, fokus: 0.85, nyfiken: 0.6, drama: 0.4, smyg: 0.25, energi: 0.6 },
    interests: ["medtech", "research", "personas", "tjanstedesign"],
    catch: [
      "Vad är worst case om vi flyttar soffan?",
      "Har vi en riskanalys för det här?",
      "Det där behöver valideras. Med riktiga användare.",
    ],
    work: ["Gör en riskanalys av kaffemaskinen", "Kartlägger en kundresa", "Uppdaterar personas", "Granskar ett verksamhetssystem"],
    quirk: "riskanalys",
    quirkText: "Gör riskanalyser på allt, även på fikat.",
    desk: [26, 16],
    color: "#ff9a62",
  },
  {
    id: "emil",
    name: "Emil Scott",
    first: "Emil",
    title: "Senior UX Designer",
    fields: ["Design"],
    bio: "Strategisk produktdesigner som ser helheten och hittar nya AI-användningar och lösningar som annars faller bort.",
    look: { skin: SKIN_LIGHT, hair: "#3a2a20", hairStyle: "buzz", beard: "short", beardColor: "#3a2a20", top: "#202227", topStyle: "shirt", pants: "#2b2f37", shoes: "#151515" },
    traits: { kaos: 0.6, social: 0.6, fokus: 0.6, nyfiken: 0.75, drama: 0.5, smyg: 0.35, energi: 0.7 },
    interests: ["ai", "produktstrategi", "designsystem", "figma"],
    catch: [
      "We could totally solve this with an AI agent.",
      "Vad om diskmaskinen hade en LLM?",
      "Let's think big picture here.",
      "Jag promptade fram en ny lunchrutin.",
    ],
    work: ["Bygger en AI-prototyp", "Skriver en produktstrategi på engelska", "Promptar en agent att göra hans standup"],
    quirk: "ai_hype",
    quirkText: "Föreslår en AI-agent för allt. Glider ibland över till engelska.",
    desk: [23, 33],
    color: "#7fb7ff",
  },
  {
    id: "jacqline",
    name: "Jacqline Runsten",
    first: "Jacqline",
    title: "UX/UI Designer",
    fields: ["Design"],
    bio: "Noggrann och resultatdriven designer med stor nyfikenhet som ständigt lär sig nya färdigheter.",
    look: { skin: SKIN_FAIR, hair: "#e6c77e", hairStyle: "long", top: "#3d4b3f", topStyle: "jacket", pants: "#22262e", shoes: "#3a2b22" },
    traits: { kaos: 0.55, social: 0.65, fokus: 0.7, nyfiken: 0.95, drama: 0.45, smyg: 0.3, energi: 0.8 },
    interests: ["larande", "ui", "research", "hobby"],
    catch: [
      "Jag lärde mig precis något nytt!",
      "Vänta, jag ska bara pixelputsa lite.",
      "Har ni testat att jonglera med post-its?",
    ],
    work: ["Pixelputsar en knapp", "Gör en tillgänglighetsgranskning", "Går en onlinekurs i något helt nytt", "Testar en ny designmetod"],
    quirk: "hobby",
    quirkText: "Plockar upp en ny hobby varje timme – jonglering, origami, beatbox.",
    desk: [23, 39],
    color: "#ffd86b",
  },
  {
    id: "jessica",
    name: "Jessica Wiklund",
    first: "Jessica",
    title: "UX Designer / UX Lead",
    fields: ["Design", "Strategi"],
    bio: "Senior UX-designer, särskilt stark inom designsystem, tillgänglighet och researchdriven produktutveckling.",
    look: { skin: SKIN_FAIR, hair: "#b49a83", hairStyle: "wavy", glasses: "#151515", glassesStyle: "round", top: "#1c1c22", topStyle: "blouse", pants: "#2a2d36", shoes: "#141414" },
    traits: { kaos: 0.35, social: 0.6, fokus: 0.8, nyfiken: 0.6, drama: 0.4, smyg: 0.3, energi: 0.6 },
    interests: ["tillganglighet", "designsystem", "research", "ux"],
    catch: [
      "Den där skylten klarar inte WCAG AA.",
      "Har den här knappen en fokusmarkering?",
      "Kontrasten på kaffet är för låg.",
    ],
    work: ["Bygger komponenter i designsystemet", "Kör en tillgänglighetsrevision", "Testar med skärmläsare", "Skriver guiding principles"],
    quirk: "kontrast",
    quirkText: "Mäter kontrastförhållanden på allt – kaffe, växter, kollegor.",
    desk: [24, 3],
    color: "#9fe0e0",
  },
  {
    id: "johanna",
    name: "Johanna Granström",
    first: "Johanna",
    title: "UX Designer",
    fields: ["Design"],
    bio: "Nyfiken och driven UX- och tjänstedesigner – från insiktsdriven innovation på globala produktbolag till komplexa myndigheter.",
    look: { skin: SKIN_FAIR, hair: "#2d2421", hairStyle: "pixie", top: "#33415a", topStyle: "shirt", pants: "#22252c", shoes: "#2a2a2a" },
    traits: { kaos: 0.5, social: 0.6, fokus: 0.7, nyfiken: 0.85, drama: 0.4, smyg: 0.45, energi: 0.7 },
    interests: ["tjanstedesign", "research", "myndighet", "hotjar"],
    catch: [
      "Vi borde kartlägga kundresan för det här.",
      "Jag har satt upp en heatmap över pentryt.",
      "Vad är det egentliga behovet här?",
    ],
    work: ["Kartlägger en kundresa", "Analyserar heatmaps i Hotjar", "Ritar en tjänstekarta", "Förbereder användartester"],
    quirk: "kundresa",
    quirkText: "Kartlägger kundresan för allt – även toalettbesöket.",
    desk: [28, 36],
    color: "#a0c4ff",
  },
  {
    id: "karolina",
    name: "Karolina Pamp",
    first: "Karolina",
    title: "Senior projektledare & innovationsledare",
    fields: ["Produkt- och projektledning"],
    bio: "Innovationsstrateg och omvärldsanalytiker som samlar offentlig sektor, näringsliv och akademi kring gemensamma mål.",
    look: { skin: SKIN_WARM, hair: "#151214", hairStyle: "long", top: "#1f2a4d", topStyle: "blouse", pants: "#1d2130", shoes: "#141414" },
    traits: { kaos: 0.4, social: 0.75, fokus: 0.65, nyfiken: 0.8, drama: 0.45, smyg: 0.25, energi: 0.65 },
    interests: ["omvarld", "innovation", "projekt", "framtid"],
    catch: [
      "Jag ser en tydlig trend här.",
      "Vilka aktörer behöver vi få med oss?",
      "Enligt min omvärldsanalys tar havremjölken slut på tisdagar.",
    ],
    work: ["Gör en omvärldsanalys", "Bygger en Gantt-plan för fikat", "Samlar aktörer kring ett vägval", "Skriver en innovationsstrategi"],
    quirk: "trend",
    quirkText: "Spår framtida trender i allt som händer på kontoret.",
    desk: null,
    color: "#ff9fd0",
  },
  {
    id: "linn",
    name: "Linn Norberg",
    first: "Linn",
    title: "Service/UX Designer & designledare",
    fields: ["Design"],
    bio: "CX/UX-designer och designledare från vård, fintech, försäkring och industri – ofta i organisationer på transformationsresa.",
    look: { skin: SKIN_FAIR, hair: "#e2c48e", hairStyle: "long", glasses: "#4a3b33", glassesStyle: "round", top: "#6d6f73", topStyle: "sweater", pants: "#2b2e36", shoes: "#2a2a2a" },
    traits: { kaos: 0.5, social: 0.65, fokus: 0.7, nyfiken: 0.75, drama: 0.45, smyg: 0.3, energi: 0.65 },
    interests: ["vr", "upplevelse", "vard", "designledning"],
    catch: [
      "Vilka upplevelseprinciper styr det här?",
      "I VR skulle det här vara mycket tydligare.",
      "Vi måste designa för hela upplevelsen.",
    ],
    work: ["Testar en VR-prototyp", "Formulerar upplevelseprinciper", "Leder en designreview", "Skriver en innehållsstrategi"],
    quirk: "vr",
    quirkText: "Går runt med VR-glasögon och krockar ibland med kakelugnen.",
    desk: [29, 16],
    color: "#b3e88f",
  },
  {
    id: "liza",
    name: "Liza Hansson",
    first: "Liza",
    title: "Digital transformation, ledare & designstrateg",
    fields: ["Ledning", "Design", "Produkt- och projektledning", "Strategi"],
    bio: "20+ år som designer – product designer, design lead och designchef – som ser till att design levererar maximalt värde.",
    look: { skin: SKIN_FAIR, hair: "#b8916a", hairStyle: "long", glasses: "#d57a8f", glassesStyle: "round", top: "#18181d", topStyle: "blouse", pants: "#25272e", shoes: "#141414" },
    traits: { kaos: 0.45, social: 0.8, fokus: 0.65, nyfiken: 0.6, drama: 0.65, smyg: 0.25, energi: 0.7 },
    interests: ["ledarskap", "designledning", "excel", "strategi"],
    catch: [
      "Vi tar det här i en Powerpoint.",
      "Okej team, samling om två minuter!",
      "Jag har gjort ett Excelark över det.",
    ],
    work: ["Bygger en Powerpoint", "Coachar en designchef", "Gör ett Excelark över allt", "Planerar en designorganisation"],
    quirk: "allhands",
    quirkText: "Kallar till spontana all-hands – även när bara två personer är på plats.",
    desk: [29, 21],
    color: "#ffb3c1",
  },
  {
    id: "lotta",
    name: "Lotta Gerdt",
    first: "Lotta",
    title: "Senior UX Designer & designledare",
    fields: ["Ledning", "Design"],
    bio: "Passionerad UX-designer i skärningspunkten mellan affärsmål, tekniska möjligheter och användarbehov.",
    look: { skin: SKIN_FAIR, hair: "#efe3c8", hairStyle: "shoulder", top: "#16161a", topStyle: "blouse", pants: "#23252c", shoes: "#141414" },
    traits: { kaos: 0.5, social: 0.7, fokus: 0.7, nyfiken: 0.7, drama: 0.5, smyg: 0.3, energi: 0.75 },
    interests: ["helhet", "tillganglighet", "idegenerering", "strategi"],
    catch: [
      "Vi måste se helheten här.",
      "Kan vi ta det här mötet gående?",
      "Jag har tre idéer. Nej, fyra.",
    ],
    work: ["Leder en idégenerering", "Skriver en UX-strategi", "Kollar WCAG-krav", "Planerar en roadmap"],
    quirk: "walkmeeting",
    quirkText: "Tar alla möten gående – i cirklar genom hela våningen.",
    desk: [26, 21],
    color: "#f5e6a8",
  },
  {
    id: "mathias",
    name: "Mathias Jarboh",
    first: "Mathias",
    title: "UX/UI Designer",
    fields: ["Design"],
    bio: "Mångsidig UX/UI-designer från telekom, medtech, streaming och fastighet – stark förespråkare för tillgänglighet.",
    look: { skin: SKIN_BROWN, hair: "#1b1512", hairStyle: "buzz", top: "#8f9ad6", topStyle: "shirt", pants: "#2a2d36", shoes: "#1a1a1a" },
    traits: { kaos: 0.55, social: 0.65, fokus: 0.65, nyfiken: 0.7, drama: 0.6, smyg: 0.35, energi: 0.65 },
    interests: ["streaming", "fastighet", "tillganglighet", "telekom"],
    catch: [
      "Förra avsnittet av Barnhusgatan slutade med en cliffhanger.",
      "Den här kakelugnen höjer kvadratmeterpriset.",
      "Har vi testat det här med riktiga användare?",
    ],
    work: ["Designar en streamingtjänst", "Gör användbarhetstester", "Ritar tjänstekartor", "Kollar WCAG-kontraster"],
    quirk: "streaming",
    quirkText: "Berättar om kontoret som om det vore en Netflix-serie – med förtexter.",
    desk: [24, 8],
    color: "#a8b4ff",
  },
  {
    id: "mattias",
    name: "Mattias Hallberg",
    first: "Mattias",
    title: "UX Designer & tjänstedesigner",
    fields: ["Design"],
    bio: "Erfaren tjänstedesigner och projektledare – metodisk från research till implementering, van att leda workshops nära utvecklare.",
    look: { skin: SKIN_FAIR, hair: "#c9a68a", hairStyle: "bald", beard: "short", beardColor: "#9c6a45", top: "#dfe9f3", topStyle: "shirt", pants: "#2f3542", shoes: "#3a2b22" },
    traits: { kaos: 0.55, social: 0.7, fokus: 0.7, nyfiken: 0.75, drama: 0.5, smyg: 0.4, energi: 0.65 },
    interests: ["abtest", "seo", "tjanstedesign", "episerver"],
    catch: [
      "Vi A/B-testar det!",
      "Barnhusgatan kaffe bästa kaffe Stockholm. Bra för SEO.",
      "Ibland känns det som att någon har programmerat mig...",
    ],
    work: ["A/B-testar två kaffekoppar", "Konverteringsoptimerar en landningssida", "Leder en workshop", "Kartlägger en digifysisk tjänst"],
    quirk: "abtest",
    quirkText: "A/B-testar allt. Misstänker att han lever i ett spel.",
    desk: [28, 30],
    color: "#ffc58a",
  },
  {
    id: "pedram",
    name: "Pedram Nayeri",
    first: "Pedram",
    title: "UX Designer",
    fields: ["Design"],
    bio: "Vill förbättra världen och göra teknik roligare. Passion för psykologi, alltid positiv och samlar teamet kring ett mål.",
    look: { skin: SKIN_TAN, hair: "#1d1612", hairStyle: "short", beard: "short", beardColor: "#1d1612", glasses: "#8a6a3b", glassesStyle: "round", top: "#2f6bd8", topStyle: "tshirt", pants: "#2a2d36", shoes: "#f0f0f0" },
    traits: { kaos: 0.6, social: 0.9, fokus: 0.6, nyfiken: 0.75, drama: 0.6, smyg: 0.35, energi: 0.85 },
    interests: ["psykologi", "positivitet", "designsystem", "ai"],
    catch: [
      "Det här kommer bli SÅ bra!",
      "Psykologiskt sett är det här fascinerande.",
      "High five! Nej, högre!",
    ],
    work: ["Prototypar med AI", "Kör ett användartest", "Bygger design tokens", "Skriver ett psykologiexperiment"],
    quirk: "psykologi",
    quirkText: "Gör små psykologiexperiment på kollegorna. Alltid positiv.",
    desk: [28, 33],
    color: "#8fd3ff",
  },
  {
    id: "rhoda",
    name: "Rhoda Carlsson",
    first: "Rhoda",
    title: "UX/UI Designer",
    fields: ["Design"],
    bio: "UX/UI-designer med bakgrund som systemutvecklare – djup teknisk förståelse kombinerad med stark designkompetens.",
    look: { skin: SKIN_TAN, hair: "#120f10", hairStyle: "curly", top: "#2e4fa8", topStyle: "sweater", pants: "#2a2d36", shoes: "#1a1a1a" },
    traits: { kaos: 0.6, social: 0.6, fokus: 0.8, nyfiken: 0.7, drama: 0.5, smyg: 0.5, energi: 0.7 },
    interests: ["kod", "atomic", "designsystem", "rust"],
    catch: [
      "Jag kan bara fixa det i koden.",
      "Det här är egentligen en atom, inte en molekyl.",
      "Vem har deployat till produktion på en fredag?",
    ],
    work: ["Refaktorerar kaffemaskinens firmware", "Bygger komponenter enligt Atomic Design", "Kodar i smyg", "Gör en designreview"],
    quirk: "kodar",
    quirkText: "Kodar i smyg. Har en gång refaktorerat kaffemaskinen.",
    desk: [27, 3],
    color: "#d0a8ff",
  },
  {
    id: "sara_d",
    name: "Sara Doltz",
    first: "Sara D",
    title: "Interimschef & CMO",
    fields: ["Ledning", "Strategi"],
    bio: "Interimschef och senior rådgivare med kommunikation i fokus – journalist, chefredaktör och CMO.",
    look: { skin: SKIN_FAIR, hair: "#e9cf86", hairStyle: "shoulder", top: "#8d9196", topStyle: "blazer", inner: "zebra", pants: "#22252c", shoes: "#141414" },
    traits: { kaos: 0.55, social: 0.85, fokus: 0.6, nyfiken: 0.9, drama: 0.7, smyg: 0.3, energi: 0.75 },
    interests: ["nyheter", "varumarke", "kommunikation", "sociala"],
    catch: [
      "JUST NU: Det här blir en rubrik.",
      "Vad är vinkeln på den här storyn?",
      "Jag har en scoop från pentryt.",
    ],
    work: ["Skriver en pressrelease", "Planerar en kommunikationsstrategi", "Redigerar en krönika", "Bygger en varumärkesplattform"],
    quirk: "nyheter",
    quirkText: "Skriver löpsedlar om allt som händer på kontoret.",
    desk: null,
    color: "#ffe08a",
  },
  {
    id: "sara_h",
    name: "Sara Hernandez",
    first: "Sara H",
    title: "Digital strateg & copy",
    fields: ["Ledning", "Produkt- och projektledning", "Strategi"],
    bio: "Digital generalist med 15+ år av utveckling, kommunikation och strategi – från kodning till copywriting och tone of voice.",
    look: { skin: SKIN_FAIR, hair: "#141114", hairStyle: "bob", top: "#17171c", topStyle: "blouse", inner: "#c8202f", pants: "#22252c", shoes: "#141414", lips: "#c8202f", earrings: "#e5e5e5" },
    traits: { kaos: 0.5, social: 0.75, fokus: 0.7, nyfiken: 0.7, drama: 0.6, smyg: 0.35, energi: 0.7 },
    interests: ["copy", "toneofvoice", "seo", "ai"],
    catch: [
      "Det där kan vi säga snyggare.",
      "Vilken tone of voice är vi ute efter?",
      "Ordet du letar efter är 'synergi'. Nej, skämtar bara.",
    ],
    work: ["Skriver om en knapptext 14 gånger", "Tar fram tone of voice", "Skriver UX-copy", "Gör en innehållsstrategi"],
    quirk: "copy",
    quirkText: "Skriver om allas meningar till bättre tone of voice.",
    desk: [28, 39],
    color: "#ff8a8a",
  },
  {
    id: "sofia",
    name: "Sofia Fröjdman",
    first: "Sofia",
    title: "UX-strateg",
    fields: ["Design"],
    bio: "UX-designer som inspireras av de stora utmaningarna – research, strategi, innovation och kreativ problemlösning.",
    look: { skin: SKIN_FAIR, hair: "#e3c27a", hairStyle: "long", top: "#2f6e57", topStyle: "blazer", inner: "#f2efe9", pants: "#22252c", shoes: "#2a2a2a" },
    traits: { kaos: 0.45, social: 0.7, fokus: 0.7, nyfiken: 0.85, drama: 0.45, smyg: 0.3, energi: 0.7 },
    interests: ["research", "enkat", "heuristik", "innovation"],
    catch: [
      "På en skala från 1 till 7 – hur nöjd är du med det här ögonblicket?",
      "Det här är ett tydligt mönster i datan.",
      "Kvalitativt OCH kvantitativt, tack.",
    ],
    work: ["Gör en heuristisk utvärdering", "Analyserar en enkät", "Leder en design sprint", "Syntetiserar intervjuer"],
    quirk: "enkat",
    quirkText: "Skickar enkäter till alla, även krukväxterna.",
    desk: [23, 36],
    color: "#7fe0b8",
  },
  {
    id: "staffan",
    name: "Staffan Hesselbom",
    first: "Staffan",
    title: "Senior UX Designer / UX Lead",
    fields: ["Design"],
    bio: "UX Lead och tjänstedesigner med över 25 år av webb – från småföretag till globala storbolag. Coachar gärna juniorer.",
    look: { skin: SKIN_FAIR, hair: "#7a6656", hairStyle: "short", beard: "stubble", beardColor: "#8a7564", glasses: "#141414", glassesStyle: "square", cap: "#2f74d0", top: "#3a3b40", topStyle: "tshirt", pants: "#2a2d36", shoes: "#1e1e1e" },
    traits: { kaos: 0.5, social: 0.7, fokus: 0.65, nyfiken: 0.65, drama: 0.55, smyg: 0.35, energi: 0.6 },
    interests: ["webbhistoria", "coaching", "ux", "flash"],
    catch: [
      "På Netscape-tiden hade vi löst det med en <blink>-tagg.",
      "Får jag coacha dig lite här?",
      "Minns ni gästböcker? Vi borde ha en gästbok.",
    ],
    work: ["Coachar en junior", "Leder en UX-review", "Saknar Flash", "Ritar en sitemap för hand"],
    quirk: "webbhistoria",
    quirkText: "Webbnostalgiker – saknar Flash, gästböcker och <marquee>.",
    desk: [27, 8],
    color: "#7fc0ff",
  },
];

export const CONSULTANT_BY_ID: Record<string, Consultant> = Object.fromEntries(CONSULTANTS.map((c) => [c.id, c]));

// "object" = osynlig talare (kaffemaskinen, krukväxten Bengt, servern …): ritas aldrig,
// men dess pratbubblor visas vid dess position.
export type NpcKind = "vacuum" | "pigeon" | "ghost" | "strindberg" | "courier" | "cat" | "object";

export interface NpcInfo {
  id: string;
  kind: NpcKind;
  name: string;
  title: string;
  bio: string;
}

export const NPCS: NpcInfo[] = [
  { id: "dammbert", kind: "vacuum", name: "Dammbert", title: "Robotdammsugare", bio: "Kontorets mest målmedvetna medarbetare. Har ingen karta, bara drömmar." },
  { id: "gunnar", kind: "pigeon", name: "Duvan Gunnar", title: "Stamgäst på Kungsbalkongen", bio: "Har setts på Norra Bantorget sedan 1906. Kräver smulor." },
  { id: "spoket", kind: "ghost", name: "Spöket från Stora Barnhuset", title: "Hyresgäst sedan 1700-talet", bio: "Gav Barnhusgatan sitt namn. Spökar mest efter mörkrets inbrott." },
  { id: "strindberg", kind: "strindberg", name: "August S.", title: "Granne från Intima Teatern", bio: "Dyker upp när någon nämner honom. Har åsikter om allt." },
  { id: "budet", kind: "courier", name: "Budet", title: "Leverans", bio: "Har ett paket. Ingen har beställt det." },
];
