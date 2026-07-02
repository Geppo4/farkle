'use strict';

/* =========================================================
   FARKLE — logica di gioco
   ========================================================= */

/* ---- Configurazione Supabase (salvataggio cloud, opzionale) ----
   Incolla la chiave "anon public" del TUO progetto (Dashboard → Settings → API).
   La chiave 'anon' è PUBBLICA: è sicura nel client SOLO se hai attivato la RLS
   sulla tabella (vedi SUPABASE_SETUP.md). NON mettere qui la chiave service_role.
   Se lasci la chiave vuota, il gioco funziona lo stesso, solo in locale. */
const SUPABASE_URL = 'https://rccgnfjohubwfhqxgkey.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjY2duZmpvaHVid2ZocXhna2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTEwNzUsImV4cCI6MjA5MTA2NzA3NX0.1pvKzoI9lG6NAfqIpUqpibHniVC9GS-Di6eBRxHRASk'; // <-- incolla qui la chiave "anon public"

const NUM_DICE = 6;

/* ---- Motore decisionale dell'IA basato sul Valore Atteso (EV) ----
   Probabilità ESATTE di Farkle e guadagno medio per numero di dadi rimasti,
   calcolate per enumerazione completa di tutti i lanci possibili. */
const FARKLE_PROB = { 1: 0.6667, 2: 0.4444, 3: 0.2778, 4: 0.1574, 5: 0.0772, 6: 0.0231 };
const EXP_GAIN    = { 1: 75,     2: 90,     3: 120.2,  4: 167.7,  5: 233.5,  6: 355   };

/* Soglia EV: conviene rilanciare finché il punteggio del turno è inferiore a
   questa soglia. Deriva dall'equazione di indifferenza:
     (1 - pF) * guadagno  >  pF * punteggioTurno
   cioè punteggioTurno < guadagno * (1 - pF) / pF. */
function evThreshold(diceLeft){
  const pF = FARKLE_PROB[diceLeft];
  const g  = EXP_GAIN[diceLeft];
  return g * (1 - pF) / pF;
}

/* Profili di difficoltà (solo Giocatore Singolo):
   - risk: quanto fedelmente l'IA segue la soglia EV (1 = ottimale);
   - lazy: probabilità di una selezione sub-ottimale (un errore reale).
   Calibrati via simulazione Monte Carlo per un ladder netto e crescente. */
const AI_LEVELS = {
  easy:   { risk: 0.4, lazy: 0.6 },
  medium: { risk: 0.6, lazy: 0.3 },
  hard:   { risk: 1.0, lazy: 0.0 },
};

const DIFF_LABEL = { easy: 'Facile', medium: 'Medio', hard: 'Difficile', expert: 'Esperto' };

/* ---- Livello "Esperto": IA a gioco perfetto ----
   DP_VALUE[d][t/50] = valore atteso del turno giocando in modo OTTIMALE, con
   d dadi ancora da lanciare e t punti già accumulati. Tabella precalcolata
   offline tramite programmazione dinamica (f(6,0) = 505 punti/turno). */
const DP_VALUE = [null,[189,202,217,231,246,260,275,290,304,319,334,350,365,380,395,410,426,441,457,473,488,504,519,535,551,566,582,598,613,629,645,661,676,692,708,724,740,755,771,787,803,819,835,851,867,883,899,915,931,947,963,979,995,1011,1027,1043,1059,1076,1092,1108,1124,1141,1157,1173,1189,1206,1222,1238,1254,1271,1287,1303,1319,1336,1352,1368,1384,1401,1417,1433,1449,1466,1482,1498,1514,1530,1547,1563,1579,1595,1611,1628,1644,1660,1676,1693,1709,1725,1741,1756,1773],[163,174,185,197,214,239,266,293,320,347,375,402,429,456,484,511,539,566,593,621,648,676,703,731,758,785,813,840,868,895,923,950,978,1005,1033,1060,1088,1115,1143,1170,1198,1225,1253,1280,1308,1336,1363,1391,1418,1446,1473,1501,1529,1556,1584,1611,1639,1667,1694,1722,1750,1777,1805,1833,1860,1888,1915,1943,1971,1998,2026,2054,2081,2109,2137,2164,2192,2219,2247,2275,2302,2330,2358,2385,2413,2440,2468,2496,2523,2551,2579,2606,2634,2661,2689,2717,2744,2772,2799,2827,2855],[177,187,201,223,255,291,327,363,399,435,470,506,542,578,614,650,686,722,758,794,830,866,902,938,973,1009,1045,1081,1117,1153,1189,1225,1261,1297,1333,1369,1405,1441,1477,1513,1549,1585,1621,1657,1693,1729,1765,1801,1837,1873,1909,1945,1981,2017,2053,2089,2125,2162,2198,2234,2270,2306,2342,2378,2414,2450,2486,2522,2558,2594,2630,2666,2702,2738,2774,2810,2846,2882,2918,2954,2990,3026,3062,3099,3135,3171,3207,3243,3279,3315,3351,3387,3423,3459,3495,3531,3567,3603,3639,3675,3710],[219,239,268,302,338,375,412,451,493,535,577,619,661,703,745,787,829,871,913,955,997,1039,1081,1123,1165,1208,1250,1292,1334,1376,1418,1460,1502,1544,1586,1628,1670,1712,1754,1796,1838,1880,1922,1964,2006,2049,2091,2133,2175,2217,2259,2301,2343,2385,2427,2469,2511,2553,2596,2638,2680,2722,2764,2806,2848,2890,2932,2974,3016,3058,3101,3143,3185,3227,3269,3311,3353,3395,3437,3479,3521,3563,3606,3648,3690,3732,3774,3816,3858,3900,3942,3984,4026,4068,4110,4152,4194,4236,4278,4320,4362],[313,346,383,420,458,497,538,581,623,665,707,749,792,836,880,923,967,1011,1056,1101,1147,1193,1239,1285,1332,1378,1424,1470,1516,1562,1608,1654,1700,1746,1792,1838,1885,1931,1977,2023,2069,2115,2161,2207,2253,2299,2346,2392,2438,2484,2530,2576,2622,2668,2714,2761,2807,2853,2899,2945,2991,3037,3083,3129,3176,3222,3268,3314,3360,3406,3452,3498,3544,3591,3637,3683,3729,3775,3821,3867,3913,3959,4005,4052,4098,4144,4190,4236,4282,4328,4374,4420,4466,4512,4559,4605,4651,4697,4742,4789,4835],[505,546,587,628,671,715,759,803,847,891,936,981,1026,1072,1117,1162,1208,1254,1301,1347,1394,1441,1488,1535,1582,1629,1675,1722,1769,1816,1863,1910,1958,2005,2053,2100,2148,2195,2242,2290,2337,2385,2432,2480,2528,2576,2624,2672,2720,2768,2817,2865,2913,2961,3009,3057,3105,3154,3203,3252,3300,3349,3398,3446,3495,3544,3593,3641,3690,3739,3788,3836,3885,3934,3983,4031,4080,4129,4177,4226,4275,4324,4372,4421,4470,4518,4567,4616,4664,4713,4761,4810,4859,4907,4956,5005,5053,5102,5151,5199,5245]];
function dpValue(d, t){
  if(t < 0) return t;
  const i = t / 50;                       // i punteggi sono sempre multipli di 50
  if(i > 100 || !DP_VALUE[d]) return t;   // oltre la tabella conviene bancare
  return DP_VALUE[d][i];
}

/* Scelta ottimale dei dadi da tenere per l'Esperto: tra TUTTI i sottoinsiemi
   punteggianti del lancio, sceglie quello che massimizza il valore atteso
   (a volte conviene NON prendere un 5 isolato per tenere più dadi). */
function expertPick(values, turnScore, alreadySet){
  const c = countFaces(values);
  const k = [0,0,0,0,0,0,0];
  let best = null;
  (function pick(face){
    if(face === 7){
      let used = 0; for(let x=1;x<=6;x++) used += k[x];
      if(used === 0) return;
      const g = scoreCounts(k.slice(), used);
      if(g < 0) return; // i dadi tenuti devono fare tutti punti
      const newSet = alreadySet + used;
      const rollDice = (newSet === 6) ? 6 : 6 - newSet; // hot dice → 6
      const value = Math.max(turnScore + g, dpValue(rollDice, turnScore + g));
      if(!best || value > best.value){ best = { keep: k.slice(), score: g, value }; }
      return;
    }
    for(let x=0; x<=c[face]; x++){ k[face] = x; pick(face+1); }
    k[face] = 0;
  })(1);
  const need = best.keep.slice();
  const indices = [];
  for(let i=0;i<values.length;i++){ if(need[values[i]] > 0){ indices.push(i); need[values[i]]--; } }
  return { indices, score: best.score };
}

/* Villain dell'avversario IA (al posto di "CPU · Difficile"): ognuno ha un
   nome, un avatar e un POTERE. I poteri (palette estensibile) scattano solo
   quando il villain è in SVANTAGGIO, e la loro intensità scala col livello,
   così i Facili restano battibili. Tipi: 'save' (evita il Farkle, la firma di
   Sauron), 'luck' (trasforma un dado in un 1), 'bonus' (punti extra al bank). */
const VILLAINS = {
  easy: [
    { name: 'Pinguino',   avatar: 'pinguino',   power: { type: 'bonus', label: 'COLPO BASSO' } },
    { name: 'Gargamella', avatar: 'gargamella', power: { type: 'bonus', label: 'POZIONE MALEFICA' } },
    { name: 'Jafar',      avatar: 'jafar',      power: { type: 'bonus', label: 'MAGIA DI JAFAR' } },
  ],
  medium: [
    { name: 'Joker',  avatar: 'joker',  power: { type: 'luck',  label: 'CAOS!' } },
    { name: 'Loki',   avatar: 'loki',   power: { type: 'bonus', label: 'INGANNO DI LOKI' } },
    { name: 'Ultron', avatar: 'ultron', power: { type: 'luck',  label: 'PROTOCOLLO ULTRON' } },
  ],
  hard: [
    { name: 'Darth Vader', avatar: 'vader',  power: { type: 'luck', label: 'IL LATO OSCURO' } },
    { name: 'Venom',       avatar: 'venom',  power: { type: 'luck', label: 'SIAMO VENOM' } },
    { name: 'Thanos',      avatar: 'thanos', power: { type: 'luck', label: 'INEVITABILE' } },
  ],
  expert: [
    { name: 'Sauron', avatar: 'sauron', power: { type: 'save', label: "IL POTERE DELL'ANELLO" } },
  ],
};
function pickVillain(difficulty){
  const pool = VILLAINS[difficulty] || VILLAINS.medium;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Avatar dei villain (SVG stilizzati, inseriti offline).
const VILLAIN_SVG = {"sauron":"<svg viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#0a0a0a\"/><ellipse cx=\"24\" cy=\"24\" rx=\"18\" ry=\"8.5\" fill=\"#c81e00\"/><ellipse cx=\"24\" cy=\"24\" rx=\"14.5\" ry=\"6.5\" fill=\"#ff7a1a\"/><ellipse cx=\"24\" cy=\"24\" rx=\"10\" ry=\"5\" fill=\"#ffd24a\"/><ellipse cx=\"24\" cy=\"24\" rx=\"2.8\" ry=\"9\" fill=\"#100800\"/></svg>","joker":"<svg viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#5b2a86\"/><ellipse cx=\"13\" cy=\"15\" rx=\"5\" ry=\"7\" fill=\"#2fae4e\"/><ellipse cx=\"35\" cy=\"15\" rx=\"5\" ry=\"7\" fill=\"#2fae4e\"/><ellipse cx=\"24\" cy=\"11\" rx=\"5\" ry=\"6\" fill=\"#2fae4e\"/><circle cx=\"24\" cy=\"26\" r=\"12.5\" fill=\"#eef0e0\"/><circle cx=\"20\" cy=\"24\" r=\"1.7\" fill=\"#222\"/><circle cx=\"28\" cy=\"24\" r=\"1.7\" fill=\"#222\"/><path d=\"M17 29 q7 8 14 0\" stroke=\"#d81e34\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\"/></svg>","loki":"<svg viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#1f6b3a\"/><circle cx=\"24\" cy=\"27\" r=\"9\" fill=\"#f0c98a\"/><path d=\"M15 24 a9 9 0 0 1 18 0 l0 -3 a9 10 0 0 0 -18 0 z\" fill=\"#e8b54a\"/><path d=\"M15 22 q-6 -6 -3 -15 q4 6 6 13z\" fill=\"#e8b54a\"/><path d=\"M33 22 q6 -6 3 -15 q-4 6 -6 13z\" fill=\"#e8b54a\"/><circle cx=\"20\" cy=\"27\" r=\"1.4\" fill=\"#3a2a1a\"/><circle cx=\"28\" cy=\"27\" r=\"1.4\" fill=\"#3a2a1a\"/></svg>","ultron":"<svg viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#33465e\"/><path d=\"M14 15 h20 v13 q0 8 -10 10 q-10 -2 -10 -10 z\" fill=\"#c7ced9\"/><path d=\"M17 21 l6 3 -6 1z\" fill=\"#ff3b3b\"/><path d=\"M31 21 l-6 3 6 1z\" fill=\"#ff3b3b\"/><g stroke=\"#66707e\" stroke-width=\"1\"><line x1=\"20\" y1=\"30\" x2=\"20\" y2=\"35\"/><line x1=\"24\" y1=\"30\" x2=\"24\" y2=\"36\"/><line x1=\"28\" y1=\"30\" x2=\"28\" y2=\"35\"/></g></svg>","vader":"<svg viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#0c0c0c\"/><path d=\"M12 21 a12 12 0 0 1 24 0 v3 q0 11 -12 15 q-12 -4 -12 -15 z\" fill=\"#161616\" stroke=\"#3a3a3a\" stroke-width=\"1\"/><path d=\"M16 23 l6 2 -1 4 -5 -2z\" fill=\"#333\"/><path d=\"M32 23 l-6 2 1 4 5 -2z\" fill=\"#333\"/><rect x=\"20\" y=\"31\" width=\"8\" height=\"6\" rx=\"1\" fill=\"#2a2a2a\"/><g stroke=\"#0c0c0c\" stroke-width=\"0.8\"><line x1=\"22\" y1=\"31\" x2=\"22\" y2=\"37\"/><line x1=\"24\" y1=\"31\" x2=\"24\" y2=\"37\"/><line x1=\"26\" y1=\"31\" x2=\"26\" y2=\"37\"/></g></svg>","venom":"<svg viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#070707\"/><path d=\"M14 19 C18 16 23 20 22.5 24 C18 24.5 14 23.5 14 19Z\" fill=\"#f0f0f0\"/><path d=\"M34 19 C30 16 25 20 25.5 24 C30 24.5 34 23.5 34 19Z\" fill=\"#f0f0f0\"/><path d=\"M13 29 q11 6 22 0 l-2.5 4 -2 -3 -2 3 -2 -3 -2 3 -2 -3 -2 3 -2.5 -4z\" fill=\"#efeff2\"/></svg>","thanos":"<svg viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#6a3ea1\"/><circle cx=\"24\" cy=\"26\" r=\"12\" fill=\"#8b6bd0\"/><path d=\"M12 20 a12 12 0 0 1 24 0 l-3 3 a9 9 0 0 0 -18 0 z\" fill=\"#d9a441\"/><path d=\"M17 23 q7 -2 14 0\" stroke=\"#3f2668\" stroke-width=\"1.8\" fill=\"none\"/><circle cx=\"20\" cy=\"26\" r=\"1.5\" fill=\"#2a1a44\"/><circle cx=\"28\" cy=\"26\" r=\"1.5\" fill=\"#2a1a44\"/><path d=\"M22 34 q2 2 4 0\" stroke=\"#5a3a90\" stroke-width=\"1.4\" fill=\"none\"/></svg>","pinguino":"<svg viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#16273f\"/><circle cx=\"24\" cy=\"28\" r=\"9\" fill=\"#f0d9c0\"/><rect x=\"14\" y=\"9\" width=\"20\" height=\"3.5\" rx=\"1\" fill=\"#111\"/><rect x=\"18\" y=\"1\" width=\"12\" height=\"8\" fill=\"#111\"/><path d=\"M24 27 l5 3 -5 1z\" fill=\"#d9a066\"/><circle cx=\"20\" cy=\"27\" r=\"1.4\" fill=\"#222\"/><circle cx=\"29\" cy=\"27\" r=\"3.6\" fill=\"none\" stroke=\"#e8c24a\" stroke-width=\"1.3\"/></svg>","gargamella":"<svg viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#3a2a18\"/><circle cx=\"24\" cy=\"23\" r=\"10.5\" fill=\"#e8c9a0\"/><path d=\"M24 20 q4.5 4 1 8 q-3 0 -3 -2z\" fill=\"#d9b083\"/><path d=\"M17 18 l5 2M31 18 l-5 2\" stroke=\"#2a2a2a\" stroke-width=\"2\"/><circle cx=\"20\" cy=\"21\" r=\"1.3\" fill=\"#222\"/><circle cx=\"28\" cy=\"21\" r=\"1.3\" fill=\"#222\"/><path d=\"M20 31 q4 6 8 0 q-4 3 -8 0z\" fill=\"#2a2a2a\"/></svg>","jafar":"<svg viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"24\" cy=\"24\" r=\"24\" fill=\"#5a1220\"/><circle cx=\"24\" cy=\"27\" r=\"8\" fill=\"#d9b58a\"/><path d=\"M13 19 a11 10 0 0 1 22 0 q-11 -6 -22 0z\" fill=\"#111\"/><ellipse cx=\"24\" cy=\"14\" rx=\"11\" ry=\"4\" fill=\"#7a1a2a\"/><path d=\"M24 13 q1 -8 3.5 -9.5 q-1.5 6 -1 9.5z\" fill=\"#e8c24a\"/><circle cx=\"24\" cy=\"13\" r=\"1.7\" fill=\"#e8c24a\"/><path d=\"M18 24 l4 1M30 24 l-4 1\" stroke=\"#1a1a1a\" stroke-width=\"1.6\"/><path d=\"M24 31 l-1.2 6 2.4 0z\" fill=\"#1a1a1a\"/></svg>"};

/* Poteri dei villain: scattano solo se il villain è in svantaggio; intensità
   crescente col livello. Tarati via simulazione (Facile resta < 50%). */
const POWER_INTENSITY = { easy: 0.15, medium: 0.35, hard: 0.55, expert: 0.70 };
const POWER_BONUS = 150;          // punti extra del potere 'bonus'
const POWER_MAX_USES = 2;         // usi massimi per turno di un potere

// Probabilità che il potere scatti ora (0 se il villain è pari o in vantaggio).
function powerChance(){
  const cpu = state.players[1];
  if(!cpu || !cpu.power) return 0;
  const gap = state.players[0].total - cpu.total; // umano − villain
  if(gap <= 0) return 0;
  const intensity = POWER_INTENSITY[state.difficulty] || 0;
  return intensity * Math.min(1, gap / (state.target * 0.30));
}
// 'luck': trasforma un dado non-punteggiante (2/3/4/6) in un 1.
function applyLuck(activeDice){
  for(const d of activeDice){
    if(d.value === 2 || d.value === 3 || d.value === 4 || d.value === 6){ d.value = 1; return true; }
  }
  return false;
}
// 'save': rilancia i dadi finché non fanno punti (evita il Farkle).
function ringReroll(activeDice){
  let values;
  do {
    for(const d of activeDice){ d.value = 1 + Math.floor(Math.random() * 6); }
    values = activeDice.map(d => d.value);
  } while(!hasAnyScore(values));
}

/* =========================================================
   PERSONALIZZAZIONE — avatar e temi dado (estensibili)
   Per aggiungerne di nuovi in futuro basta inserire una voce
   in AVATARS o in DICE_THEMES: il resto del codice si adatta da solo.
   ========================================================= */

// --- Avatar (SVG inline, nessun file esterno) ---
const AVATARS = {
  male: {
    label: 'Uomo', selectable: true,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="avM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa0ff"/><stop offset="1" stop-color="#2b5bd7"/></linearGradient></defs><circle cx="24" cy="24" r="24" fill="url(#avM)"/><path d="M10 42 c0-8 6-12 14-12 s14 4 14 12 z" fill="#e9ecff"/><circle cx="24" cy="20" r="9" fill="#ffd9b3"/><path d="M15 19 a9 9 0 0 1 18 0 c0-6-4-9-9-9 s-9 3-9 9z" fill="#43321f"/></svg>`,
  },
  female: {
    label: 'Donna', selectable: true,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="avF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9ad1"/><stop offset="1" stop-color="#c64bb0"/></linearGradient></defs><circle cx="24" cy="24" r="24" fill="url(#avF)"/><rect x="13" y="12" width="22" height="29" rx="11" fill="#5b3322"/><path d="M11 42 c0-8 6-12 13-12 s13 4 13 12 z" fill="#fbe7f4"/><circle cx="24" cy="20" r="8.5" fill="#ffd9b3"/><path d="M15 19 a9 9 0 0 1 18 0 c0-6-4-9-9-9 s-9 3-9 9z" fill="#5b3322"/></svg>`,
  },
  cpu: {
    label: 'CPU', selectable: false,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="avC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7390"/><stop offset="1" stop-color="#3a3f63"/></linearGradient></defs><circle cx="24" cy="24" r="24" fill="url(#avC)"/><line x1="24" y1="9" x2="24" y2="14" stroke="#cfd4ee" stroke-width="2"/><circle cx="24" cy="8" r="2.5" fill="#ffb020"/><rect x="12" y="14" width="24" height="20" rx="6" fill="#e9ecff"/><circle cx="19" cy="23" r="3" fill="#2b5bd7"/><circle cx="29" cy="23" r="3" fill="#2b5bd7"/><rect x="18" y="29" width="12" height="2.5" rx="1.25" fill="#9aa0c8"/></svg>`,
  },
};

// --- Temi dado: definiscono corpo e pallini. ---
const PIP_DARK  = 'radial-gradient(circle at 35% 30%,#3a3f63,#15182e)';
const PIP_LIGHT = 'radial-gradient(circle at 35% 30%,#ffffff,#dfe4ff)';
const DICE_THEMES = {
  classic: { name: 'Classico', accent: '#c9cee8', body: 'linear-gradient(145deg,#fdfdff,#d9ddf0)', pip: PIP_DARK },
  rosso:   { name: 'Rosso',    accent: '#e63b5e', body: 'linear-gradient(145deg,#ff6b6b,#c81d4a)', pip: PIP_LIGHT },
  blu:     { name: 'Blu',      accent: '#3b7bea', body: 'linear-gradient(145deg,#5aa0ff,#2b5bd7)', pip: PIP_LIGHT },
  viola:   { name: 'Viola',    accent: '#7b4ff0', body: 'linear-gradient(145deg,#b07cff,#6a3df0)', pip: PIP_LIGHT },
  oro:     { name: 'Oro',      accent: '#eaa12a', body: 'linear-gradient(145deg,#ffd766,#e8932a)', pip: 'radial-gradient(circle at 35% 30%,#5a3a00,#2a1a00)' },
  notte:   { name: 'Notte',    accent: '#4a5286', body: 'linear-gradient(145deg,#2b3157,#12152b)', pip: PIP_LIGHT },
};

// Applica un tema dado impostando le variabili CSS a livello di documento.
function applyDiceTheme(id){
  const t = DICE_THEMES[id] || DICE_THEMES.classic;
  const r = document.documentElement.style;
  r.setProperty('--die-body', t.body);
  r.setProperty('--die-pip', t.pip);
}

// --- Preferenze persistenti (avatar + tema) ---
const PREFS_KEY = 'farkle.prefs.v1';
const prefs = { avatar: 'male', dice: 'classic' };
function loadPrefs(){
  try {
    const s = localStorage.getItem(PREFS_KEY);
    if(s){
      const o = JSON.parse(s);
      if(AVATARS[o.avatar] && AVATARS[o.avatar].selectable) prefs.avatar = o.avatar;
      if(DICE_THEMES[o.dice]) prefs.dice = o.dice;
    }
  } catch(e){ /* localStorage non disponibile: si usano i default */ }
}
function savePrefs(){
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch(e){}
  scheduleCloudSync();
}

/* --- Storico vittorie: due archivi separati (multi/single), ultime 10 ognuno,
   più recente in cima. La chiave 'multi' resta 'farkle.history.v1' per non
   perdere lo storico già salvato dagli utenti. --- */
const HISTORY_KEYS = { multi: 'farkle.history.v1', single: 'farkle.history.single.v1' };
const HISTORY_MAX = 10;

function loadHistory(kind){
  try {
    const s = localStorage.getItem(HISTORY_KEYS[kind]);
    const arr = s ? JSON.parse(s) : [];
    return Array.isArray(arr) ? arr : [];
  } catch(e){ return []; }
}
function saveHistory(kind, arr){
  try { localStorage.setItem(HISTORY_KEYS[kind], JSON.stringify(arr)); } catch(e){}
  scheduleCloudSync();
}
// inserisce una nuova partita in testa e mantiene solo le ultime HISTORY_MAX
function recordMatch(kind, entry){
  const arr = loadHistory(kind);
  arr.unshift(entry);
  saveHistory(kind, arr.slice(0, HISTORY_MAX));
}
function clearHistory(kind){ saveHistory(kind, []); }

/* =========================================================
   POTERI DELL'EROE (progressione a strisce di vittorie)
   Ogni 5 vittorie consecutive a una difficoltà si guadagna una carica del
   suo potere (cumulabile, con tetto). Con una striscia da 5 su TUTTE e 4 le
   difficoltà si ottiene il Super potere (non cumulabile). Le cariche valgono
   per qualsiasi partita. Limite di sicurezza: 1 potere usato per partita.
   ========================================================= */
const HERO_POWERS = {
  double: { label: 'Punti Doppi',       icon: '×2', desc: 'Raddoppia i punti quando metti al sicuro.' },
  change: { label: 'Cambia Dado',       icon: '⟳',  desc: 'Imposta un dado sul valore che vuoi.' },
  shield: { label: 'Scudo',             icon: '⛨',  desc: 'Annulla il prossimo Farkle del turno.' },
  reroll: { label: 'Rilancio Fortunato', icon: '✦', desc: 'Il prossimo lancio non può fare Farkle.' },
  super:  { label: "Colpo dell'Eroe",   icon: '★',  desc: 'Un turno intero: niente Farkle e punti doppi.' },
};
const POWER_FROM = { easy: 'double', medium: 'change', hard: 'shield', expert: 'reroll' };
const STREAK_STEP = 5;   // vittorie consecutive per una carica
const CHARGE_CAP = 5;    // tetto cariche per potere
const HERO_KEY = 'farkle.hero.v1';

const hero = {
  streak:    { easy: 0, medium: 0, hard: 0, expert: 0 },
  charges:   { double: 0, change: 0, shield: 0, reroll: 0, super: 0 },
  superFlag: { easy: false, medium: false, hard: false, expert: false },
};
function loadHero(){
  try {
    const s = localStorage.getItem(HERO_KEY);
    if(s){ const o = JSON.parse(s);
      Object.assign(hero.streak, o.streak || {});
      Object.assign(hero.charges, o.charges || {});
      Object.assign(hero.superFlag, o.superFlag || {});
    }
  } catch(e){}
}
function saveHero(){ try { localStorage.setItem(HERO_KEY, JSON.stringify(hero)); } catch(e){} scheduleCloudSync(); }

/* =========================================================
   SALVATAGGIO CLOUD (Supabase Auth email/password + tabella 'saves')
   Facoltativo: se non configurato o offline, il gioco resta in locale.
   ========================================================= */
let sb = null;
try {
  if(window.supabase && SUPABASE_ANON_KEY){
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch(e){ sb = null; }

let currentUser = null;   // utente Supabase loggato (o null)
let syncSuppressed = false;
let syncTimer = null;

function cloudEnabled(){ return !!sb; }

// Raccoglie tutti i dati da sincronizzare (progressi + preferenze + storico).
function gatherSaveData(){
  return {
    v: 1,
    hero: { streak: hero.streak, charges: hero.charges, superFlag: hero.superFlag },
    prefs: { avatar: prefs.avatar, dice: prefs.dice },
    history: { single: loadHistory('single'), multi: loadHistory('multi') },
  };
}
// Applica i dati arrivati dal cloud allo stato locale (senza ri-sincronizzare).
function applySaveData(d){
  if(!d) return;
  syncSuppressed = true;
  try {
    if(d.hero){
      Object.assign(hero.streak, d.hero.streak || {});
      Object.assign(hero.charges, d.hero.charges || {});
      Object.assign(hero.superFlag, d.hero.superFlag || {});
      saveHero();
    }
    if(d.prefs){
      if(AVATARS[d.prefs.avatar] && AVATARS[d.prefs.avatar].selectable) prefs.avatar = d.prefs.avatar;
      if(DICE_THEMES[d.prefs.dice]) prefs.dice = d.prefs.dice;
      savePrefs();
      applyDiceTheme(prefs.dice);
    }
    if(d.history){
      if(Array.isArray(d.history.single)) saveHistory('single', d.history.single);
      if(Array.isArray(d.history.multi))  saveHistory('multi',  d.history.multi);
    }
  } finally { syncSuppressed = false; }
}

// Programma un salvataggio nel cloud (debounce), se loggato.
function scheduleCloudSync(){
  if(!sb || !currentUser || syncSuppressed) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushCloud, 800);
}
async function pushCloud(){
  if(!sb || !currentUser) return;
  try {
    await sb.from('saves').upsert({
      id: currentUser.id, data: gatherSaveData(), updated_at: new Date().toISOString(),
    });
  } catch(e){}
}
async function pullCloud(){
  if(!sb || !currentUser) return;
  try {
    const { data, error } = await sb.from('saves').select('data').eq('id', currentUser.id).maybeSingle();
    if(!error && data && data.data) applySaveData(data.data);
    else if(!error && !data) await pushCloud(); // primo accesso: carica i progressi locali
  } catch(e){}
  updateHeroButton();
  if(screens.single && screens.single.classList.contains('active')) buildHeroProgress();
}

/* ---- Autenticazione email/password ---- */
async function authSignUp(email, pass){
  const { data, error } = await sb.auth.signUp({ email, password: pass });
  if(error) return { ok: false, msg: traduciAuthErr(error.message) };
  if(data.session) return { ok: true };
  return { ok: true, msg: 'Registrazione avviata: controlla la tua email per confermare.' };
}
async function authSignIn(email, pass){
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if(error) return { ok: false, msg: traduciAuthErr(error.message) };
  return { ok: true };
}
async function authSignOut(){ try { await sb.auth.signOut(); } catch(e){} currentUser = null; }

// Invia l'email di reimpostazione password (link che riporta al gioco).
async function authResetPassword(email){
  const redirectTo = location.origin + location.pathname; // torna a questa pagina
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if(error) return { ok: false, msg: traduciAuthErr(error.message) };
  return { ok: true };
}
// Imposta la nuova password (dopo essere tornati dal link di recupero).
async function authUpdatePassword(newPass){
  const { error } = await sb.auth.updateUser({ password: newPass });
  if(error) return { ok: false, msg: traduciAuthErr(error.message) };
  return { ok: true };
}
let recoveryMode = false; // true quando si torna dal link "password dimenticata"

function traduciAuthErr(m){
  m = (m || '').toLowerCase();
  if(m.includes('invalid login')) return 'Email o password non corretti.';
  if(m.includes('already registered')) return 'Email già registrata: prova ad accedere.';
  if(m.includes('password')) return 'Password troppo corta (almeno 6 caratteri).';
  if(m.includes('email')) return 'Email non valida.';
  return 'Errore: ' + m;
}

// Avvia l'auth all'apertura: riprende la sessione e registra i cambi di stato.
async function initAuth(){
  if(!sb) return;
  try {
    const { data } = await sb.auth.getSession();
    currentUser = data && data.session ? data.session.user : null;
    updateAccountHint();
    if(currentUser) await pullCloud();
    sb.auth.onAuthStateChange((event, session) => {
      currentUser = session ? session.user : null;
      if(event === 'PASSWORD_RECOVERY'){
        // l'utente è tornato dal link dell'email: chiedi la nuova password
        recoveryMode = true;
        buildAuthScreen();
        showScreen('auth');
        return;
      }
      if(currentUser) pullCloud();
      if(screens.auth && screens.auth.classList.contains('active')) buildAuthScreen();
      updateAccountHint();
      updateHeroButton();
    });
  } catch(e){}
}

/* Aggiorna la progressione a fine partita single. Ritorna la lista dei poteri
   guadagnati (per la notifica a schermo), oppure []. */
function updateHeroProgress(won){
  const d = state.difficulty;
  const earned = [];
  if(won){
    hero.streak[d]++;
    if(hero.streak[d] % STREAK_STEP === 0){
      const pk = POWER_FROM[d];
      if(hero.charges[pk] < CHARGE_CAP){ hero.charges[pk]++; earned.push(pk); }
      hero.superFlag[d] = true;
      if(hero.superFlag.easy && hero.superFlag.medium && hero.superFlag.hard && hero.superFlag.expert){
        if(hero.charges.super < 1){ hero.charges.super = 1; earned.push('super'); }
        hero.superFlag = { easy: false, medium: false, hard: false, expert: false };
      }
    }
  } else {
    hero.streak[d] = 0;
  }
  saveHero();
  return earned;
}

function formatDate(ts){
  try {
    const d = new Date(ts);
    const day = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${time}`;
  } catch(e){ return ''; }
}

/* ---------- Motore di punteggio ---------- */

// Conta le occorrenze di ogni faccia (indici 1..6).
function countFaces(values){
  const c = [0,0,0,0,0,0,0];
  for(const v of values) c[v]++;
  return c;
}

// Tre coppie: 6 dadi i cui conteggi sono tutti pari (es. 2-2-2, 4-2, 6).
function isThreePairs(counts, total){
  if(total !== 6) return false;
  for(let f=1; f<=6; f++){
    if(counts[f] % 2 !== 0) return false;
  }
  return true;
}

// Scala completa 1-2-3-4-5-6.
function isStraight(counts, total){
  if(total !== 6) return false;
  for(let f=1; f<=6; f++){
    if(counts[f] !== 1) return false;
  }
  return true;
}

/* Punteggio massimo di una selezione che DEVE consumare tutti i dadi
   passati. Ritorna -1 se i dadi non formano una combinazione valida
   (cioè restano dadi non punteggianti). */
function bestScore(values){
  const total = values.length;
  return scoreCounts(countFaces(values), total);
}

function scoreCounts(counts, total){
  if(total === 0) return 0;

  let best = -1;

  // Combinazioni che usano tutti e 6 i dadi.
  if(total === 6){
    if(isStraight(counts, total)) best = Math.max(best, 1000);
    if(isThreePairs(counts, total)) best = Math.max(best, 750);
  }

  // Prova a togliere una tripla di una faccia qualsiasi.
  for(let f=1; f<=6; f++){
    if(counts[f] >= 3){
      counts[f] -= 3;
      const sub = scoreCounts(counts, total - 3);
      counts[f] += 3;
      if(sub >= 0){
        const triple = (f === 1) ? 1000 : f * 100;
        best = Math.max(best, triple + sub);
      }
    }
  }

  // Prova a togliere un singolo 1 (100 pt).
  if(counts[1] >= 1){
    counts[1] -= 1;
    const sub = scoreCounts(counts, total - 1);
    counts[1] += 1;
    if(sub >= 0) best = Math.max(best, 100 + sub);
  }

  // Prova a togliere un singolo 5 (50 pt).
  if(counts[5] >= 1){
    counts[5] -= 1;
    const sub = scoreCounts(counts, total - 1);
    counts[5] += 1;
    if(sub >= 0) best = Math.max(best, 50 + sub);
  }

  return best;
}

// Esiste almeno una combinazione punteggiante nel lancio? (rileva il Farkle)
function hasAnyScore(values){
  const total = values.length;
  const c = countFaces(values);
  if(c[1] > 0 || c[5] > 0) return true;
  for(let f=1; f<=6; f++) if(c[f] >= 3) return true;
  if(isStraight(c, total)) return true;
  if(isThreePairs(c, total)) return true;
  return false;
}

/* Per l'IA: estrae TUTTI i dadi punteggianti dal lancio e il relativo
   punteggio. Ritorna {indices, score}. */
function greedyScoringSelection(values){
  const total = values.length;
  const c = countFaces(values);
  const usedFaces = [0,0,0,0,0,0,0]; // quante occorrenze di ogni faccia usare
  let score = 0;

  if(isStraight(c, total)){
    return { indices: values.map((_,i)=>i), score: 1000 };
  }
  if(isThreePairs(c, total)){
    // confronta con la somma di singoli per scegliere il massimo
    let singles = c[1]*100 + c[5]*50;
    if(750 >= singles){
      return { indices: values.map((_,i)=>i), score: 750 };
    }
  }

  // Triple (incl. multiple dello stesso valore per 6-of-a-kind).
  for(let f=1; f<=6; f++){
    while(c[f] - usedFaces[f] >= 3){
      usedFaces[f] += 3;
      score += (f === 1) ? 1000 : f * 100;
    }
  }
  // Singoli rimanenti 1 e 5.
  const ones = c[1] - usedFaces[1];
  const fives = c[5] - usedFaces[5];
  score += ones * 100;
  score += fives * 50;
  usedFaces[1] += ones;
  usedFaces[5] += fives;

  // Costruisci la lista di indici corrispondenti.
  const need = usedFaces.slice();
  const indices = [];
  for(let i=0; i<values.length; i++){
    const v = values[i];
    if(need[v] > 0){ indices.push(i); need[v]--; }
  }
  return { indices, score };
}

/* Per l'IA "pigra" (livelli facili): prende UNA sola combinazione
   punteggiante (la migliore tra una tripla e un singolo), lasciando punti
   sul tavolo. Ritorna {indices, score}. Se non esiste un singolo/tripla
   (caso raro: solo tre coppie senza 1/5), ricade sulla selezione completa. */
function lazyScoringSelection(values){
  const c = countFaces(values);
  let pickFaces = null;   // facce da prendere
  let score = 0;

  // miglior tripla disponibile
  for(let f=6; f>=1; f--){
    if(c[f] >= 3){
      const val = (f === 1) ? 1000 : f * 100;
      if(val > score){ score = val; pickFaces = [f, f, f]; }
      break;
    }
  }
  // confronta con un singolo 1 (100)
  if(c[1] >= 1 && 100 > score){ score = 100; pickFaces = [1]; }
  // un singolo 5 (50) solo se nulla di meglio
  if(c[5] >= 1 && 50 > score){ score = 50; pickFaces = [5]; }

  if(!pickFaces) return greedyScoringSelection(values); // fallback (tre coppie)

  const need = [0,0,0,0,0,0,0];
  for(const f of pickFaces) need[f]++;
  const indices = [];
  for(let i=0; i<values.length; i++){
    if(need[values[i]] > 0){ indices.push(i); need[values[i]]--; }
  }
  return { indices, score };
}

/* ---------- Stato del gioco ---------- */

const state = {
  mode: 'single',          // 'single' | 'multi'
  target: 10000,           // punteggio per vincere (scelto dal giocatore)
  difficulty: 'medium',    // 'easy' | 'medium' | 'hard' (scelta indipendente)
  players: [],             // [{name,total}, ...]
  current: 0,
  turnScore: 0,
  dice: [],                // 6 oggetti {value, status:'out'|'active'|'set', selected}
  phase: 'roll',           // 'roll' = serve lanciare | 'action' = dadi in tavolo
  busy: false,             // blocca input durante animazioni / turno IA
  running: false,          // true durante una partita; ferma i callback dopo l'uscita
  saveUsed: 0,             // usi del potere 'save' nel turno corrente
  luckUsed: 0,             // usi del potere 'luck' nel turno corrente
  bonusUsed: false,        // potere 'bonus' già usato nel turno corrente
  // --- poteri dell'eroe attivi (giocatore umano) ---
  heroDouble: false,       // raddoppia i punti al bank
  heroShield: false,       // annulla il prossimo Farkle
  heroLucky: false,        // prossimo lancio senza Farkle
  heroSuper: false,        // turno "Colpo dell'Eroe" (no Farkle + doppio)
  heroChangeValue: 0,      // valore scelto per "Cambia Dado" (0 = non attivo)
  heroUsedThisMatch: false,// un solo potere per partita
  finalRound: false,
  finalStarter: -1,
  gameOver: false,
};

/* ---------- Riferimenti DOM ---------- */

const screens = {
  menu:    document.getElementById('screen-menu'),
  single:  document.getElementById('screen-single'),
  auth:    document.getElementById('screen-auth'),
  rules:   document.getElementById('screen-rules'),
  setup:   document.getElementById('screen-setup'),
  custom:  document.getElementById('screen-custom'),
  history: document.getElementById('screen-history'),
  game:    document.getElementById('screen-game'),
  over:    document.getElementById('screen-over'),
};

const diceEl    = document.getElementById('dice');
const bannerEl  = document.getElementById('banner');
const messageEl = document.getElementById('message');
const turnScoreEl = document.getElementById('turn-score');
const selScoreEl  = document.getElementById('sel-score');
const tiNameEl    = document.getElementById('ti-name');
const btnRoll = document.getElementById('btn-roll');
const btnBank = document.getElementById('btn-bank');

let dieNodes = []; // i 6 nodi DOM dei dadi

/* ---------- Navigazione schermate ---------- */

function showScreen(name){
  for(const k in screens) screens[k].classList.remove('active');
  screens[name].classList.add('active');
}

/* ---------- Costruzione dadi ---------- */

function buildDice(){
  diceEl.innerHTML = '';
  dieNodes = [];
  for(let i=0; i<NUM_DICE; i++){
    const d = document.createElement('div');
    d.className = 'die out';
    d.dataset.index = i;
    d.addEventListener('click', () => onDieTap(i));
    diceEl.appendChild(d);
    dieNodes.push(d);
  }
}

function renderPips(node, value){
  node.innerHTML = '';
  for(let p=0; p<value; p++){
    const pip = document.createElement('span');
    pip.className = 'pip';
    node.appendChild(pip);
  }
}

function renderDice(animateActive){
  for(let i=0; i<NUM_DICE; i++){
    const die = state.dice[i];
    const node = dieNodes[i];
    node.className = 'die';
    if(die.status === 'out'){
      node.classList.add('out');
      node.innerHTML = '';
      node.removeAttribute('data-face');
      continue;
    }
    node.dataset.face = die.value;
    renderPips(node, die.value);
    if(die.status === 'set'){
      node.classList.add('locked');
    } else { // active
      if(die.selected) node.classList.add('selected');
      if(animateActive) node.classList.add('rolling');
    }
  }
}

/* ---------- Avvio partita ---------- */

// players: array di { name, avatar, dice }
function startGame(mode, players){
  state.mode = mode;
  state.players = players.map(p => ({
    name: p.name, total: 0,
    avatar: p.avatar || 'male',
    dice: DICE_THEMES[p.dice] ? p.dice : 'classic',
    power: p.power || null,
  }));
  state.current = 0;
  state.finalRound = false;
  state.finalStarter = -1;
  state.gameOver = false;
  state.busy = false;
  state.running = true;
  state.heroUsedThisMatch = false;

  // header: nomi e avatar (con anello del colore dadi del giocatore)
  document.getElementById('pc-name-0').textContent = state.players[0].name;
  document.getElementById('pc-name-1').textContent = state.players[1].name;
  setAvatar('pc-av-0', state.players[0].avatar, DICE_THEMES[state.players[0].dice].accent);
  setAvatar('pc-av-1', state.players[1].avatar, DICE_THEMES[state.players[1].dice].accent);
  document.getElementById('goal-value').textContent = formatNum(state.target);

  buildDice();
  showScreen('game');
  beginTurn();
}

function setAvatar(elId, avatarId, ringColor){
  const svg = (AVATARS[avatarId] && AVATARS[avatarId].svg) || VILLAIN_SVG[avatarId] || AVATARS.male.svg;
  const el = document.getElementById(elId);
  el.innerHTML = svg;
  el.style.boxShadow = ringColor ? `0 0 0 2px ${ringColor}` : 'none';
}

function beginTurn(){
  state.busy = false;
  state.turnScore = 0;
  state.saveUsed = 0;
  state.luckUsed = 0;
  state.bonusUsed = false;
  // i poteri "armati" non si trascinano tra i turni
  state.heroDouble = false;
  state.heroShield = false;
  state.heroLucky = false;
  state.heroSuper = false;
  state.heroChangeValue = 0;
  state.phase = 'roll';
  // applica il tema dado del giocatore di turno (colori indipendenti)
  applyDiceTheme(state.players[state.current].dice);
  state.dice = [];
  for(let i=0; i<NUM_DICE; i++){
    state.dice.push({ value: 1, status: 'out', selected: false });
  }
  renderDice(false);
  updateHud();
  hideBanner();

  const p = state.players[state.current];
  const isCPU = (state.mode === 'single' && state.current === 1);

  let msg;
  if(state.mode === 'multi'){
    msg = `Passa il telefono a ${p.name}. Premi «Lancia Dadi».`;
  } else if(isCPU){
    msg = `Turno di ${p.name}...`;
  } else {
    msg = `Tocca a te, ${p.name}. Premi «Lancia Dadi».`;
  }
  setMessage(msg, '');

  if(state.finalRound){
    setMessage(`Ultimo turno! ${p.name}, supera il punteggio più alto.`, 'warn');
  }

  highlightActivePlayer();

  if(isCPU){
    state.busy = true;
    setButtons();
    setTimeout(cpuTurn, 900);
  } else {
    setButtons();
  }
}

function highlightActivePlayer(){
  document.getElementById('card-p0').classList.toggle('active', state.current === 0);
  document.getElementById('card-p1').classList.toggle('active', state.current === 1);
  tiNameEl.textContent = state.players[state.current].name;
}

/* ---------- HUD ---------- */

function updateHud(){
  document.getElementById('pc-total-0').textContent = formatNum(state.players[0].total);
  document.getElementById('pc-total-1').textContent = formatNum(state.players[1].total);
  turnScoreEl.textContent = formatNum(state.turnScore);
  selScoreEl.textContent = formatNum(currentSelectionScore());
}

function formatNum(n){ return n.toLocaleString('it-IT'); }

function setMessage(text, cls){
  messageEl.textContent = text;
  messageEl.className = 'message' + (cls ? ' ' + cls : '');
}

function selectedValues(){
  return state.dice.filter(d => d.status === 'active' && d.selected).map(d => d.value);
}

function currentSelectionScore(){
  const sel = selectedValues();
  if(sel.length === 0) return 0;
  const s = bestScore(sel);
  return s < 0 ? 0 : s;
}

function selectionIsValid(){
  const sel = selectedValues();
  if(sel.length === 0) return false;
  return bestScore(sel) > 0;
}

/* ---------- Pulsanti ---------- */

function setButtons(){
  const human = !(state.mode === 'single' && state.current === 1);
  const enabled = human && !state.busy && !state.gameOver;
  btnRoll.disabled = !enabled;
  btnBank.disabled = !enabled;
  // testo del pulsante lancia
  if(state.phase === 'roll'){
    btnRoll.textContent = 'Lancia Dadi';
  } else {
    btnRoll.textContent = 'Rilancia';
  }
  updateHeroButton();
}

/* ---------- Interazione dadi ---------- */

function onDieTap(i){
  if(state.busy || state.gameOver) return;
  if(state.mode === 'single' && state.current === 1) return; // turno IA
  const die = state.dice[i];
  if(die.status !== 'active') return;

  // POTERE EROE 'Cambia Dado': imposta il dado toccato sul valore scelto
  if(state.heroChangeValue > 0){
    if(!state.heroUsedThisMatch && hero.charges.change > 0){
      die.value = state.heroChangeValue;
      state.heroChangeValue = 0;
      hero.charges.change--;
      state.heroUsedThisMatch = true;
      saveHero();
      renderDice(false);
      updateHud();
      showBanner('CAMBIA DADO', 'hero');
      setMessage('Dado impostato!', 'good');
      return;
    }
    state.heroChangeValue = 0; // non più valido: prosegui come selezione normale
  }

  die.selected = !die.selected;
  renderDice(false);
  // feedback se selezione non valida
  updateHud();
  if(selectedValues().length > 0 && !selectionIsValid()){
    setMessage('Selezione non valida: scegli solo dadi che fanno punti.', 'warn');
  } else if(selectionIsValid()){
    setMessage(`Selezione: ${formatNum(currentSelectionScore())} punti.`, 'good');
  } else {
    setMessage('Seleziona i dadi che fanno punti.', '');
  }
}

/* ---------- Commit della selezione ---------- */

function commitSelection(){
  // mette da parte i dadi selezionati, aggiunge i punti, rilascia gli altri
  if(!selectionIsValid()) return false;
  const pts = currentSelectionScore();
  state.turnScore += pts;
  for(const d of state.dice){
    if(d.status === 'active'){
      if(d.selected){ d.status = 'set'; d.selected = false; }
      else { d.status = 'out'; } // verrà rilanciato
    }
  }
  return true;
}

function setCount(){ return state.dice.filter(d => d.status === 'set').length; }
function activeCount(){ return state.dice.filter(d => d.status === 'active').length; }

/* ---------- Azione: Lancia / Rilancia ---------- */

function onRoll(){
  if(state.busy || state.gameOver) return;

  // Se ci sono dadi attivi devo prima validare e fissare la selezione.
  if(activeCount() > 0){
    if(selectedValues().length === 0){
      setMessage('Seleziona almeno un dado che fa punti prima di rilanciare.', 'warn');
      return;
    }
    if(!selectionIsValid()){
      setMessage('Selezione non valida: scegli solo dadi che fanno punti.', 'bad');
      return;
    }
    commitSelection();
  }

  // Hot Dice: se tutti e 6 i dadi sono stati usati, si rilanciano tutti.
  if(setCount() === NUM_DICE){
    for(const d of state.dice) d.status = 'out';
    showBanner('HOT DICE!', 'hot');
    setMessage('Tutti i dadi usati! Rilanci tutti e 6.', 'good');
  }

  doRoll();
}

/* Animazione di lancio: i dadi "rotolano" cambiando faccia rapidamente,
   poi si fermano sui valori reali. Al termine richiama done(). */
function animateRoll(done){
  const rolling = [];
  state.dice.forEach((d, i) => { if(d.status === 'active') rolling.push(i); });

  renderDice(true); // applica la classe 'tumble' e mostra i dadi

  let ticks = 0;
  const TOTAL = 7;          // numero di cambi-faccia durante il rotolamento
  const iv = setInterval(() => {
    ticks++;
    if(ticks < TOTAL){
      for(const i of rolling){
        const rnd = 1 + Math.floor(Math.random() * 6);
        dieNodes[i].dataset.face = rnd;
        renderPips(dieNodes[i], rnd);
      }
    } else {
      clearInterval(iv);
      for(const i of rolling){      // assesta sui valori reali
        const d = state.dice[i];
        dieNodes[i].dataset.face = d.value;
        renderPips(dieNodes[i], d.value);
      }
      done();
    }
  }, 60);
}

function doRoll(){
  state.busy = true;
  setButtons();

  // assegna valori casuali ai dadi 'out'
  for(const d of state.dice){
    if(d.status === 'out'){
      d.value = 1 + Math.floor(Math.random() * 6);
      d.status = 'active';
      d.selected = false;
    }
  }
  // POTERI EROE 'reroll'/'super': garantiscono un lancio che fa punti
  if(state.heroLucky || state.heroSuper){
    const rolled = state.dice.filter(d => d.status === 'active');
    let guard = 0;
    while(!hasAnyScore(rolled.map(d => d.value)) && guard++ < 300){
      for(const d of rolled){ d.value = 1 + Math.floor(Math.random() * 6); }
    }
    if(state.heroLucky){ state.heroLucky = false; }
  }

  state.phase = 'action';
  updateHud();

  animateRoll(() => {
    if(!state.running) return; // uscita dalla partita durante l'animazione
    const activeDice = state.dice.filter(d => d.status === 'active');
    if(!hasAnyScore(activeDice.map(d => d.value))){
      // POTERE EROE 'shield': annulla il Farkle rilanciando in salvo
      if(state.heroShield){
        state.heroShield = false;
        ringReroll(activeDice);
        showBanner('SCUDO', 'hero');
        renderDice(true);
        updateHud();
        setTimeout(() => {
          if(!state.running) return;
          state.busy = false;
          setMessage('Scudo! Seleziona i dadi che fanno punti.', 'good');
          setButtons();
        }, 750);
        return;
      }
      handleFarkle();
    } else {
      state.busy = false;
      const human = !(state.mode === 'single' && state.current === 1);
      if(human){
        setMessage('Seleziona i dadi che fanno punti.', '');
        setButtons();
      }
    }
  });
}

/* ---------- Farkle ---------- */

function handleFarkle(){
  // segnala i dadi non punteggianti
  for(const d of state.dice){
    if(d.status === 'active') dieNodes[state.dice.indexOf(d)].classList.add('nopoint');
  }
  showBanner('FARKLE!', 'farkle');
  setMessage(`Nessun punto! ${state.players[state.current].name} perde ${formatNum(state.turnScore)} punti del turno.`, 'bad');
  state.turnScore = 0;
  updateHud();
  state.busy = true;
  setButtons();
  setTimeout(endTurn, 1700);
}

/* ---------- Azione: Metti al Sicuro ---------- */

function onBank(){
  if(state.busy || state.gameOver) return;

  // se c'è una selezione attiva valida, la fisso prima di bancare
  if(activeCount() > 0 && selectedValues().length > 0){
    if(!selectionIsValid()){
      setMessage('Selezione non valida: correggi prima di mettere al sicuro.', 'bad');
      return;
    }
    commitSelection();
  }

  if(state.turnScore <= 0){
    setMessage('Devi prima fare punti per mettere al sicuro.', 'warn');
    return;
  }

  bankAndEnd();
}

function bankAndEnd(){
  const p = state.players[state.current];
  // POTERI EROE 'double'/'super': raddoppiano i punti al momento del bank
  if(state.heroDouble || state.heroSuper){
    state.turnScore *= 2;
    state.heroDouble = false;
    state.heroSuper = false;
    showBanner('PUNTI DOPPI', 'hero');
  }
  p.total += state.turnScore;
  updateHud();
  setMessage(`${p.name} mette al sicuro ${formatNum(state.turnScore)} punti. Totale: ${formatNum(p.total)}.`, 'good');

  // attiva il turno finale se raggiunge l'obiettivo
  if(!state.finalRound && p.total >= state.target){
    state.finalRound = true;
    state.finalStarter = state.current;
  }

  state.busy = true;
  setButtons();
  setTimeout(endTurn, 1300);
}

/* ---------- Fine turno / cambio giocatore ---------- */

function endTurn(){
  if(!state.running) return; // partita abbandonata
  hideBanner();
  const next = (state.current + 1) % state.players.length;

  // se siamo nel turno finale ed è tornato a chi lo ha innescato → fine partita
  if(state.finalRound && next === state.finalStarter){
    finishGame();
    return;
  }

  state.current = next;
  beginTurn();
}

/* ---------- Fine partita ---------- */

function finishGame(){
  state.gameOver = true;

  const ranking = state.players
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => b.total - a.total);

  const winner = ranking[0];
  document.getElementById('winner-text').textContent = `${winner.name} vince!`;

  // registra la partita nello storico (sia multiplayer sia single player)
  if(state.mode === 'multi'){
    recordMatch('multi', {
      winner: winner.name,
      winnerAvatar: winner.avatar,
      score: winner.total,
      opponent: ranking[1].name,
      opponentScore: ranking[1].total,
      ts: Date.now(),
    });
  } else {
    // single: il giocatore umano è players[0], la CPU è players[1]
    recordMatch('single', {
      won: state.players[0].total >= state.players[1].total,
      playerScore: state.players[0].total,
      cpuScore: state.players[1].total,
      opponent: state.players[1].name,
      difficulty: state.difficulty,
      target: state.target,
      ts: Date.now(),
    });
  }
  // il pulsante storico a fine partita è sempre disponibile
  document.getElementById('btn-over-history').style.display = '';

  // invito a registrarsi (solo single, cloud attivo, non ancora loggato)
  document.getElementById('account-nudge').style.display =
    (state.mode === 'single' && cloudEnabled() && !currentUser) ? '' : 'none';

  // progressione eroe (solo single): aggiorna strisce e cariche
  const rewardEl = document.getElementById('hero-reward');
  if(state.mode === 'single'){
    const humanWon = state.players[0].total >= state.players[1].total;
    const earned = updateHeroProgress(humanWon);
    if(earned.length){
      rewardEl.innerHTML = '🏅 Nuovo potere: ' +
        earned.map(k => `<b>${HERO_POWERS[k].label}</b>`).join(', ');
      rewardEl.style.display = '';
    } else {
      const d = state.difficulty;
      const toNext = STREAK_STEP - (hero.streak[d] % STREAK_STEP);
      rewardEl.innerHTML = humanWon
        ? `Striscia ${DIFF_LABEL[d]}: ${hero.streak[d]} — ancora ${toNext} per un potere!`
        : '';
      rewardEl.style.display = humanWon ? '' : 'none';
    }
  } else {
    rewardEl.style.display = 'none';
  }

  const board = document.getElementById('final-board');
  board.innerHTML = '';
  ranking.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'final-row' + (idx === 0 ? ' win' : '');
    row.innerHTML =
      `<span class="rank">${idx + 1}°</span>` +
      `<span class="fr-name">${escapeHtml(p.name)}</span>` +
      `<span class="fr-score">${formatNum(p.total)}</span>`;
    board.appendChild(row);
  });

  showScreen('over');
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- Banner ---------- */

function showBanner(text, type){
  bannerEl.textContent = text;
  bannerEl.className = 'banner ' + type;
  // forza reflow per riavviare l'animazione
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
}
function hideBanner(){
  bannerEl.className = 'banner';
  bannerEl.textContent = '';
}

/* =========================================================
   INTELLIGENZA ARTIFICIALE (giocatore singolo)
   ========================================================= */

function cpuTurn(){
  // primo lancio del turno
  cpuRoll();
}

function cpuRoll(){
  if(!state.running) return; // partita abbandonata durante il turno IA
  // hot dice: se tutti usati, libera i dadi
  if(setCount() === NUM_DICE){
    for(const d of state.dice) d.status = 'out';
    showBanner('HOT DICE!', 'hot');
  }
  // lancia i dadi 'out'
  for(const d of state.dice){
    if(d.status === 'out'){
      d.value = 1 + Math.floor(Math.random() * 6);
      d.status = 'active';
      d.selected = false;
    }
  }
  state.phase = 'action';
  updateHud();

  animateRoll(() => {
    if(!state.running) return; // partita abbandonata durante l'animazione
    const activeDice = state.dice.filter(d => d.status === 'active');
    const power = state.players[1] && state.players[1].power;

    // POTERE 'luck': trasforma un dado in un 1 (aiuto se in svantaggio)
    let delay = 0;
    if(power && power.type === 'luck' && state.luckUsed < POWER_MAX_USES &&
       Math.random() < powerChance() && applyLuck(activeDice)){
      state.luckUsed++;
      showBanner(power.label, 'ring');
      renderDice(true);
      delay = 750;
    }

    setTimeout(() => {
      if(!state.running) return;
      if(!hasAnyScore(activeDice.map(d => d.value))){
        // POTERE 'save' (Anello di Sauron): evita il Farkle in svantaggio
        if(power && power.type === 'save' && state.saveUsed < POWER_MAX_USES &&
           Math.random() < powerChance()){
          state.saveUsed++;
          ringReroll(activeDice);
          showBanner(power.label, 'ring');
          renderDice(true);
          updateHud();
          setTimeout(() => { if(state.running) cpuDecide(); }, 750);
          return;
        }
        handleFarkle();
        return;
      }
      cpuDecide();
    }, delay);
  });
}

function cpuDecide(){
  // seleziona i dadi punteggianti dal lancio attivo
  const activeIdx = [];
  state.dice.forEach((d, i) => { if(d.status === 'active') activeIdx.push(i); });
  const activeValues = activeIdx.map(i => state.dice[i].value);

  const expert = state.difficulty === 'expert';
  let pick;
  if(expert){
    // gioco perfetto: scelta ottimale dei dadi da tenere
    pick = expertPick(activeValues, state.turnScore, setCount());
  } else if(Math.random() < AI_LEVELS[state.difficulty].lazy){
    // L'IA dei livelli più bassi a volte sceglie in modo "pigro" (sub-ottimale).
    pick = lazyScoringSelection(activeValues);
    if(pick.score <= 0) pick = greedyScoringSelection(activeValues);
  } else {
    pick = greedyScoringSelection(activeValues);
  }
  // marca selezionati (mappa indici relativi -> assoluti)
  pick.indices.forEach(rel => { state.dice[activeIdx[rel]].selected = true; });
  renderDice(false);

  setMessage(`${state.players[1].name} mette da parte ${formatNum(pick.score)} punti.`, '');

  setTimeout(() => {
    if(!state.running) return; // partita abbandonata durante il "pensiero" dell'IA
    // fissa la selezione
    commitSelection();
    updateHud();

    const total = state.players[1].total;
    const hotDice = (setCount() === NUM_DICE);
    const diceLeft = hotDice ? NUM_DICE : (NUM_DICE - setCount());

    // decisione: continuare o mettere al sicuro?
    let keepGoing;

    if(expert){
      if(state.finalRound){
        // Gioca per vincere: se bancando supera il leader, incassa e vince;
        // altrimenti DEVE continuare a rischiare — bancare un punteggio
        // perdente sarebbe una sconfitta certa (rilanciare dà comunque una
        // possibilità). Validato per simulazione: vince 52–54% vs la vecchia
        // logica, che invece a volte si arrendeva.
        const leader = Math.max(...state.players.map(p => p.total));
        keepGoing = !(total + state.turnScore > leader);
      } else {
        // gioco perfetto: rilancia se il valore atteso supera il bancare ora
        // (dpValue gestisce da sé anche gli hot dice, diceLeft = 6).
        keepGoing = dpValue(diceLeft, state.turnScore) > state.turnScore;
      }
    } else if(hotDice){
      keepGoing = true; // rilancio gratuito di tutti e 6
    } else if(state.finalRound){
      // deve superare il punteggio più alto avversario
      const leader = Math.max(...state.players.map(p => p.total));
      if(total + state.turnScore > leader){
        keepGoing = false; // è già in testa, banca
      } else {
        // deve recuperare: gioca alla soglia EV piena (rischio ottimale)
        keepGoing = state.turnScore < evThreshold(diceLeft);
      }
    } else {
      // decisione a valore atteso, modulata dal profilo di difficoltà
      const risk = AI_LEVELS[state.difficulty].risk;
      keepGoing = state.turnScore < risk * evThreshold(diceLeft);
    }

    if(keepGoing){
      setMessage(`${state.players[1].name} rischia e rilancia (${formatNum(state.turnScore)} pt nel turno).`, 'warn');
      setTimeout(cpuRoll, 1000);
    } else {
      // POTERE 'bonus': punti extra al momento del bank (se in svantaggio)
      const power = state.players[1] && state.players[1].power;
      if(power && power.type === 'bonus' && !state.bonusUsed && Math.random() < powerChance()){
        state.bonusUsed = true;
        state.turnScore += POWER_BONUS;
        updateHud();
        showBanner(power.label, 'ring');
        setTimeout(() => { if(state.running) bankAndEnd(); }, 1000);
      } else {
        bankAndEnd();
      }
    }
  }, 900);
}

/* =========================================================
   UI PERSONALIZZAZIONE (avatar + temi)
   ========================================================= */

function selectableAvatarIds(){
  return Object.keys(AVATARS).filter(id => AVATARS[id].selectable);
}

// Costruisce una riga di avatar a selezione singola.
function buildAvatarRow(containerId, currentId, onPick){
  const c = document.getElementById(containerId);
  c.innerHTML = '';
  for(const id of selectableAvatarIds()){
    const a = AVATARS[id];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'avatar-opt' + (id === currentId ? ' selected' : '');
    el.dataset.av = id;
    el.innerHTML = a.svg + `<span>${a.label}</span>`;
    el.addEventListener('click', () => {
      c.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
      if(onPick) onPick(id);
    });
    c.appendChild(el);
  }
}

function getSelectedAvatar(containerId, fallback){
  const sel = document.querySelector(`#${containerId} .avatar-opt.selected`);
  return sel ? sel.dataset.av : fallback;
}

// Schermata "Personalizza": avatar del giocatore + tema dado con anteprima.
function buildCustomScreen(){
  applyDiceTheme(prefs.dice); // ripristina il tema personale per l'anteprima
  buildAvatarRow('custom-avatars', prefs.avatar, id => { prefs.avatar = id; savePrefs(); });

  const grid = document.getElementById('custom-themes');
  grid.innerHTML = '';
  for(const id of Object.keys(DICE_THEMES)){
    const t = DICE_THEMES[id];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'theme-swatch' + (id === prefs.dice ? ' selected' : '');
    el.dataset.theme = id;
    el.innerHTML = `<span class="chip" style="background:${t.body}"></span><span>${t.name}</span>`;
    el.addEventListener('click', () => {
      grid.querySelectorAll('.theme-swatch').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
      prefs.dice = id; savePrefs();
      applyDiceTheme(id);
      renderPreviewDie();
    });
    grid.appendChild(el);
  }
  renderPreviewDie();
}

function renderPreviewDie(){
  const die = document.getElementById('preview-die');
  die.dataset.face = 5;
  renderPips(die, 5);
}

// Riga compatta di chip-colore per scegliere il tema dado (selezione singola).
function buildThemeChips(containerId, currentId){
  const c = document.getElementById(containerId);
  c.innerHTML = '';
  for(const id of Object.keys(DICE_THEMES)){
    const t = DICE_THEMES[id];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'chip-opt' + (id === currentId ? ' selected' : '');
    el.dataset.theme = id;
    el.title = t.name;
    el.innerHTML = `<span class="chip-dot" style="background:${t.body}"></span>`;
    el.addEventListener('click', () => {
      c.querySelectorAll('.chip-opt').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
    });
    c.appendChild(el);
  }
}

function getSelectedTheme(containerId, fallback){
  const sel = document.querySelector(`#${containerId} .chip-opt.selected`);
  return sel ? sel.dataset.theme : fallback;
}

// Setup multiplayer: avatar + colore dadi, con default diversi per i due.
function buildSetupCustomization(){
  const avIds = selectableAvatarIds();
  const av1 = prefs.avatar;
  const av2 = avIds.find(id => id !== av1) || av1;
  buildAvatarRow('setup-av1', av1, null);
  buildAvatarRow('setup-av2', av2, null);

  const thIds = Object.keys(DICE_THEMES);
  const th1 = prefs.dice;
  const th2 = thIds.find(id => id !== th1) || th1;
  buildThemeChips('setup-dice1', th1);
  buildThemeChips('setup-dice2', th2);
}

/* =========================================================
   STORICO VITTORIE (UI)
   ========================================================= */

let historyKind = 'multi';    // tipo di storico mostrato ('multi' | 'single')
let historyReturn = 'menu';   // schermata a cui torna il pulsante "Indietro"

// Apre lo storico del tipo indicato, ricordando da dove si è arrivati.
function openHistory(kind, returnTo){
  historyKind = kind;
  historyReturn = returnTo;
  buildHistoryScreen(kind);
  showScreen('history');
}

function buildHistoryScreen(kind){
  const titleEl = document.getElementById('hist-title');
  const subEl = document.getElementById('hist-sub');
  const summaryEl = document.getElementById('hist-summary');
  const listEl = document.getElementById('hist-list');
  summaryEl.innerHTML = '';
  listEl.innerHTML = '';

  const hist = loadHistory(kind);

  if(kind === 'single'){
    titleEl.textContent = 'Storico — Giocatore Singolo';
    subEl.textContent = "Le tue ultime 10 sfide contro l'IA.";
    if(hist.length === 0){
      listEl.innerHTML = "<div class=\"hist-empty\">Nessuna partita registrata.<br>Gioca contro l'IA per iniziare a tracciare i tuoi punteggi.</div>";
      return;
    }
    // statistiche di andamento
    const wins = hist.filter(h => h.won).length;
    const best = Math.max(...hist.map(h => h.playerScore));
    const stat = (label, val) => {
      const el = document.createElement('div');
      el.className = 'hist-tally';
      el.innerHTML = `<span>${label}</span><b>${val}</b>`;
      summaryEl.appendChild(el);
    };
    stat('Vittorie', `${wins}/${hist.length}`);
    stat('Miglior punteggio', formatNum(best));

    hist.forEach((h, idx) => {
      const cls = h.won ? 'win' : 'loss';
      const row = document.createElement('div');
      row.className = 'hist-row' + (idx === 0 ? ' recent' : '');
      row.innerHTML =
        `<span class="hr-rank">${idx + 1}</span>` +
        `<span class="hr-badge ${cls}">${h.won ? 'V' : 'P'}</span>` +
        `<div class="hr-main">` +
          `<div class="hr-win ${cls}">${h.won ? 'Vinto' : 'Perso'}</div>` +
          `<div class="hr-sub">${h.opponent ? 'vs ' + escapeHtml(h.opponent) + ' · ' : ''}${DIFF_LABEL[h.difficulty] || ''} · ${formatDate(h.ts)}</div>` +
        `</div>` +
        `<span class="hr-score">${formatNum(h.playerScore)}–${formatNum(h.cpuScore)}</span>`;
      listEl.appendChild(row);
    });
    return;
  }

  // --- multiplayer ---
  titleEl.textContent = 'Storico — Multiplayer';
  subEl.textContent = 'Ultime 10 partite «Passa il telefono».';
  if(hist.length === 0){
    listEl.innerHTML = '<div class="hist-empty">Nessuna partita multiplayer registrata.<br>Gioca una partita «Passa il telefono» per iniziare lo storico.</div>';
    return;
  }
  const tally = {};
  for(const h of hist) tally[h.winner] = (tally[h.winner] || 0) + 1;
  Object.keys(tally).sort((a, b) => tally[b] - tally[a]).forEach(name => {
    const el = document.createElement('div');
    el.className = 'hist-tally';
    el.innerHTML = `<span>${escapeHtml(name)}</span><b>${tally[name]}</b>`;
    summaryEl.appendChild(el);
  });
  hist.forEach((h, idx) => {
    const av = (AVATARS[h.winnerAvatar] || AVATARS.male).svg;
    const row = document.createElement('div');
    row.className = 'hist-row' + (idx === 0 ? ' recent' : '');
    row.innerHTML =
      `<span class="hr-rank">${idx + 1}</span>` +
      `<span class="hr-av">${av}</span>` +
      `<div class="hr-main">` +
        `<div class="hr-win">${escapeHtml(h.winner)}</div>` +
        `<div class="hr-sub">contro ${escapeHtml(h.opponent)} · ${formatDate(h.ts)}</div>` +
      `</div>` +
      `<span class="hr-score">${formatNum(h.score)}–${formatNum(h.opponentScore)}</span>`;
    listEl.appendChild(row);
  });
}

// Piccolo dado in SVG (dimensione fissa) per gli esempi del regolamento.
function miniDieSVG(v){
  const POS = {
    1: [[50,50]],
    2: [[30,30],[70,70]],
    3: [[30,30],[50,50],[70,70]],
    4: [[30,30],[70,30],[30,70],[70,70]],
    5: [[30,30],[70,30],[50,50],[30,70],[70,70]],
    6: [[30,30],[70,30],[30,50],[70,50],[30,70],[70,70]],
  };
  const pips = (POS[v] || []).map(([x,y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#2a2f4e"/>`).join('');
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="6" y="6" width="88" height="88" rx="18" fill="#f5f6ff" stroke="#e0b24a" stroke-width="3"/>` +
    pips + `</svg>`;
}

// Catalogo punteggi: alimenta sia la tabella "Punteggio visivo" sia il modale.
const RULE_EXAMPLES = [
  { name: 'Singolo 1',        dice: [1],           pts: 100,  desc: 'Un dado che mostra 1 vale 100 punti.' },
  { name: 'Singolo 5',        dice: [5],           pts: 50,   desc: 'Un dado che mostra 5 vale 50 punti.' },
  { name: 'Tre 1',            dice: [1,1,1],       pts: 1000, desc: 'Tre dadi con l\'1 valgono 1000 punti (il tris più ricco).' },
  { name: 'Tre 2',            dice: [2,2,2],       pts: 200,  desc: 'Tre dadi con il 2 valgono 200 punti.' },
  { name: 'Tre 3',            dice: [3,3,3],       pts: 300,  desc: 'Tre dadi con il 3 valgono 300 punti.' },
  { name: 'Tre 4',            dice: [4,4,4],       pts: 400,  desc: 'Tre dadi con il 4 valgono 400 punti.' },
  { name: 'Tre 5',            dice: [5,5,5],       pts: 500,  desc: 'Tre dadi con il 5 valgono 500 punti.' },
  { name: 'Tre 6',            dice: [6,6,6],       pts: 600,  desc: 'Tre dadi con il 6 valgono 600 punti.' },
  { name: 'Tre coppie',       dice: [2,2,4,4,6,6], pts: 750,  desc: 'Tre coppie qualsiasi nello stesso lancio: 750 punti.' },
  { name: 'Scala 1-2-3-4-5-6', dice: [1,2,3,4,5,6], pts: 1000, desc: 'Tutti i numeri da 1 a 6 in un solo lancio: 1000 punti.' },
];

// Costruisce la tabella "Punteggio visivo": righe cliccabili nome + punti.
function buildRulesExamples(){
  const cont = document.getElementById('rules-examples');
  if(!cont || cont.dataset.built) return; // costruisci una sola volta
  cont.innerHTML = RULE_EXAMPLES.map((ex, i) =>
    `<div class="rule-example" data-ex="${i}">` +
      `<span class="sr-name">${ex.name}</span>` +
      `<span class="sr-pts">${formatNum(ex.pts)}</span>` +
      `<span class="re-zoom">&#8853;</span>` +
    `</div>`
  ).join('');
  cont.dataset.built = '1';
}

// Elenco dei poteri dell'eroe nel regolamento (generato dal registro).
function buildRulesPowers(){
  const cont = document.getElementById('rules-hero-powers');
  if(!cont || cont.dataset.built) return;
  const from = { double: 'Facile', change: 'Medio', shield: 'Difficile', reroll: 'Esperto', super: 'Super' };
  cont.innerHTML = Object.keys(HERO_POWERS).map(k => {
    const p = HERO_POWERS[k];
    return `<div class="power-item">` +
             `<span class="pi-ico">${p.icon}</span>` +
             `<span class="pi-txt"><b>${p.label}</b> <small>(${from[k]})</small><br>${p.desc}</span>` +
           `</div>`;
  }).join('');
  cont.dataset.built = '1';
}

// Apre il modale con la combinazione ingrandita.
function openExampleModal(i){
  const ex = RULE_EXAMPLES[i];
  if(!ex) return;
  document.getElementById('modal-dice').innerHTML = ex.dice.map(miniDieSVG).join('');
  document.getElementById('modal-title').textContent = `${ex.name} = ${formatNum(ex.pts)}`;
  document.getElementById('modal-desc').textContent = ex.desc;
  const m = document.getElementById('example-modal');
  m.classList.add('show');
  m.setAttribute('aria-hidden', 'false');
}
function closeExampleModal(){
  const m = document.getElementById('example-modal');
  m.classList.remove('show');
  m.setAttribute('aria-hidden', 'true');
}

/* =========================================================
   UI POTERI DELL'EROE
   ========================================================= */

function heroTotalCharges(){
  return Object.keys(HERO_POWERS).reduce((s, k) => s + hero.charges[k], 0);
}

// Aggiorna il pulsante "Poteri Eroe" in partita (visibile solo single, turno umano).
function updateHeroButton(){
  const btn = document.getElementById('btn-hero');
  const singleHuman = state.mode === 'single' && state.current === 0 && state.running;
  if(!singleHuman || heroTotalCharges() === 0){ btn.style.display = 'none'; return; }
  btn.style.display = '';
  btn.disabled = state.heroUsedThisMatch || state.busy;
  btn.textContent = state.heroUsedThisMatch ? '★ Potere usato' : `★ Poteri Eroe (${heroTotalCharges()})`;
}

// Un potere è utilizzabile ora? (timing + carica + limite per partita)
function canUseHero(key){
  if(state.heroUsedThisMatch || hero.charges[key] <= 0) return false;
  if(key === 'change') return activeCount() > 0;                 // serve un lancio in tavolo
  if(key === 'super')  return state.turnScore === 0 && activeCount() === 0 && setCount() === 0; // a inizio turno
  return true; // double, shield, reroll: durante il proprio turno
}

function openHeroPanel(){
  document.getElementById('hero-values').style.display = 'none';
  const list = document.getElementById('hero-list');
  list.innerHTML = '';
  for(const key of Object.keys(HERO_POWERS)){
    const p = HERO_POWERS[key];
    const n = hero.charges[key];
    const usable = canUseHero(key);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'hero-row' + (usable ? '' : ' disabled');
    row.disabled = !usable;
    row.innerHTML =
      `<span class="hr-ico">${p.icon}</span>` +
      `<span class="hr-txt"><b>${p.label}</b><small>${p.desc}</small></span>` +
      `<span class="hr-n">×${n}</span>`;
    row.addEventListener('click', () => activateHeroPower(key));
    list.appendChild(row);
  }
  const anyUsable = Object.keys(HERO_POWERS).some(canUseHero);
  document.getElementById('hero-note').textContent = state.heroUsedThisMatch
    ? 'Hai già usato un potere in questa partita.'
    : (anyUsable ? 'Puoi usare 1 potere per partita. Scegline uno:' : 'Nessun potere utilizzabile in questo momento.');
  document.getElementById('hero-modal').classList.add('show');
}
function closeHeroPanel(){ document.getElementById('hero-modal').classList.remove('show'); }

function consumeHero(key){
  hero.charges[key]--;
  state.heroUsedThisMatch = true;
  saveHero();
  updateHeroButton();
}

function activateHeroPower(key){
  if(!canUseHero(key)) return;
  if(key === 'change'){
    // mostra la scelta del valore; la carica si consuma toccando il dado
    const row = document.getElementById('hv-row');
    row.innerHTML = '';
    for(let v = 1; v <= 6; v++){
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'hv-btn'; b.textContent = v;
      b.addEventListener('click', () => {
        state.heroChangeValue = v;
        closeHeroPanel();
        setMessage(`Cambia Dado: tocca il dado da trasformare in ${v}.`, 'warn');
      });
      row.appendChild(b);
    }
    document.getElementById('hero-values').style.display = '';
    return;
  }
  // poteri "armati" immediati
  consumeHero(key);
  if(key === 'double'){ state.heroDouble = true; setMessage('Punti Doppi attivi: verranno raddoppiati al bank.', 'good'); }
  else if(key === 'shield'){ state.heroShield = true; setMessage('Scudo attivo: il prossimo Farkle sarà annullato.', 'good'); }
  else if(key === 'reroll'){ state.heroLucky = true; setMessage('Rilancio Fortunato: il prossimo lancio non farà Farkle.', 'good'); }
  else if(key === 'super'){ state.heroSuper = true; setMessage("Colpo dell'Eroe: turno senza Farkle e a punti doppi!", 'good'); }
  showBanner(HERO_POWERS[key].label, 'hero');
  closeHeroPanel();
}

// Riquadro progressione nella schermata Giocatore Singolo.
function buildHeroProgress(){
  const el = document.getElementById('hero-progress');
  const charges = Object.keys(HERO_POWERS).map(k => {
    const n = hero.charges[k];
    return `<div class="hp-charge${n > 0 ? ' has' : ''}" title="${HERO_POWERS[k].label}">` +
             `<span class="hp-ico">${HERO_POWERS[k].icon}</span><span class="hp-n">${n}</span></div>`;
  }).join('');
  const streaks = ['easy','medium','hard','expert'].map(d =>
    `<span class="hp-st">${DIFF_LABEL[d]} <b>${hero.streak[d]}</b></span>`).join('');
  el.innerHTML =
    `<div class="hp-title">I tuoi Poteri dell'Eroe</div>` +
    `<div class="hp-charges">${charges}</div>` +
    `<div class="hp-streaks">Strisce: ${streaks}</div>`;
}

/* =========================================================
   UI ACCOUNT (login / salvataggio cloud)
   ========================================================= */

function authMsg(text, cls){
  const el = document.getElementById('auth-msg');
  el.textContent = text || '';
  el.className = 'auth-msg' + (cls ? ' ' + cls : '');
}

// Didascalia sotto il pulsante Account nel menu (invita alla registrazione).
function updateAccountHint(){
  const el = document.getElementById('account-hint');
  if(!el) return;
  if(!cloudEnabled()){ el.style.display = 'none'; return; }
  el.style.display = '';
  if(currentUser){
    el.textContent = 'Connesso: progressi salvati ☁︎';
    el.className = 'menu-hint good';
  } else {
    el.textContent = 'Registrati per salvare i tuoi progressi';
    el.className = 'menu-hint';
  }
}

function buildAuthScreen(){
  const form = document.getElementById('auth-form');
  const acc  = document.getElementById('auth-account');
  const rec  = document.getElementById('auth-recovery');
  const sub  = document.getElementById('auth-sub');
  authMsg('');
  rec.style.display = 'none';
  if(!cloudEnabled()){
    form.style.display = 'none';
    acc.style.display = 'none';
    sub.textContent = 'Salvataggio cloud non ancora configurato dallo sviluppatore.';
    return;
  }
  if(recoveryMode){
    form.style.display = 'none';
    acc.style.display = 'none';
    rec.style.display = '';
    sub.textContent = 'Recupero password: scegli una nuova password.';
    return;
  }
  if(currentUser){
    form.style.display = 'none';
    acc.style.display = '';
    document.getElementById('account-email').textContent = currentUser.email || '(account)';
    sub.textContent = 'Sei connesso: i tuoi progressi si salvano nel cloud e ti seguono su ogni dispositivo.';
  } else {
    form.style.display = '';
    acc.style.display = 'none';
    sub.textContent = 'Accedi o registrati per salvare i progressi nel cloud e ritrovarli ovunque.';
  }
}

/* =========================================================
   EVENTI INTERFACCIA
   ========================================================= */

// Account
document.getElementById('btn-account').addEventListener('click', () => {
  buildAuthScreen();
  showScreen('auth');
});
document.getElementById('btn-auth-back').addEventListener('click', () => showScreen('menu'));
document.getElementById('account-nudge').addEventListener('click', () => {
  buildAuthScreen();
  showScreen('auth');
});
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  if(!email || !pass){ authMsg('Inserisci email e password.', 'bad'); return; }
  authMsg('Accesso in corso…', '');
  const r = await authSignIn(email, pass);
  if(!r.ok) authMsg(r.msg, 'bad');
  else { authMsg('Accesso riuscito!', 'good'); buildAuthScreen(); }
});
document.getElementById('btn-signup').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  if(!email || pass.length < 6){ authMsg('Email valida e password di almeno 6 caratteri.', 'bad'); return; }
  authMsg('Registrazione in corso…', '');
  const r = await authSignUp(email, pass);
  if(!r.ok) authMsg(r.msg, 'bad');
  else authMsg(r.msg || 'Account creato!', 'good'), buildAuthScreen();
});
document.getElementById('btn-logout').addEventListener('click', async () => {
  await authSignOut();
  buildAuthScreen();
});
document.getElementById('btn-forgot').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  if(!email){ authMsg('Scrivi la tua email qui sopra, poi tocca "Password dimenticata?".', 'bad'); return; }
  authMsg('Invio email in corso…', '');
  const r = await authResetPassword(email);
  if(!r.ok) authMsg(r.msg, 'bad');
  else authMsg('Ti abbiamo inviato un\'email per reimpostare la password.', 'good');
});
document.getElementById('btn-newpass').addEventListener('click', async () => {
  const recMsg = document.getElementById('rec-msg');
  const np = document.getElementById('auth-newpass').value;
  if(np.length < 6){ recMsg.textContent = 'Password troppo corta (almeno 6 caratteri).'; recMsg.className = 'auth-msg bad'; return; }
  recMsg.textContent = 'Aggiornamento…'; recMsg.className = 'auth-msg';
  const r = await authUpdatePassword(np);
  if(!r.ok){ recMsg.textContent = r.msg; recMsg.className = 'auth-msg bad'; return; }
  recoveryMode = false;
  buildAuthScreen();
  authMsg('Password aggiornata! Ora sei connesso.', 'good');
});

// Selettore obiettivo
document.getElementById('target-seg').addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if(!btn) return;
  state.target = parseInt(btn.dataset.target, 10);
  document.querySelectorAll('#target-seg .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

// Selettore difficoltà (indipendente dall'obiettivo)
document.getElementById('diff-seg').addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if(!btn) return;
  state.difficulty = btn.dataset.diff;
  document.querySelectorAll('#diff-seg .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

// Menu → pagina Giocatore Singolo (obiettivo + difficoltà + storico)
document.getElementById('btn-single').addEventListener('click', () => {
  buildHeroProgress();
  showScreen('single');
});
document.getElementById('btn-single-back').addEventListener('click', () => showScreen('menu'));
document.getElementById('btn-single-start').addEventListener('click', () => {
  const v = pickVillain(state.difficulty);
  startGame('single', [
    { name: 'Tu', avatar: prefs.avatar, dice: prefs.dice },
    { name: v.name, avatar: v.avatar, dice: prefs.dice, power: v.power },
  ]);
});
document.getElementById('btn-single-history').addEventListener('click', () => openHistory('single', 'single'));

document.getElementById('btn-multi').addEventListener('click', () => {
  document.getElementById('name-p1').value = '';
  document.getElementById('name-p2').value = '';
  buildSetupCustomization();
  showScreen('setup');
});
document.getElementById('btn-setup-history').addEventListener('click', () => openHistory('multi', 'setup'));

document.getElementById('btn-custom').addEventListener('click', () => {
  buildCustomScreen();
  showScreen('custom');
});
document.getElementById('btn-custom-back').addEventListener('click', () => showScreen('menu'));

// Storico: torna alla schermata di provenienza; svuota il tipo corrente
document.getElementById('btn-history-back').addEventListener('click', () => showScreen(historyReturn));
document.getElementById('btn-hist-clear').addEventListener('click', () => {
  if(confirm('Svuotare questo storico?')){
    clearHistory(historyKind);
    buildHistoryScreen(historyKind);
  }
});
document.getElementById('btn-over-history').addEventListener('click', () => {
  openHistory(state.mode === 'multi' ? 'multi' : 'single', 'over');
});

document.getElementById('btn-rules').addEventListener('click', () => {
  buildRulesExamples();
  buildRulesPowers();
  showScreen('rules');
});
document.getElementById('btn-rules-back').addEventListener('click', () => showScreen('menu'));

// Esempi cliccabili → apre il modale ingrandito
document.getElementById('rules-examples').addEventListener('click', e => {
  const row = e.target.closest('.rule-example');
  if(row) openExampleModal(parseInt(row.dataset.ex, 10));
});
document.getElementById('modal-close').addEventListener('click', closeExampleModal);
// chiusura toccando lo sfondo scuro (ma non la card)
document.getElementById('example-modal').addEventListener('click', e => {
  if(e.target.id === 'example-modal') closeExampleModal();
});

// Pannello Poteri dell'Eroe
document.getElementById('btn-hero').addEventListener('click', () => {
  if(!state.busy && !state.gameOver) openHeroPanel();
});
document.getElementById('hero-close').addEventListener('click', closeHeroPanel);
document.getElementById('hero-modal').addEventListener('click', e => {
  if(e.target.id === 'hero-modal') closeHeroPanel();
});
document.getElementById('btn-setup-back').addEventListener('click', () => showScreen('menu'));

document.getElementById('btn-setup-start').addEventListener('click', () => {
  const n1 = document.getElementById('name-p1').value.trim() || 'Giocatore 1';
  const n2 = document.getElementById('name-p2').value.trim() || 'Giocatore 2';
  const a1 = getSelectedAvatar('setup-av1', 'male');
  const a2 = getSelectedAvatar('setup-av2', 'female');
  const d1 = getSelectedTheme('setup-dice1', 'classic');
  const d2 = getSelectedTheme('setup-dice2', 'rosso');
  startGame('multi', [
    { name: n1, avatar: a1, dice: d1 },
    { name: n2, avatar: a2, dice: d2 },
  ]);
});

btnRoll.addEventListener('click', onRoll);
btnBank.addEventListener('click', onBank);

document.getElementById('btn-quit').addEventListener('click', () => {
  if(confirm('Uscire dalla partita in corso?')){
    state.running = false; // ferma eventuali callback in sospeso (turno IA/animazioni)
    showScreen('menu');
  }
});

document.getElementById('btn-again').addEventListener('click', () => {
  startGame(state.mode, state.players.map(p => ({ name: p.name, avatar: p.avatar, dice: p.dice })));
});
document.getElementById('btn-menu').addEventListener('click', () => showScreen('menu'));

// Nota: lo zoom da doppio tap è già disattivato da `touch-action:manipulation`
// (CSS) e dal viewport, quindi non serve un handler JS che rischierebbe di
// annullare i tap rapidi sui dadi.

// avvio
loadPrefs();
loadHero();
applyDiceTheme(prefs.dice);
showScreen('menu');
updateAccountHint();
initAuth(); // riprende la sessione e sincronizza (se configurato)
