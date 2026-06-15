# Pubblicare Farkle su GitHub Pages (passo-passo)

Obiettivo: ottenere un link HTTPS tipo `https://TUONOME.github.io/farkle/` che chiunque
apre su iPhone/Android e installa con "Aggiungi a Home". Tutto gratis, senza riga di comando.

## Cosa caricheremo
Solo i file del sito, che sono già pronti nella cartella **`www/`**:
`index.html`, `style.css`, `script.js`, `manifest.json`, `sw.js` e la cartella `icons/`.
(Gli altri file del progetto — `package.json`, `capacitor.config.json`, ecc. — servono solo per l'APK e NON vanno caricati.)

---

## Passo 1 — Account GitHub
Se non ce l'hai: vai su https://github.com → **Sign up** → crea l'account (gratis) e verifica l'email.

## Passo 2 — Crea il repository
1. In alto a destra clicca **+** → **New repository**.
2. **Repository name:** `farkle` (sarà parte dell'indirizzo finale).
3. Lascia **Public** selezionato (necessario per Pages gratis).
4. NON spuntare "Add a README".
5. Clicca **Create repository**.

## Passo 3 — Carica i file del gioco
1. Nella pagina del repo appena creato, clicca **uploading an existing file**
   (oppure **Add file → Upload files**).
2. Apri sul computer la cartella `www/` del progetto.
3. Seleziona **tutto il contenuto** di `www/` (i 5 file + la cartella `icons`) e
   **trascinalo** nell'area di upload del browser.
   - La cartella `icons` mantiene la sua struttura: va bene così.
4. In basso, in "Commit changes", lascia il messaggio predefinito e clicca **Commit changes**.

> Importante: devono finire nella **radice** del repository, cioè devi vedere
> `index.html` direttamente nell'elenco file del repo (non dentro una sottocartella `www`).
> Se per sbaglio carichi la cartella `www` intera, il sito sarà in `.../farkle/www/` —
> in tal caso basta ricaricare prendendo il *contenuto* di `www`, non la cartella.

## Passo 4 — Attiva GitHub Pages
1. Nel repo vai su **Settings** (in alto) → nel menu a sinistra **Pages**.
2. In "Build and deployment" → **Source**: scegli **Deploy from a branch**.
3. **Branch**: seleziona **main** e cartella **/ (root)** → clicca **Save**.
4. Aspetta 1–2 minuti. Ricarica la pagina: comparirà
   **"Your site is live at https://TUONOME.github.io/farkle/"**.

## Passo 5 — Apri e installa
- Apri quel link su **iPhone (Safari)** → tasto **Condividi** → **Aggiungi a Home**.
- Su **Android (Chrome)** → menu ⋮ → **Installa applicazione**.
- Il pulsante "Offrimi un caffè" porterà a Ko-fi. Tutto funziona offline dopo la prima apertura.

---

## Aggiornare il gioco in futuro (IMPORTANTE)
Il service worker tiene i file in cache per il funzionamento offline. Quando modifichi il
gioco e ripubblichi:

1. Apri `sw.js` e **cambia la versione della cache**: la riga
   `const CACHE = 'farkle-v1';` → diventa `'farkle-v2'`, poi `'farkle-v3'`, ecc.
2. Ricarica i file modificati su GitHub (Add file → Upload files, oppure modifica diretta
   dal sito con la matita ✏️ e Commit).
3. Gli utenti riceveranno la nuova versione alla riapertura.

Senza il punto 1, chi ha già aperto la PWA continuerebbe a vedere la versione vecchia.

## Problemi comuni
- **Pagina bianca / 404:** assicurati che `index.html` sia nella radice del repo e che in
  Settings → Pages il branch sia `main` / root. Dopo il primo deploy servono 1–2 minuti.
- **Icona o stile assenti:** verifica che la cartella `icons/` sia stata caricata con dentro
  i PNG, e che `style.css` sia nella radice.
- **"Aggiungi a Home" non a tutto schermo:** è normale alla primissima apertura; chiudi e
  riapri dall'icona sulla Home.
