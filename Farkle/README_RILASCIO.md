# Farkle — Guida al rilascio

Questo progetto è un gioco web (HTML/CSS/JS) già configurato come **PWA installabile** e con lo **scaffold Capacitor** pronto per generare un APK Android.

## Contenuto della cartella

| File / cartella | Cosa fa |
|---|---|
| `index.html`, `style.css`, `script.js` | Il gioco vero e proprio |
| `manifest.json` | Metadati PWA (nome, icone, colori, modalità standalone) |
| `sw.js` | Service worker: fa funzionare il gioco **offline** |
| `icons/` | Icone dell'app (192/512/maskable + apple-touch) |
| `package.json`, `capacitor.config.json`, `copy-web.mjs` | Scaffold per costruire l'APK con Capacitor |
| `www/` | Cartella generata (build web per Capacitor) — non modificarla a mano |

---

## 1) PWA — installazione su iPhone e Android (gratis, nessun account)

Il gioco si apre già facendo doppio clic su `index.html`. Per renderlo **installabile e offline** come un'app, va servito via **HTTPS** (i service worker non funzionano da `file://`).

**Pubblicalo gratis** su uno di questi (basta caricare i file della cartella, esclusi `node_modules/`, `android/`, `www/`):

- **GitHub Pages** — crea un repo, carica i file, attiva Pages.
- **Netlify** / **Vercel** / **Cloudflare Pages** — trascini la cartella e ottieni un URL HTTPS.

Una volta online:

- **iPhone (Safari):** apri l'URL → tasto *Condividi* → **Aggiungi a Home**. L'icona compare nella home e il gioco parte a tutto schermo.
- **Android (Chrome):** apri l'URL → comparirà **Installa app** (o menu ⋮ → *Installa applicazione*).

> Nota Apple: iOS **non** permette di installare app fuori dall'App Store senza account sviluppatore (99 €/anno) e Xcode. La PWA "Aggiungi a Home" è il modo gratuito ufficiale per avere il gioco come app su iPhone.

---

## 2) APK Android con Capacitor (consigliato, pieno controllo)

### Prerequisiti (sul tuo PC)
- **Node.js 18+**
- **JDK 17**
- **Android Studio** (include Android SDK e Gradle)

### Passi
Da terminale, dentro questa cartella:

```bash
npm install                # installa Capacitor
npm run android:add        # crea www/, aggiunge la piattaforma android e sincronizza
npm run android:open       # apre il progetto in Android Studio
```

In Android Studio:
1. Attendi la sincronizzazione Gradle.
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. A fine build clicca *locate*: trovi `app-debug.apk` in
   `android/app/build/outputs/apk/debug/`.

Per installarlo sul telefono: abilita *Origini sconosciute* e copia l'APK, oppure collega il telefono e premi ▶ *Run* in Android Studio.

### APK/AAB firmato per la pubblicazione
Per il Play Store serve un pacchetto **firmato**. Genera una chiave una volta sola:

```bash
keytool -genkey -v -keystore farkle.keystore -alias farkle \
  -keyalg RSA -keysize 2048 -validity 10000
```

Poi in Android Studio: **Build → Generate Signed Bundle / APK**, seleziona il keystore, scegli `release` e ottieni l'`.aab` (per il Play Store) o l'`.apk`.
Conserva `farkle.keystore` e la password: servono per **ogni** aggiornamento futuro.

### Dopo ogni modifica al gioco
Hai cambiato `script.js`/`style.css`? Risincronizza:

```bash
npm run android:sync
```

---

## 3) APK veloce con PWABuilder (senza installare nulla)

Se non vuoi installare Android Studio: pubblica prima la PWA (punto 1), poi vai su **https://www.pwabuilder.com**, incolla l'URL, sezione *Android* → **Generate Package**. Scarichi un APK/AAB **già firmato** e le istruzioni per il Play Store.

---

## 4) Pubblicazione sugli store (facoltativo)

| Store | Cosa serve | Costo |
|---|---|---|
| **Google Play** | Account Google Play Console, file `.aab` firmato | 25 € una tantum |
| **Apple App Store** | Mac + Xcode, account Apple Developer, wrapper iOS (`npx cap add ios`) | 99 €/anno |

Per iOS nativo: con un Mac puoi fare `npx cap add ios` e `npx cap open ios`, poi archiviare e caricare da Xcode. Senza Mac, la via gratuita resta la PWA "Aggiungi a Home".

---

## Link di supporto (Ko-fi)
Nel menu e a fine partita c'è il pulsante "Offrimi un caffè" che apre `https://ko-fi.com/geppo`.
Su web e PWA si apre nel browser senza problemi. Nell'APK Android di solito si apre già nel
browser di sistema; se così non fosse, installa il plugin ufficiale:
`npm install @capacitor/browser` e apri il link con `Browser.open({ url })`.

## Personalizzazioni rapide
- **Nome app:** `appName` in `capacitor.config.json` e `name`/`short_name` in `manifest.json`.
- **ID pacchetto:** `appId` in `capacitor.config.json` (es. `com.tuonome.farkle`). Va scelto **prima** del primo `android:add`.
- **Icone:** sostituisci i PNG in `icons/` mantenendo nomi e dimensioni.
- **Colore tema:** `theme_color` / `background_color` in `manifest.json` e `backgroundColor` in `capacitor.config.json`.
