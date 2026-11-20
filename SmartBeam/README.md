# SmartBeam – Wireless Projector & Presentation

Android app (React Native + TypeScript + NativeWind) that turns a phone into the presentation source **and** remote:
PDF, PowerPoint, Word, images and video → Google Cast, external displays, QR "rooms", or guided Miracast mirroring.
Works offline for local PDF / image / video viewing; no account, no analytics.

> **Honest status.** This codebase was written without access to a device, a projector, or the npm/Gradle registries, so it has
> **not been compiled or run**. Treat the first `prebuild` as a build-and-fix pass (versions in `package.json` follow Expo SDK 58 (React Native 0.88, React 19.3, New Architecture only);
> run `npx expo install --fix` then `npx expo-doctor`). The checklist in `docs/TESTING.md` is how you validate it on real hardware.

## What works with what (read this before demoing)

| Capability | Google Cast | External display (HDMI/USB-C) | QR room (browser) | Miracast |
|---|---|---|---|---|
| Discovery | ✅ real (MediaRouter) | ✅ real (DisplayManager) | ✅ paired via QR | ❌ OS-level, not detectable |
| Connect from app | ✅ confirmed by Cast session | ✅ Presentation shown | ✅ verified via receiver heartbeat | ❌ opens Android settings only |
| Video / images | ✅ default receiver, served from phone over LAN | ✅ native | ✅ (uploaded, with consent) | via mirroring |
| PDF / PPT / DOCX slides | ⚠️ needs **SmartBeam custom receiver** + server | ✅ native PdfRenderer | ✅ | via mirroring (phone shows slide full-screen) |
| Remote (next/prev/pause/blackout/laser) | ✅ custom namespace | ✅ | ✅ | ❌ phone-local only |

Miracast, Cast and Android Presentation displays are three different technologies and are handled by three different adapters.
The app never shows "connected" unless the adapter proved it; Miracast is always shown as *unverified guidance*.

## Architecture

```
App.tsx → navigation → screens (18 + QR scanner)
            │
            ├─ store/        Zustand: settings (persisted), library (SQLite), connection, presentation, ui
            ├─ connection/    ConnectionManager + adapters: GoogleCast, ExternalDisplay, CloudRoom(QR), Miracast(guidance)
            │                 → add a vendor SDK = one new class implementing ConnectionAdapter + 1 line in index.ts
            ├─ presentation/  controller.ts (session state machine, history, commands), launch.ts (routing)
            ├─ services/      convertService (cache → server PDF → on-device outline), hosting (LAN + consented upload), consent
            ├─ native/        typed wrappers over the Kotlin modules
            └─ db/            expo-sqlite: files, folders, history, conversions
native/android/*.kt  CastModule, DisplayModule+SmartBeamPresentation, ServerModule (LAN HTTP, tokens), PdfModule/PdfUtil,
                     FilesModule (SAF), SystemModule (Miracast settings, network, storage)
plugins/withSmartBeam.js  Expo config plugin: copies Kotlin, registers package, manifest, Gradle deps, Cast app id
receiver/           cast.html (Google Cast Web Receiver), room.html (browser receiver with QR), presenter.js
backend/            optional Express server: PPTX/DOCX→PDF (LibreOffice), notes extraction, expiring uploads, QR rooms
```

### PowerPoint strategy
1. **Offline cache** of a previous conversion (SQLite + app storage).
2. **Server conversion** to PDF via LibreOffice (explicit per-file consent) → also returns speaker notes.
3. **On-device outline** (JSZip text/notes extraction) for .pptx/.docx when no server is reachable — clearly labelled text-only.
4. Otherwise a clear error (e.g. legacy `.ppt` needs the server).
**Limits:** animations/transitions are flattened (each slide = one static page), embedded media is not rendered, fonts may be substituted.

### Why Cast PDF needs a hosted URL
Receiver pages are served over HTTPS; browsers block them from fetching `http://phone-ip` (mixed content). So Cast **video/images** are
served from the phone's tokenised LAN server (media playback is allowed), while **PDF/PPT** go through the server's HTTPS temp hosting,
after consent, and are deleted when you end the presentation (plus TTL expiry).

## Setup

Prerequisites: Node 22.13+, JDK 17, Android SDK (API 37, build-tools 37.0.0), a physical Android phone (Cast/Presentation can't be tested on Expo Go or most emulators).

```bash
npm install
npx expo install --fix              # align versions with your SDK
npm run prebuild                    # generates android/ and injects the Kotlin modules via the config plugin
npm run android                     # dev build on a connected device
npm test                            # unit + integration tests (jest-expo)
```
Expo Go is **not** supported (custom native modules).

### Optional server
```bash
cd backend && npm install && npm run dev     # needs LibreOffice (soffice) for conversion; or use docker-compose.yml from the repo root
```
Set `PUBLIC_URL` (public **HTTPS** URL), `API_KEY`. In the app: Settings → Privacy & server. Android blocks cleartext HTTP, so use HTTPS (e.g. a tunnel) even in testing.

### Google Cast receiver
1. Host `receiver/` over HTTPS (the server does it at `/receiver/cast.html`).
2. In the [Cast Developer Console](https://cast.google.com/publish) register a **Custom Receiver** with that URL and register your test devices.
3. `SMARTBEAM_CAST_APP_ID=<your id> npm run prebuild && npm run android`.
Without an id the app uses Google's default receiver: video and images work, PDF/PowerPoint are refused with an explanatory message.

### QR room
Open `https://<server>/receiver/room.html` on any screen's browser → scan the QR in Connect → Scan QR.

### Release build
Create a keystore, add signing config to `android/app/build.gradle`, then `npm run build:aab`. Provide `docs/PRIVACY.md` as your store privacy policy.

## Phases → where they live
1. Foundation: config, NativeWind theme, navigation, Home. 2. Files/PDF/video/PPT: `FileManager`, `FileImport`, `DocumentViewerScreens`, `VideoPlayer`, `convertService`.
3. Connectivity: `connection/*`, native Cast/Display/System, assistant, troubleshooting. 4. Presentation: `controller`, `PresentationController`, `PresenterView`, history.
5. Production: error boundary + global handler, consent/privacy, tests, `docs/TESTING.md`.

## Known limitations / not implemented
- **MediaProjection** is intentionally unused: nothing here needs screen capture (Miracast is the OS's job).
- **Accounts, cloud sync, JWT, PostgreSQL**: marked optional in the brief and not built; the server is stateless (API key, in-memory rooms, files with TTL).
- Speaker notes need PPTX (server or on-device); PDFs have none.
- Cast session survives only while the receiver is reachable; video position sync uses 1 s progress callbacks.
- Real-world behaviour on specific projector firmware cannot be guaranteed from code alone — see the hardware checklist.
