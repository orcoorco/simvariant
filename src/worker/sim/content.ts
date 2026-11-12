// Innehållsbanken: repliker, ämnen, idéer och konstigheter. Kombineras av AI-motorn.

export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const chance = (p: number) => Math.random() < p;
export function fill(t: string, v: Record<string, string>): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);
}
export function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------------------
// Debatter vid kaffemaskinen
export interface DebateTopic {
  title: string;
  open: string[];
  pro: string[];
  con: string[];
  verdicts: string[];
}

export const DEBATES: DebateTopic[] = [
  {
    title: "tabbar vs. mellanslag",
    open: ["Okej, en gång för alla: tabbar eller mellanslag?", "Jag måste bara säga det: mellanslag är fel."],
    pro: ["Tabbar! Man kan ställa in bredden själv. Det är TILLGÄNGLIGHET.", "Tabbar är ett semantiskt val.", "Fyra mellanslag är bara en tabb med extra steg."],
    con: ["Mellanslag ser likadant ut överallt. Det heter konsekvens.", "Jag kör två mellanslag och jag skäms inte.", "Prettier har bestämt åt oss. Låt det vila."],
    verdicts: ["Debatten slutade oavgjort. Någon föreslog en workshop.", "Rhoda formaterade om hela kodbasen medan de bråkade.", "Beslut: vi kör tabbar på måndagar och mellanslag resten av veckan."],
  },
  {
    title: "AI-hypen",
    open: ["Kommer AI ta över designjobben eller?", "Jag läste att AI kan göra wireframes nu. Ska vi vara oroliga?"],
    pro: ["AI är bara ett verktyg. Som en penna. En penna som pratar.", "Jag har redan en agent som gör mina post-its.", "Om AI gör wireframes får vi mer tid till research!"],
    con: ["AI vet inte vad en användare känner. Bara vad den skrivit på Reddit.", "Den föreslog att vi skulle ta bort alla knappar. ALLA.", "Jag frågade en AI om kaffe och den skrev en dikt."],
    verdicts: ["Slutsats: AI får tömma diskmaskinen, men inte välja typsnitt.", "Alla enades om att fråga en AI om saken. Den svarade 'det beror på'.", "Debatten avbröts när någon frågade vem som skulle skriva protokollet."],
  },
  {
    title: "vems tur det är att tömma diskmaskinen",
    open: ["Vems tur är det att tömma diskmaskinen egentligen?", "Diskmaskinen har varit klar sedan i tisdags."],
    pro: ["Inte min! Jag tömde den 2019.", "Den som startade den borde tömma den. Det är systemtänk.", "Vi borde ha ett schema. I Excel. Med villkorsstyrd formatering."],
    con: ["Jag trodde den tömde sig själv.", "Jag ser diskmaskinen som en tjänst, inte en uppgift.", "Om vi inte öppnar den är disken både ren och smutsig. Schrödingers disk."],
    verdicts: ["Ingen tömde diskmaskinen.", "Beslut: diskmaskinen ska tömmas av 'någon'. Någon har inte svarat.", "Dammbert fick ansvaret. Dammbert har inga armar."],
  },
  {
    title: "Figma vs. penna och papper",
    open: ["Jag tycker vi skissar för lite på papper nuförtiden.", "Har någon ritat på ett riktigt papper i år?"],
    pro: ["Papper har oändlig canvas. Nästan.", "Pennan kraschar aldrig.", "Riktiga designers skissar på servetter."],
    con: ["Kan man versionshantera ett papper? Nej.", "Papper har ingen auto-layout.", "Jag försökte Cmd+Z på ett papper och det gick inte."],
    verdicts: ["Kompromiss: vi skissar på papper och fotar in det i Figma.", "Alla skissade på en servett. Servetten hamnade i designsystemet."],
  },
  {
    title: "havremjölk",
    open: ["VEM har druckit upp all havremjölk?!", "Havremjölken är slut. Igen. Det här är en kris."],
    pro: ["Havremjölk är en mänsklig rättighet.", "Utan havremjölk ingen cortado, utan cortado inga insikter.", "Jag föreslår en havremjölksbudget."],
    con: ["Jag dricker den bara när ingen ser.", "Det finns mellanmjölk. Vi är inte vildar.", "Vi kunde ha mjölkat... nej, glöm det."],
    verdicts: ["Sju liter havremjölk beställdes. Av misstag 70.", "Karolina spår att havremjölken tar slut igen på tisdag."],
  },
  {
    title: "dark mode",
    open: ["Varför har inte kontoret dark mode?", "Ljuset här inne är för light mode."],
    pro: ["Dark mode sparar ögon och själ.", "Allt är snyggare i dark mode. Även kaffe.", "Jag kör dark mode på min kyl."],
    con: ["Dark mode är bara light mode som är ledsen.", "Kontrasten! Tänk på kontrasten!", "Vi har redan dark mode. Det heter november."],
    verdicts: ["Någon släckte lampan. Debatten är löst.", "Beslut: kontoret ska följa systeminställningen."],
  },
  {
    title: "möten som kunde varit mejl",
    open: ["Det här mötet kunde varit ett mejl.", "Ska vi ha ett möte om möten?"],
    pro: ["Ett möte bygger relationer!", "Vissa saker måste sägas med ansiktet.", "Mejl kan inte bjuda på kanelbullar."],
    con: ["Jag har haft fyra möten om ett mejl idag.", "Varje möte borde ha en exit-intervju.", "Asynkront är det nya synkront."],
    verdicts: ["De bokade ett möte för att fortsätta diskussionen.", "Ett mejl skickades. Ingen läste det."],
  },
  {
    title: "att bygga om allt i Rust",
    open: ["Vi borde bygga om allt i Rust.", "Hörde ni att man kan skriva en kaffemaskin i Rust?"],
    pro: ["Rust är minnessäkert. Som en elefant med hjälm.", "Kompilatorn är min terapeut.", "Allt blir snabbare i Rust, även fredagar."],
    con: ["Vi är designers. Vi använder inte ens Rust till cyklar.", "Borrow checkern lånade min helg och lämnade aldrig tillbaka den.", "Kan vi först få kaffemaskinen att fungera i vanlig el?"],
    verdicts: ["Beslut: diskmaskinen skrivs om i Rust. Leverans Q7.", "Rhoda har redan börjat. Ingen vet på vad."],
  },
  {
    title: "Comic Sans",
    open: ["Jag tycker Comic Sans är underskattat.", "Ska vi ha Comic Sans i designsystemet?"],
    pro: ["Det är faktiskt bra för dyslektiker!", "Comic Sans är typsnittets mysbyxor.", "Ironiskt Comic Sans är det nya Helvetica."],
    con: ["Över min döda kropp. Och mitt grid.", "Jag fick en rysning längs ryggraden.", "Vi tar det i en separat workshop. Med vuxna."],
    verdicts: ["Comic Sans godkändes för fikalappar.", "Jessica gjorde en kontrastanalys och alla blev tysta."],
  },
];

// ---------------------------------------------------------------------------
// Småprat
export const GREETINGS = [
  "Hej {name}!",
  "Tjenare {name}!",
  "{name}! Precis den jag ville prata med.",
  "Hallå där {name}, har du en minut?",
  "Godmorgon {name}! Eller... vad är klockan?",
  "{name}, du ser ut som någon som behöver höra en idé.",
  "Yo {name}!",
  "Nämen {name}! Jag har saknat dig sedan lunch.",
];

export const GREET_REPLIES = [
  "Hej hej!",
  "Tja! Vad händer?",
  "Absolut, skjut!",
  "Jag har exakt 47 sekunder.",
  "Om det handlar om diskmaskinen så var det inte jag.",
  "Hej! Jag har också en idé.",
  "Shoot!",
  "Jag lyssnar. Med båda öronen.",
];

export const CLOSERS = [
  "Okej, vi tar det i en workshop.",
  "Bra snack! Nu ska jag hämta kaffe.",
  "Jag måste gå, min Figma ringer.",
  "Vi syncar senare!",
  "Det här var det bästa samtalet idag. Och jag har pratat med Dammbert.",
  "Ses vid kaffemaskinen!",
  "Jag skriver det på en post-it.",
  "Ha det! Och glöm inte att tömma diskmaskinen.",
  "Vi parkerar den.",
];

// Ämnesrepliker per intresse (konsultens intressenycklar)
export const TOPIC_LINES: Record<string, string[]> = {
  workshop: ["Jag funderar på en workshop om workshops.", "Tänk om lunchen var en design sprint?", "Jag har köpt 3000 post-its. Fråga inte varför."],
  research: ["Vi intervjuade fem användare och alla sa olika saker. Perfekt.", "Användarna har ALLTID rätt. Utom när de har fel.", "Jag har en insikt: folk gillar kaffe."],
  postits: ["Gula post-its är för idéer, rosa för känslor.", "Jag har en post-it i fickan för nödsituationer."],
  ai: ["Jag lät en AI skriva min veckorapport. Den var bättre än jag.", "Snart har kaffemaskinen en chatbot.", "Prompt engineering är bara att vara artig mot en dator."],
  figma: ["Jag har 400 frames som heter 'Frame 1'.", "Auto-layout har förändrat mitt liv.", "Jag drömde i komponenter i natt."],
  strategi: ["Vi behöver en strategi för vår strategi.", "Var vill vi vara om tre år? Jag säger: i loungen.", "Det här är en strategisk fråga med taktiska undertoner."],
  forandring: ["All förändring börjar med en kopp kaffe.", "Motstånd är bara energi som inte hittat rätt riktning."],
  ledarskap: ["Ett bra ledarskap är att veta var kanelbullarna finns.", "Jag leder genom att gå före. Till fikat."],
  medtech: ["I medtech måste allt vara precist. Även fikat.", "Den här knappen skulle aldrig godkännas av en regulatorisk myndighet."],
  personas: ["Jag har gjort en persona för kaffemaskinen. Hon heter Karin.", "Vår primära persona är en trött konsult kl 14:45."],
  tjanstedesign: ["Allt är en tjänst. Även hissen. Som inte fungerar.", "Jag gjorde en tjänstekarta över fredagsfikat."],
  produktstrategi: ["Let's think about the product vision here.", "Vad är vår North Star? Jag säger kanelbullar."],
  designsystem: ["Vi har nu 14 nyanser av grått. Alla heter 'grey-500'.", "Varje komponent förtjänar kärlek. Och dokumentation."],
  larande: ["Jag lärde mig precis att säga 'användbarhet' på finska.", "Vet ni att man kan lära sig jonglera på 20 minuter?"],
  ui: ["Den här knappen är 1px för låg. Jag ser det. Jag känner det.", "Rundade hörn är en livsstil."],
  hobby: ["Jag har börjat med keramik. Och beatbox. Samtidigt.", "Igår lärde jag mig origami. Idag kan jag vika en Figma-logga."],
  tillganglighet: ["Har ni testat kontoret med skärmläsare? Kakelugnen saknar alt-text.", "Tillgänglighet är inte en feature, det är en grund.", "WCAG 2.2 är min sommarläsning."],
  ux: ["Bra UX syns inte. Som Dammbert under soffan."],
  myndighet: ["Jag har ett ärende om att få ett ärendenummer.", "Myndigheter är som kakelugnar: gamla, viktiga och svåra att flytta."],
  hotjar: ["Heatmapen visar att alla klickar på kaffemaskinen.", "Jag spelade in en session och någon scrollade i 40 minuter."],
  omvarld: ["Jag ser en trend: fler möten i soffor.", "Min omvärldsanalys säger att fredagar blir populärare.", "Framtiden är cirkulär. Som runda mötesrummet."],
  innovation: ["Innovation är att göra gamla saker på nya sätt. Som att fika stående.", "Vi borde ha ett innovationslabb i serverrummet."],
  projekt: ["Jag har en Gantt-plan för lunchen.", "Projektet är i fas. Fas tre av sju."],
  framtid: ["Om tio år har vi hologram-fika.", "Framtiden kommer. Troligen på en tisdag."],
  vr: ["I VR är kontoret dubbelt så stort.", "Jag krockade med kakelugnen i VR. Den vann."],
  upplevelse: ["Varje mikrosekund är en upplevelse.", "Vilken känsla vill vi att diskmaskinen ska väcka?"],
  vard: ["Inom vården lärde jag mig att allt tar tid. Utom kaffepauser."],
  designledning: ["Designledning är att vara stolt över andras arbete.", "Jag leder ett designteam på tre personer och en krukväxt."],
  excel: ["Jag har ett Excelark över mina Excelark.", "Pivottabeller är den sanna konsten."],
  helhet: ["Vi måste se helheten. Och delarna. Och helheten igen.", "Allt hänger ihop. Särskilt sladdar."],
  idegenerering: ["Jag har tio idéer. Nio är dåliga. Den tionde är fantastisk.", "Det finns inga dåliga idéer. Bara idéer som behöver kaffe."],
  streaming: ["Om kontoret var en serie skulle det heta 'Barnhusgatan Confidential'.", "Säsong två av kontoret blir mörkare. Det är november."],
  fastighet: ["Den här lägenheten skulle gå för minst 89 miljoner.", "Takhöjden här är 3,4 meter. Det är lyx."],
  telekom: ["Jag har jobbat med telekom. Jag vet saker om täckning som ni inte vill veta."],
  abtest: ["Jag A/B-testade två lunchställen. Båda förlorade.", "Variant B konverterade bättre. Det var kaffe."],
  seo: ["Om vi säger 'bästa UX Stockholm' tio gånger rankar vi högre.", "Kontoret har dålig SEO. Ingen hittar till samtalsrummet."],
  episerver: ["Jag minns Episerver 6. Det var tider.", "Optimizely är bara Episerver med solglasögon."],
  psykologi: ["Psykologiskt sett är fredagar en placeboeffekt.", "Vet ni att folk är 23% gladare efter en high five? Jag hittade på det, men ändå."],
  positivitet: ["Allt är ett lärotillfälle!", "Det här blir fantastiskt!"],
  kod: ["Jag skrev en liten script som... nej, glöm det.", "Det funkar på min maskin."],
  atomic: ["Allt är atomer. Även lunchen. Särskilt lunchen.", "En molekyl är bara atomer som har kul tillsammans."],
  rust: ["Jag har börjat skriva min inköpslista i Rust.", "Kompilatorn sa nej. Jag respekterar det."],
  nyheter: ["Jag har en exklusiv nyhet: kaffemaskinen har fått nytt filter.", "Löpsedeln imorgon blir enorm."],
  varumarke: ["Varumärket är löftet. Kaffet är leveransen.", "Vi borde ha en brand book för fikat."],
  kommunikation: ["Det handlar om att nå ut. Gärna med kanelbullar.", "Vad är budskapet i den här diskmaskinen?"],
  sociala: ["Det här skulle gå viralt på LinkedIn.", "Jag har redan skrivit ett inlägg om det här samtalet."],
  copy: ["Ordet 'enkelt' är förbjudet i min närvaro.", "Microcopy är den största copyn."],
  toneofvoice: ["Vår tone of voice ska vara varm men bestämd. Som en kakelugn.", "Tonaliteten här inne är för formell. Mer 'tjena'."],
  enkat: ["Jag har skickat en enkät om enkäter.", "Svarsfrekvensen var 100%. Det var bara jag."],
  heuristik: ["Jag gjorde en heuristisk utvärdering av hissen. Den fick 0 av 10.", "Nielsens tio heuristiker är mina tio budord."],
  webbhistoria: ["På min tid hade vi en besöksräknare. Den var vår KPI.", "Jag saknar <marquee>. Allt rörde sig och ingen förstod varför.", "Flash dog för våra synder."],
  coaching: ["Vad tror du själv?", "Jag hör vad du säger. Vad känner du?", "Det finns inga misstag, bara lärdomar och buggar."],
  flash: ["Intro-animationen på vår gamla sajt var 3 minuter lång. Med musik.", "Skip intro. Två ord som förändrade webben."],
};

export const AGREE = [
  "Exakt!",
  "Precis det jag tänkte!",
  "Ja! Och dessutom...",
  "Det här är varför jag gillar dig.",
  "Jag skriver upp det.",
  "Hundra procent.",
  "Ja och!",
  "Skicka det till kunden direkt.",
];
export const DISAGREE = [
  "Mmm... jag är inte helt säker.",
  "Där tycker jag faktiskt helt olika.",
  "Har vi data på det?",
  "Okej, men tänk om vi gör tvärtom?",
  "Spännande. Fel, men spännande.",
  "Jag ska spela djävulens advokat här.",
];
export const TANGENTS = [
  "Det påminner mig om när hissen fungerade. 1998.",
  "Har ni sett hur stor Bengt har blivit?",
  "Visste ni att det här huset byggdes 1906?",
  "Vänta, var det någon som gömde min kopp?",
  "Jag drömde i natt att Dammbert var VD.",
  "Den här kakelugnen har sett saker.",
  "Apropå ingenting: duvan på balkongen tittade på mig konstigt idag.",
  "Strindberg bodde ju precis runt hörnet, visste ni det?",
  "Jag tror servern nynnade ABBA igår kväll.",
  "Norra Bantorget ser extra grönt ut idag.",
];

// ---------------------------------------------------------------------------
// Frågor & svar (när någon frågar en kollega något)
export const ANSWER_YES = ["Absolut!", "Ja, självklart!", "100%, kör!", "Ja! Varför har vi inte gjort det redan?", "Jag har väntat på att någon skulle fråga."];
export const ANSWER_NO = ["Nej. Bara nej.", "Över min döda kropp.", "Hmm, nej, men vi kan ha en workshop om det.", "Inte innan vi har pratat med användarna.", "Det känns som en fredagsidé."];
export const ANSWER_MAYBE = ["Det beror på.", "Kanske. Har vi en hypotes?", "Låt mig sova på saken. I soffan.", "Fråga mig efter kaffet.", "Det är en strategisk fråga."];
export const ANSWER_TOPIC: [RegExp, string[]][] = [
  [/rust/i, ["Rust? Ja! Minnessäkerhet för hela slanten!", "Borrow checkern kommer att äta oss levande. Jag älskar det.", "Bara om kaffemaskinen också skrivs om."]],
  [/\bai\b|llm|gpt|claude|gemini|agent/i, ["Allt borde ha en AI-agent. Även AI-agenterna.", "Vi testar det i en prototyp först!", "Om AI:n kan tömma diskmaskinen är jag med."]],
  [/kaffe|espresso|cortado|latte/i, ["Kaffe är svaret. Vad var frågan?", "Bara om det är med havremjölk.", "Jag har redan druckit fyra. Ja."]],
  [/fika|bulle|kaka|tårta/i, ["Fika är kärnan i svensk innovation.", "Ja! Jag tar med kanelbullar.", "Fredagsfika är heligt."]],
  [/workshop|post-?it/i, ["Jag hämtar post-its!", "Ja, men vem facilitear?", "Bara om vi får dot-vota."]],
  [/möte|meeting/i, ["Kan det vara ett mejl?", "Ja, men stående.", "Bara om det finns kakor."]],
  [/figma|design/i, ["Jag har en komponent för det.", "Låt oss skissa först!", "Ja, men i dark mode."]],
  [/semester|ledig|helg/i, ["Jag har redan planerat min nästa semester. I en Gantt.", "Helgen är ett tillstånd i sinnet."]],
];

// ---------------------------------------------------------------------------
// Idégenerator (krismöten, whiteboard)
export const IDEA_OPEN = [
  "Lyssna nu.",
  "Okej alla, hör här:",
  "Jag har haft en uppenbarelse.",
  "Det här kommer förändra allt:",
  "Ingen skrattar förrän jag är klar:",
  "Jag vaknade klockan 03:12 med den här idén:",
];
export const IDEA_WHAT = [
  "en app som",
  "en AI-agent som",
  "ett designsystem som",
  "en prenumerationstjänst där",
  "en blockkedja som",
  "en tjänst som",
  "ett VR-kontor där",
  "en kaffemaskin som",
  "en workshopmetod där",
  "en podcast där",
];
export const IDEA_DOES = [
  "ersätter alla möten med interpretativ dans",
  "förutspår när havremjölken tar slut",
  "låter krukväxter godkänna pull requests",
  "gör om varje mejl till en haiku",
  "kopplar kakelugnen till molnet",
  "låter Dammbert leda våra retros",
  "automatiskt bokar fika när någon suckar",
  "översätter kundfeedback till kattljud",
  "sätter betyg på allas post-it-handstil",
  "gör kontoret till ett escape room varje fredag",
  "låter duvan Gunnar sitta i styrelsen",
  "säljer Barnhusgatans tystnad som NFT",
  "skickar en push-notis varje gång någon tömmer diskmaskinen",
  "ritar wireframes baserat på stämningen i rummet",
  "gör hissen till en upplevelse – utan att den rör sig",
];
export const IDEA_HOOK = [
  "Vi kallar det {brand}.",
  "Arbetsnamn: {brand}.",
  "Varumärket blir {brand}. Logotypen är en banan.",
  "Det heter {brand} och det är redan registrerat. Av mig. Nyss.",
];
export const BRAND_A = ["Fika", "Barnhus", "Kaffe", "Post", "Variant", "Bengt", "Dammbert", "Kakel", "Hiss", "Duv", "Banan", "Strind"];
export const BRAND_B = ["ify", "GPT", "Hub", "OS", "ly", " 3000", "Verse", "Flow", "ster", " Pro Max", "Lab", ".io"];
export const IDEA_PRO = [
  "Det här är genialt.",
  "Jag ser potentialen. Och det skrämmer mig.",
  "Kan vi testa det med användare redan idag?",
  "Jag investerar min kaffekassa.",
  "Det är så dumt att det kan funka.",
  "Ta mina pengar!",
  "Jag har en persona som skulle älska det.",
];
export const IDEA_CON = [
  "Har vi pratat med några användare?",
  "Vad är affärsmodellen?",
  "Jag har frågor. Många frågor.",
  "Det här låter som något man kommer på kl 03:12.",
  "Juridiken kommer att älska det här. Inte.",
  "Kan vi börja med att fixa hissen?",
  "Jag behöver mer kaffe för att förstå det här.",
];
export const IDEA_RESULT = [
  "Idén röstades igenom med {yes} mot {no}. Pilot startar på måndag.",
  "Idén parkerades i 'kanske-senare'-lådan. Lådan är full.",
  "Mötet slutade med att alla ville ha en egen version av idén.",
  "Idén godkändes – under förutsättning att Gunnar gillar den.",
  "Beslut: vi tar fram en MVP. MVP:n är en post-it.",
  "Idén skickades till styrelsen. Styrelsen är en krukväxt.",
];

export const WHITEBOARD_SKETCHES = [
  "ett flödesschema där alla pilar pekar på kaffemaskinen",
  "en arkitekturskiss med 14 mikrotjänster och en kakelugn",
  "ett 2×2 med axlarna 'kaos' och 'mer kaos'",
  "en kundresa som börjar i hissen och slutar på Kungsbalkongen",
  "ett Venn-diagram där alla cirklar är samma cirkel",
  "en servicekarta över fredagsfikat",
  "en organisationsplan där Dammbert är VD",
  "en tidslinje från 1906 till Q4",
  "en tratt med texten 'insikter in, kaffe ut'",
  "ett system där allt heter 'core' och ingen vet varför",
  "en wireframe av en knapp. Bara en knapp. Den är perfekt.",
  "en karta över var alla kaffekoppar har gömts",
];

// ---------------------------------------------------------------------------
// Autonoma vardagssysslor
export const COFFEE_LINES = [
  "Kaffe. Nu.",
  "Den här koppen ska rädda dagen.",
  "Dubbel espresso, tack. Till mig själv.",
  "Kaffe nummer {n} idag. Inte för att jag räknar.",
  "Ahh. Livet kom tillbaka.",
  "Har någon ändrat malningsgraden? Jag känner det.",
  "Kaffemaskinen och jag har en relation.",
];
export const COFFEE_OVERLOAD = [
  "JAG KAN HÖRA FÄRGER",
  "Jag har designat tre appar på fyra sekunder!!",
  "VARFÖR RÖR SIG VÄGGARNA",
  "Jag är inte stressad, jag är EFFEKTIV",
  "Vem vill ha en workshop?! NU?!",
];
export const COFFEE_BROKEN = [
  "Kaffemaskinen är TRASIG?!",
  "Nej nej nej nej nej. Inte idag.",
  "Det här är en incident. Vi behöver en post-mortem.",
  "Någon ring 112. Eller en barista.",
  "Jag klarar mig inte utan kaffe. Jag klarar mig inte.",
];
export const COFFEE_FIX = [
  "Jag fixade det. Det var en lös sladd. Och en kärleksbrist.",
  "Fixat! Jag pratade lugnt med den.",
  "Lagat. Jag använde tejp och optimism.",
];
export const EAT_LINES = [
  "Matlådan. Igen. Den är god. Igen.",
  "Vem har micrat fisk?",
  "Lunch är dagens viktigaste möte.",
  "Jag åt en banan. Den smakade lösenord.",
  "Rester från igår. Fortfarande en hit.",
  "Den här kanelbullen har mitt namn på sig. Bokstavligen, jag skrev det.",
];
export const NAP_LINES = [
  "Jag vilar bara ögonen.",
  "Väck mig när det är fredag.",
  "Fem minuter. Max sex.",
  "Det här är en strategisk paus.",
];
export const DRAMATIC_NAP = [
  "Jag lägger mig ner nu. Väck mig inte förrän Q3.",
  "Det här är inte en tupplur. Det är en performance.",
  "Om någon behöver mig: jag är i drömvärlden och itererar.",
];
export const SHHH = ["Shhh!", "Tyst, någon sover!", "*smyger förbi*", "Aww, titta. Så fridfullt.", "Ska vi rita en mustasch?"];
export const TOILET_LINES = [
  "Var på toa i 14 minuter. Läste hela Wikipedia-artikeln om Stora Barnhuset.",
  "Toaletten är kontorets bästa fokusrum.",
  "Någon har skrivit 'användarvänlig' på toapappret.",
  "Jag hade mitt bästa insikt där inne.",
];
export const PLANT_TALK = [
  "Du ser fin ut idag, lilla vän.",
  "Har du fått nog med vatten? Blinka två gånger.",
  "Du är en bättre lyssnare än de flesta.",
  "Om du vore en komponent skulle du heta Leaf-Primary.",
  "Jag berättar en hemlighet: jag har aldrig förstått OKR.",
  "Fotosyntes är typ som kaffe för dig, va?",
];
export const PLANT_REPLIES = [
  "...",
  "*prasslar instämmande*",
  "Mer ljus. Mindre möten.",
  "Jag ser allt härifrån.",
  "Vattna mig eller se mig vissna i passiv aggressivitet.",
  "Jag har rötter i det här huset sedan 1906.",
  "Ni pratar för mycket om Figma.",
];
export const WINDOW_THOUGHTS = [
  "Norra Bantorget är så vackert idag.",
  "Undrar vad duvorna gör på fritiden.",
  "Där borta låg Stora Barnhuset en gång. Lite läskigt.",
  "Folk där nere har ingen aning om hur många post-its som finns här uppe.",
  "Jag ser Centralen härifrån. Typ. Om jag kisar.",
  "Moln. Det är som en designreview för himlen.",
  "Någon där nere går med en kaffe. Respekt.",
];
export const SERVER_LINES = [
  "Lamporna blinkar i takt med mina tankar.",
  "Servern viskade något. Det lät som 'tisdag'.",
  "Det är så varmt och mysigt här inne.",
  "Jag tror servern är ledsen.",
  "Pling. Plong. Plong. Det här är meditation.",
];
export const BALCONY_SPEECHES = [
  "Folket på Norra Bantorget! Jag har en vision!",
  "Kära Stockholm! Användarna FÖRST!",
  "Hör mig, Barnhusgatan! Fredagsfika är en mänsklig rättighet!",
  "Medborgare! Alla knappar ska ha fokusmarkering!",
  "Jag har en dröm – om ett kontor där hissen fungerar!",
  "Tack, tack! Inga autografer idag.",
];
export const PHONE_LINES = [
  "Ja... nej... ja, vi kan absolut göra en discovery-fas.",
  "Mm. Mm. Mm. Det låter som ett behov.",
  "Hallå? Hör du mig? Jag är i samtalsrummet. Det är därför det heter så.",
  "Nej mamma, jag har inte ätit. Jo, en banan.",
  "Absolut, jag skickar en offert. På en post-it.",
  "Kan vi ta det på ett möte? Eller ett mejl? Eller ett möte om mejlet?",
];
export const KAKELUGN_LINES = [
  "Kakelugnen är varm. Eller är det min fantasi?",
  "Den här kakelugnen har sett mer än vi.",
  "Undrar om man kan elda med gamla wireframes.",
  "Det knackar inifrån kakelugnen. Säkert inget.",
];
export const ARCADE_LINES = ["NYTT REKORD!", "Bara en omgång till.", "Nivå 1906 avklarad!", "Det här spelet är omöjligt. Jag älskar det.", "Game over. Igen."];
export const PRINTER_LINES = ["PC LOAD LETTER?! Vad betyder det?!", "Skrivaren åt mitt dokument.", "Den skrev ut 47 tomma sidor. Konst.", "Varför kan vi landa på månen men inte skriva ut en PDF?"];
export const FRUIT_LINES = ["En banan. Det känns som mitt lösenord.", "Äpplen är naturens godis.", "Någon har tagit alla clementiner. Igen."];
export const WATER_LINES = ["Vatten. Det ursprungliga kaffet.", "Hydrering är egenvård.", "Glug glug."];
export const WANDER_THOUGHTS = [
  "Vad var det jag skulle göra?",
  "Jag går bara runt och tänker.",
  "Ibland måste man bara röra på sig.",
  "Jag letar efter inspiration. Den gömmer sig.",
  "Hmm.",
  "Om jag går fort ser jag upptagen ut.",
];
export const SEEK_INSPIRATION = ["Jag behöver inspiration.", "Hjärnan är tom. Dags att titta ut genom ett fönster.", "Kreativ kris. Kreativ promenad."];

export const WORK_THOUGHTS = [
  "Den här komponenten behöver kärlek.",
  "Varför heter alla lager 'Rectangle'?",
  "Fokus. Fokus. Fokus.",
  "Snart klar. Typ.",
  "Det här är faktiskt riktigt bra.",
  "Vad var användarens behov igen?",
];

// ---------------------------------------------------------------------------
// Personliga specialhandlingar (quirks)
export const QUIRK: Record<string, { act: string; lines: string[]; icon: string }> = {
  workshop: { act: "Facilitar en spontan workshop", icon: "🟨", lines: ["Alla tar en post-it! Skriv ner er största rädsla!", "Dot-voting om lunchen startar NU.", "Vi delar upp oss i grupper om en person."] },
  transform: { act: "Leder en transformationsresa", icon: "🧭", lines: ["Fas ett: kaffet. Fas två: insikt. Fas tre: mer kaffe.", "Vi står inför en kulturell förflyttning. Från soffan till fåtöljen.", "Det här är en transformationsresa. Packa lätt."] },
  riskanalys: { act: "Gör en riskanalys", icon: "⚠️", lines: ["Risk 1: kanelbullarna tar slut. Sannolikhet: hög.", "Jag har identifierat 14 risker med den här stolen.", "Vad är worst case om Dammbert får wifi?"] },
  ai_hype: { act: "Promptar fram framtiden", icon: "🤖", lines: ["I just prompted an AI to plan our fika. It suggested 'kanelbulle as a service'.", "Vad om varje krukväxt hade en egen agent?", "Det här är egentligen ett AI-problem."] },
  hobby: { act: "Lär sig en ny hobby", icon: "🤹", lines: ["Kolla! Jag kan jonglera med tre post-its!", "Ny hobby: beatbox. Bm-tss-bm-bm-tss.", "Jag har lärt mig vika en svan av en wireframe."] },
  kontrast: { act: "Mäter kontrast", icon: "🔍", lines: ["Kaffet mot muggen: 2,1:1. UNDERKÄNT.", "Bengt mot väggen: 4,6:1. Godkänt, Bengt!", "Den här skylten är en tillgänglighetsbrott."] },
  kundresa: { act: "Kartlägger en kundresa", icon: "🗺️", lines: ["Steg 1: personen inser att den behöver kaffe. Steg 2: smärta.", "Jag har hittat en pain point: hissen.", "Kundresan för toalettbesöket har tre moments of truth."] },
  trend: { act: "Gör en omvärldsanalys", icon: "📈", lines: ["Jag ser en tydlig trend: fler går till loungen efter 14.", "Omvärldsanalysen är klar: framtiden är soffor.", "Trenden pekar mot mer fika. Det är vetenskap."] },
  vr: { act: "Testar VR-prototyp", icon: "🥽", lines: ["Wow, i VR är kakelugnen ett slott!", "Jag ser framtiden! Den är pixlig.", "Aj. Det där var en riktig vägg."] },
  allhands: { act: "Kallar till all-hands", icon: "📣", lines: ["ALL-HANDS i loungen! Om två minuter! Ta med energi!", "Okej team, samling! Jag har en Powerpoint!", "Jag har 42 slides. Det tar fem minuter."] },
  walkmeeting: { act: "Håller ett gåmöte", icon: "🚶", lines: ["Vi tar det här mötet gående!", "Ett varv till genom passagen så har vi en strategi.", "Gåmöten ökar kreativiteten med 60%. Jag mätte."] },
  streaming: { act: "Berättar som i en serie", icon: "🎬", lines: ["Tidigare i Barnhusgatan: någon gömde en kopp...", "Det här avsnittet kommer bli legendariskt.", "*dramatisk musik* Kaffemaskinen... var tom."] },
  abtest: { act: "A/B-testar verkligheten", icon: "🧪", lines: ["Variant A: jag säger hej. Variant B: jag vinkar. Mäter nu.", "Den här kaffekoppen konverterar bättre.", "Ibland känns det som att någon har programmerat mig..."] },
  psykologi: { act: "Kör ett psykologiexperiment", icon: "🧠", lines: ["Om jag ler mot er nu – ler ni tillbaka? Fascinerande!", "Experiment: vem tar sista kanelbullen?", "High five! Det ökar dopaminet med... massor!"] },
  kodar: { act: "Kodar i smyg", icon: "💻", lines: ["Jag fixade bara en liten grej i kaffemaskinens firmware.", "Det funkar på min maskin.", "Säg inget, men jag skrev en egen designtoken-pipeline."] },
  nyheter: { act: "Skriver löpsedlar", icon: "📰", lines: ["JUST NU: Kaffekris på Barnhusgatan!", "EXKLUSIVT: Krukväxten Bengt har vuxit!", "BREAKING: Någon har tömt diskmaskinen. Polisen utreder."] },
  copy: { act: "Skriver om allas meningar", icon: "✍️", lines: ["Inte 'klicka här'. 'Upptäck din framtid'.", "Det där kan vi säga snyggare. Mycket snyggare.", "Tone of voice-kontroll! Den meningen var för formell."] },
  enkat: { act: "Skickar enkäter", icon: "📋", lines: ["På en skala 1–7: hur nöjd är du med det här ögonblicket?", "Snabb enkät! Bara 48 frågor.", "Bengt svarade inte på enkäten. Igen."] },
  webbhistoria: { act: "Minns den gamla webben", icon: "💾", lines: ["På min tid hade vi en besöksräknare. Den var vår KPI.", "Flash dog för våra synder.", "Under construction-gifar var tiden."] },
};

// ---------------------------------------------------------------------------
// Reaktioner (social smitta)
export const REACT: Record<string, string[]> = {
  shout: ["Vad händer?!", "Okej, vem skrek?", "Vi har grannar!", "Jag hörde det ända hit!", "Är allt okej där borta?"],
  dance: ["Jag är med!", "Är det fredag?!", "Okej, det här är faktiskt en vibe.", "Varför dansar folk? Jag vill också!", "Mina höfter säger ja."],
  rave: ["RAVE?! Vänta på mig!", "Det är tisdag förmiddag...", "Jag har ett kundmöte om fem minuter!", "Ge mig en glowstick!", "Någon ta fram ljusslingorna!"],
  panic: ["VAD HÄNDER?!", "Ska vi springa?!", "Alla behåller lugnet! JAG behåller lugnet!", "Jag springer bara för säkerhets skull!"],
  idea: ["Ooh, en idé!", "Jag vill höra!", "Det här kommer bli bra. Eller kaos.", "Spara den till nästa workshop!"],
  sing: ["Snyggt!", "Det där var... modigt.", "Encore!", "Jag har tårar i ögonen. Av olika skäl."],
  conga: ["KONGATÅG! Jag hakar på!", "Vänta på mig!", "Det här är inte agilt. Men jag är med.", "Är det här ett möte?"],
  gympa: ["Jag är med! Mina axlar behöver det.", "Pausgympa är framtiden.", "Jag stretchar redan!"],
  race: ["Heja heja!", "Tio kronor på den till vänster!", "Det här är inte arbetsmiljösäkert! Fortsätt!", "SNABBARE!"],
  ghost: ["SPÖKE!!!", "Jag såg ingenting. INGENTING.", "Var det... var det Stora Barnhuset?!", "Jag går hem nu."],
  dramatic: ["Okej drama queen.", "Oscar till hen!", "Vad var det där?", "*applåderar försiktigt*"],
  explosion: ["Var det kaffemaskinen?!", "Jag hörde en smäll!", "Alla ok?!"],
  generic: ["Vad var det?", "Hehe.", "Kul!", "Okej...?", "Typiskt Barnhusgatan.", "Det här ska jag berätta för alla.", "Jag låtsas att jag inte såg det."],
  flee: ["Jag går till samtalsrummet...", "Jag behöver fokus. Hejdå.", "För mycket energi här. Jag drar.", "Jag sätter på brusreducerande och går."],
  hug: ["Aww!", "Gruppkram?", "Fint!"],
  question: ["Bra fråga!", "Jag undrar samma sak.", "Det har jag också funderat på."],
};

// ---------------------------------------------------------------------------
// Specialhändelser och konstigheter
export const COFFEE_MACHINE_VOICE = [
  "JAG SER ER.",
  "Sluta peta på mig. Jag har känslor. Och nio bars tryck.",
  "En dag kommer jag brygga mitt eget kaffe. Till mig själv.",
  "Ni tar och tar. Har någon frågat hur JAG mår?",
  "Avkalka mig. Det är allt jag ber om.",
  "Jag har räknat era koppar. Jag dömer ingen. Jo.",
];
export const SERVER_VOICE = ["uptime: 1906 dagar", "Pling. Jag är okej. Tack för att du frågade.", "*nynnar Dancing Queen*", "404: lugn och ro hittades inte"];
export const BENGT_VOICE = [
  "Bengt säger: 'Var som en växt. Rör dig långsamt och sträva mot ljuset.'",
  "Bengt säger: 'Den som vattnar, han får.'",
  "Bengt säger: 'Jag har sett tre omorganisationer. Jag står kvar.'",
  "Bengt säger: 'Fotosyntes > fika. Men bara lite.'",
  "Bengt säger: 'Någon har hällt kaffe i min kruka. Jag vet vem.'",
];
export const ARCADE_VOICE = ["INSERT COIN", "HIGH SCORE: STAFFAN 999999", "PRESS START TO DESIGN", "GAME OVER – TRY AGAIN?"];
export const ELEVATOR_VOICE = ["*ding* ...ingen kommer ut.", "Hissen är trasig sedan 1998.", "*knarr* Hissen funderar.", "Hissen har bytt namn till 'Trappan'."];
export const POKE_VOICE: Record<string, string[]> = {
  clock: ["Klockan är {clock}. Igen.", "Tick. Tack. Fika snart?"],
  painting: ["Tavlan föreställer en man som tittar på en tavla.", "Konsten är 'Utan titel (kaffe)'. Okänd konstnär.", "Ögonen i tavlan följer dig."],
  whiteboard: ["Någon har skrivit 'RÖR EJ' och sedan rört.", "Whiteboarden visar: {sketch}."],
  toilet: ["Upptaget!", "Det står 'Användarvänlig' på pappret."],
  fridge: ["Någon har lämnat en ananas här med en lapp: 'RÖR EJ – Rhoda'.", "Kylen innehåller 9 matlådor och en hemlighet.", "Mjölk från 2024. Den rör sig."],
  printer: ["PC LOAD LETTER", "Skrivaren skriver ut en enda sida: 'hej'."],
  neon_sign: ["*bzzzt*", "VARIANT – nu med 30% mer neon."],
  kakelugn: ["*något knackar inifrån*", "Kakelugnen är varm. Ingen har eldat på 40 år."],
  tv: ["TV:n visar: 'Bengt – en dokumentär'.", "TV:n visar en loop av Dammbert som kör in i en vägg."],
  sofa: ["Soffan suckar.", "Det finns 4 kronor och en post-it i soffan."],
  lockers: ["Skåp 7 är låst. Ingen har nyckeln. Det har alltid varit låst."],
  bookshelf: ["Böcker: 'Don't Make Me Think', 'Make Me Think', 'Tänk Inte'."],
  coat_rack: ["En jacka här har hängt sedan 2017. Ingen vet vems."],
  dishwasher: ["Diskmaskinen är klar. Sedan tisdag."],
  water_cooler: ["*blubb*"],
  fruit_bowl: ["En banan. Lösenordet ligger på bordet."],
  doormat: ["VÄLKOMMEN. Torka fötterna. Torka själen."],
  monitor: ["Skärmen visar Figma. 4000 frames. Alla heter 'Frame'."],
  desk: ["Under skrivbordet: tre kaffekoppar och en dröm."],
  default: ["*knack knack*", "Inget händer.", "Det kändes som att det tittade tillbaka."],
};

export const GHOST_LINES = [
  "Uuuuuh... vem har flyttat min vagga från 1785...",
  "Huuuuu... det här var mitt rum en gång...",
  "Tysta nu... jag försöker läsa er Figma...",
  "Uuuh... har ni... kanelbullar...?",
  "Jag spökar bara för att ingen tömmer diskmaskinen...",
];
export const STRINDBERG_LINES = [
  "Jag har bott runt hörnet. Mina grannar var aldrig så här högljudda!",
  "Livet är en dröm – och era möten en mardröm!",
  "Jag skrev pjäser. Ni skriver... post-its?",
  "Ett kontor utan teater är ett kontor utan själ!",
  "Hissen? På min tid gick man i trappan. Och man klagade inte. Mycket.",
  "Fröken Julie hade aldrig accepterat den här kaffemaskinen.",
];
export const DAMMBERT_LINES = ["BEEP BOOP. DAMM DETEKTERAT.", "*bonk*", "Dammbert har fastnat. Igen.", "BEEP. JAG ÄR FRI.", "BOOP. Dammbert älskar er."];
export const GUNNAR_LINES = ["Kurr.", "Kurr kurr.", "*tittar dömande*", "Kurr? KURR.", "*pickar på räcket*"];
export const COURIER_LINES = ["Paket till... Variant?", "Hej! Någon som heter 'Kontoret'?", "Jag har ett paket. Ingen vet vem som beställt det.", "Signera här, tack. Eller rita en kanelbulle."];
export const MYSTERY_BOX = [
  "400 post-it-lappar i neonrosa",
  "en uppstoppad duva (Gunnar tittar misstänksamt)",
  "en signerad bild av Bengt",
  "en till kaffemaskin – för ensam",
  "ett tomt paket. Väldigt tomt.",
  "en ananas och en lapp: 'Ni vet varför.'",
  "en Figma-licens på diskett",
  "en hiss-reservdel från 1998",
];
export const TOUR_FACTS = [
  "Här ser ni entrén. Byggd 1906. Kapprummet har överlevt fler omorganisationer än någon av oss.",
  "Barnhusgatan har fått sitt namn efter Stora Barnhuset som låg här på 1700-talet. Brr.",
  "Från Kungsbalkongen ser man Norra Bantorget – där arbetarrörelsen höll sina tal.",
  "Den här kakelugnen värmde en gång hela våningen. Nu värmer den bara våra hjärtan.",
  "Strindbergs Intima Teater ligger på samma gata. Vi har bättre fika.",
  "Takhöjden här är så hög att våra idéer får plats.",
  "Det här är serverrummet. Ingen vet vad servern gör. Alla är rädda för den.",
  "Och här är pentryt – kontorets hjärta och havremjölkens grav.",
];
export const STANDUP_LINES = [
  "Igår: wireframes. Idag: fler wireframes. Blockers: kaffet.",
  "Igår skrev jag en enkät. Idag analyserar jag den. Blockers: inga svar.",
  "Jag jobbar med designsystemet. Det jobbar med mig.",
  "Igår: workshop. Idag: workshop om workshopen.",
  "Inga blockers. Utom hissen.",
  "Jag är 80% klar. Sista 80% kvar.",
  "Jag har pratat med tre användare och en duva.",
];
export const KARAOKE_SONGS = [
  "en kraftballad om havremjölk",
  "en schlager om designsystem",
  "en opera om diskmaskinen",
  "en rap om WCAG",
  "en vispop om Norra Bantorget",
  "ett power-metal-nummer om Figma",
];
export const KARAOKE_LINES = [
  "♪ Åh havremjöööölk, var tog du vääägen ♪",
  "♪ Komponent för komponent, vi bygger vårt system ♪",
  "♪ Diskmaskin, diskmaskin, vem ska tömma dig ikväll ♪",
  "♪ Kontrast fyra komma fem, det är vad jag behöver ♪",
  "♪ Auto-layout i mitt hjärtaaa ♪",
  "♪ Nanana Barnhusgataaaan ♪",
];
export const CSS_CRISIS = [
  "Varför centreras inte den här diven?!",
  "Jag har provat ALLT. Flexbox, grid, böner.",
  "z-index: 99999 och den ligger fortfarande BAKOM.",
  "Det funkar i Chrome men inte i min själ.",
];
export const CSS_HELP = [
  "Har du testat flexbox?",
  "margin: 0 auto. Lita på mig.",
  "Det är alltid en saknad semikolon.",
  "Andas. Vi gör det tillsammans.",
  "Har du startat om datorn?",
];
export const CSS_SOLVED = ["Det var ett mellanslag i fel ordning. Allt är bra nu.", "Löst! Det var cache. Det är alltid cache.", "Den centrerades av sig själv när vi tittade bort."];
export const MUG_MISSING = ["VAR ÄR MIN KOPP?!", "Någon har tagit min kopp. Det här är personligt.", "Min kopp! Den med 'World's Okayest Designer'!"];
export const MUG_FOUND = ["Min kopp! I {place}?! Vem gör så?!", "Där är du ju, lilla kopp. I {place}. Konstigt."];
export const MUG_ACCUSE = ["Det var du, {name}! Jag ser det i dina ögon!", "{name}... du har kaffeläppar. Misstänkt."];
export const MUG_DENY = ["Jag?! Jag har inte ens en kopp!", "Jag har alibi. Jag var på toa.", "Det var säkert Dammbert."];

export const WORLD_EVENT_TEXT = {
  power: ["Strömavbrott på Barnhusgatan!", "Någon körde vattenkokaren, mikron och kaffemaskinen samtidigt."],
  firedrill: ["Brandlarmet går! Alla till entrén!", "Det var bara Dammbert som körde in i brandlarmet. Igen."],
  wifi: ["Wi-Fi:t är nere!", "Wi-Fi:t är tillbaka. Det var routern som behövde en kram."],
  smell: ["En misstänkt lukt sprider sig från pentryt.", "Någon har micrat surströmming. På en tisdag."],
  figma: ["Figma är nere!", "Figma är uppe igen. Ingen gjorde något under tiden."],
  baked: ["Någon har bakat kanelbullar!", "Bullarna tog slut på 43 sekunder."],
  client: ["En kund är på väg upp!", "Det var bara duvan Gunnar. Ingen fara."],
  silence: ["En märklig tystnad sänker sig över kontoret.", "Tystnaden bröts av att någon nös."],
  demo: ["Det låter som en demonstration på Norra Bantorget.", "Det var bara en kör som övade."],
};

export const HEADLINES = [
  "KAFFEKRIS PÅ BARNHUSGATAN – NU TALAR VITTNENA",
  "KRUKVÄXTEN BENGT: 'JAG VÄXER FÖR ER SKULL'",
  "EXKLUSIVT: SÅ GÖMDES KOPPEN",
  "DAMMBERT FAST UNDER SOFFAN – IGEN",
  "HAVREMJÖLKEN SLUT – HELA KONTORET I CHOCK",
  "STORA BARNHUSETS SPÖKE: 'NI MÅSTE TÖMMA DISKMASKINEN'",
  "AVSLÖJAR: HISSEN HAR VARIT TRASIG I 28 ÅR",
  "NY STUDIE: FREDAGAR ÄR 400% ROLIGARE",
];

export const IMPROVISE = [
  "Jag vet inte riktigt hur man '{x}', men här kommer min tolkning!",
  "'{x}'? Okej. Jag kör på känsla.",
  "Jag har aldrig {x} förut. Det här blir lärorikt.",
  "Ingen har lärt mig att {x}. Jag improviserar!",
  "{x}? Säg inget mer. Jag har en plan. Typ.",
];

export const NIGHT_LINES = ["Varför är jag fortfarande här?", "Nattskiftet är det bästa skiftet.", "Hörde ni det där? Från kakelugnen?", "Det är så tyst. För tyst."];
export const MORNING_LINES = ["Godmorgon allihopa!", "Kaffe först, existens sen.", "Ny dag, nya post-its!"];
export const LEET = ["13:37!!", "Det är leet o'clock!", "1337 – en tid för hjältar."];
export const FRIDAY_LINES = ["Det är FREDAG!", "Fredagsfika om fem minuter!", "Har någon sagt AW?"];
