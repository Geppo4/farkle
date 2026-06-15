'use strict';

/* =========================================================
   FARKLE — logica di gioco
   HTML/CSS/JS puri, nessuna dipendenza esterna.
   ========================================================= */

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

const DIFF_LABEL = { easy: 'Facile', medium: 'Medio', hard: 'Difficile' };

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
}

/* --- Storico vittorie (solo multiplayer): ultime 10, più recente in cima --- */
const HISTORY_KEY = 'farkle.history.v1';
const HISTORY_MAX = 10;

function loadHistory(){
  try {
    const s = localStorage.getItem(HISTORY_KEY);
    const arr = s ? JSON.parse(s) : [];
    return Array.isArray(arr) ? arr : [];
  } catch(e){ return []; }
}
function saveHistory(arr){
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch(e){}
}
// inserisce una nuova partita in testa e mantiene solo le ultime HISTORY_MAX
function recordMatch(entry){
  const arr = loadHistory();
  arr.unshift(entry);
  saveHistory(arr.slice(0, HISTORY_MAX));
}
function clearHistory(){ saveHistory([]); }

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
  finalRound: false,
  finalStarter: -1,
  gameOver: false,
};

/* ---------- Riferimenti DOM ---------- */

const screens = {
  menu:    document.getElementById('screen-menu'),
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
  }));
  state.current = 0;
  state.finalRound = false;
  state.finalStarter = -1;
  state.gameOver = false;
  state.busy = false;
  state.running = true;

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
  const a = AVATARS[avatarId] || AVATARS.male;
  const el = document.getElementById(elId);
  el.innerHTML = a.svg;
  el.style.boxShadow = ringColor ? `0 0 0 2px ${ringColor}` : 'none';
}

function beginTurn(){
  state.busy = false;
  state.turnScore = 0;
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
}

/* ---------- Interazione dadi ---------- */

function onDieTap(i){
  if(state.busy || state.gameOver) return;
  if(state.mode === 'single' && state.current === 1) return; // turno IA
  const die = state.dice[i];
  if(die.status !== 'active') return;
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
  state.phase = 'action';
  updateHud();

  animateRoll(() => {
    if(!state.running) return; // uscita dalla partita durante l'animazione
    const active = state.dice.filter(d => d.status === 'active').map(d => d.value);
    if(!hasAnyScore(active)){
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

  // registra la partita nello storico (solo multiplayer)
  const overHistBtn = document.getElementById('btn-over-history');
  if(state.mode === 'multi'){
    recordMatch({
      winner: winner.name,
      winnerAvatar: winner.avatar,
      score: winner.total,
      opponent: ranking[1].name,
      opponentScore: ranking[1].total,
      ts: Date.now(),
    });
    overHistBtn.style.display = '';
  } else {
    overHistBtn.style.display = 'none';
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
    const active = state.dice.filter(d => d.status === 'active').map(d => d.value);
    if(!hasAnyScore(active)){
      handleFarkle();
      return;
    }
    cpuDecide();
  });
}

function cpuDecide(){
  // seleziona i dadi punteggianti dal lancio attivo
  const activeIdx = [];
  state.dice.forEach((d, i) => { if(d.status === 'active') activeIdx.push(i); });
  const activeValues = activeIdx.map(i => state.dice[i].value);

  // L'IA dei livelli più bassi a volte sceglie in modo "pigro" (sub-ottimale).
  let pick;
  if(Math.random() < AI_LEVELS[state.difficulty].lazy){
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

    if(hotDice){
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
      bankAndEnd();
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

function buildHistoryScreen(){
  const hist = loadHistory();
  const summaryEl = document.getElementById('hist-summary');
  const listEl = document.getElementById('hist-list');
  summaryEl.innerHTML = '';
  listEl.innerHTML = '';

  if(hist.length === 0){
    listEl.innerHTML = '<div class="hist-empty">Nessuna partita multiplayer registrata.<br>Gioca una partita «Passa il telefono» per iniziare lo storico.</div>';
    return;
  }

  // conteggio vittorie per nome (sulle partite memorizzate)
  const tally = {};
  for(const h of hist) tally[h.winner] = (tally[h.winner] || 0) + 1;
  Object.keys(tally).sort((a, b) => tally[b] - tally[a]).forEach(name => {
    const el = document.createElement('div');
    el.className = 'hist-tally';
    el.innerHTML = `<span>${escapeHtml(name)}</span><b>${tally[name]}</b>`;
    summaryEl.appendChild(el);
  });

  // elenco partite: già ordinate dalla più recente alla più vecchia
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

/* =========================================================
   EVENTI INTERFACCIA
   ========================================================= */

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

document.getElementById('btn-single').addEventListener('click', () => {
  startGame('single', [
    { name: 'Tu', avatar: prefs.avatar, dice: prefs.dice },
    { name: 'CPU · ' + DIFF_LABEL[state.difficulty], avatar: 'cpu', dice: prefs.dice },
  ]);
});

document.getElementById('btn-multi').addEventListener('click', () => {
  document.getElementById('name-p1').value = '';
  document.getElementById('name-p2').value = '';
  buildSetupCustomization();
  showScreen('setup');
});

document.getElementById('btn-custom').addEventListener('click', () => {
  buildCustomScreen();
  showScreen('custom');
});
document.getElementById('btn-custom-back').addEventListener('click', () => showScreen('menu'));

document.getElementById('btn-history').addEventListener('click', () => {
  buildHistoryScreen();
  showScreen('history');
});
document.getElementById('btn-history-back').addEventListener('click', () => showScreen('menu'));
document.getElementById('btn-hist-clear').addEventListener('click', () => {
  if(confirm('Svuotare lo storico delle vittorie?')){
    clearHistory();
    buildHistoryScreen();
  }
});
document.getElementById('btn-over-history').addEventListener('click', () => {
  buildHistoryScreen();
  showScreen('history');
});

document.getElementById('btn-rules').addEventListener('click', () => showScreen('rules'));
document.getElementById('btn-rules-back').addEventListener('click', () => showScreen('menu'));
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
applyDiceTheme(prefs.dice);
showScreen('menu');
