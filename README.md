<div align="center">
  <br />
  <img src="https://raw.githubusercontent.com/m3rcena/Udeler-Reborn/master/src/renderer/src/assets/brand.svg" alt="Udeler Reborn Logo" width="480" />
  <br />
  <h3><b>Udeler Reborn (v3)</b></h3>
  <p>An advanced, high-performance, asynchronous desktop platform for offline course management.</p>
  <p>🌐 <a href="https://udeler-reborn.ddns.net/"><b>udeler-reborn.ddns.net</b></a></p>

  <p>
    <img src="https://img.shields.io/github/v/release/m3rcena/Udeler-Reborn?include_prereleases&style=for-the-badge&color=2563eb" alt="Release" />
    <img src="https://img.shields.io/github/license/m3rcena/Udeler-Reborn?style=for-the-badge&color=7e22ce" alt="License" />
    <img src="https://img.shields.io/github/stars/m3rcena/Udeler-Reborn?style=for-the-badge&color=00e5ff" alt="Stars" />
  </p>

  <br />
</div>

---

## ✨ Premium Features

- **📚 Intelligent Course Updates & Archiving**
  - **Update Detection:** Automatically compares live API fetches against local baselines to detect and badge newly uploaded instructor videos.
  - **Archive Protection:** Safely identifies downloaded videos that the instructor has removed from Udemy and isolates them into an "Archived" chapter, ensuring zero data loss.
- **⏱️ Cross-Session Watch Progress Tracking**
  - Automatically saves your exact playback position to the local disk while watching.
  - Displays sleek visual progress bars across the library and automatically resumes videos exactly where you left off across application restarts.
- **📦 Centralized Background Execution Engine**
  - Downloads process non-blocking in the native backend thread while navigating the UI.
  - Adaptive state tracking prevents queue reset when closing or shifting tabs.
  - Global master controls allow pausing, resuming, or stopping the active pool safely.
- **📂 Explorer-Style Library View**
  - Automated directory aggregation that maps your downloaded files into interactive nested collections (`Library > Course > Chapter`).
  - Built-in dynamic storage computation reading precise allocations per file directly from native disk.
- **🎥 Secure Media Streaming**
  - Custom `local://` safe streaming protocol to bypass standard Chromium media-sandboxing rules.
  - Decoupled subtitle engine sanitizing, cleaning, and compiling `.vtt` tracks dynamically on-the-fly into embedded Data URIs to eliminate strict browser Cross-Origin Resource Sharing (CORS) faults.
- **🖥️ Native OS Integration**
  - Live taskbar/dock download progress, a system tray icon with pause/resume/cancel controls, and a Jump List for instantly resuming your last course or continuing recently-watched lectures, without ever bringing the window into focus.
- **🐢 Bandwidth Throttling & Scheduled Download Windows**
  - Cap download speed with a token-bucket rate limiter, or restrict large batch downloads to off-peak hours (e.g. overnight) so Udeler never competes with the rest of your household's connection.
- **🔎 Full-Text Library Search**
  - A local search index built over course metadata and subtitle tracks lets you find every lecture across your entire library that mentions a specific term — something the Udemy web player can't do at all. Try pressing **Ctrl + K**!
- **🗜️ Content-Addressable Storage & Deduplication**
  - Downloaded assets are hashed and stored in a shared content-addressable blob store, so instructors' reused intro clips, outros, and resource files are only ever stored once across your whole library. A background garbage collector reclaims space automatically and reports exactly how much was saved.
- **🩺 Library Health & Self-Healing Scans**
  - A background worker verifies every downloaded file against its expected checksum, flags corruption from partial downloads or disk errors, and offers one-click repair that re-fetches only the broken files using the existing delta-update pipeline.
- **💾 Smart Storage Tiering (External Drives & NAS)**
  - Pin individual courses to an external SSD or network share while keeping active courses on your fast local disk. Udeler detects drive attach/detach in real time and gracefully marks courses "offline" instead of breaking, when their volume isn't mounted.
- **🔐 Encrypted Vault Mode**
  - Optional at-rest encryption (AES-256-GCM) for downloaded media and stored credentials, with the master key sealed behind your OS's native credential store (Windows Credential Manager, macOS Keychain, or libsecret on Linux) via Electron's `safeStorage`. Files are streamed through dedicated encrypt/decrypt transform streams, so nothing decrypted ever touches disk.
- **🛡️ Zero-Trust IPC Audit Layer**
  - Every single main↔renderer IPC channel is routed through a capability manifest that tags it with a risk tier, enforces per-channel rate limits, and rejects calls originating from any unauthorized sub-frame — hardening the context bridge itself rather than just the code running behind it.

### 🆕 New in v3.3.0

- **☑️ Bulk Course Selection** — Select multiple courses in the Library view (or hit **Select All**) and queue them all for download in one action, instead of opening each course individually.
- **↕️ Download Queue Reordering** — A new Queue Manager panel in the Downloads tab lets you move pending items up or down to control exactly what downloads next.
- **🌍 Localization** — The interface is now fully translatable. Switch languages from Settings → Language, with English (US) and Greek included out of the box, plus a community-translation workflow for adding more.
- **📰 In-App Release Notes** — The update toast now has a **What's New** button that shows the real GitHub release notes inside the app, and a one-time dialog surfaces them automatically the first time you open Udeler after an update.
- **🧪 Automated Testing & CI** — A new Vitest test suite covers the vault encryption engine, database layer, bandwidth throttle, search service, and IPC audit layer, and every pull request now runs type-checking, linting, and tests on Windows, macOS, and Linux via GitHub Actions before it can be merged.
- **📋 Structured Contribution Templates** — Bug reports now use a guided form (OS, app version, account type, diagnostic logs) instead of a blank text box, alongside a new feature-request template and PR checklist.

---

## 🛠️ Technology Stack

- **Core Framework:** Electron (Native Asynchronous Desktop Bridging, Strict Context Isolation)
- **Frontend Layer:** React 18, TypeScript (TSX), Tailwind CSS
- **Build System:** Vite, `electron-vite`
- **Data Management:** `electron-store` (persistent app settings & progress mappings), `better-sqlite3` (content-addressable blob manifest, volume mappings)
- **API Validation:** `zod` (strict runtime schema validation for external API payloads)
- **Security:** Electron `safeStorage` (OS-keychain-backed encryption keys), native `node:crypto` AES-256-GCM streaming cipher, per-channel IPC capability manifest with frame-origin and rate-limit enforcement
- **Background Processing:** `worker_threads` for library integrity scans and filesystem-heavy work, kept off both the UI thread and the sandboxed renderer
- **Type Safety:** Generic E2E TypeScript IPC Bridge (zero-boilerplate backend/frontend communication)
- **Testing:** `vitest`, `@testing-library/react`, `happy-dom` — unit tests for the vault, database, throttle, search, and audit layers, run in CI on every pull request
- **Localization:** Custom lightweight i18n context with per-locale JSON dictionaries (English (US), Greek), a Settings-panel language switcher, and an `i18n:export` script for validating new translations

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v20 or higher) and `npm` installed on your development workstation.

### Installation & Initialization

1. Clone the repository:

   ```bash
   git clone https://github.com/m3rcena/Udeler-Reborn.git
   cd Udeler-Reborn
   ```

2. Provision configuration dependencies:

   ```bash
   npm install
   ```

3. Launch the development environment (Hot-Reload Enabled):
   ```bash
   npm run dev
   ```

### Development Checks

Before opening a pull request, run the same checks CI will run:

```bash
npm run typecheck   # TypeScript, main + renderer
npm run lint        # ESLint
npm test            # Vitest unit test suite
```

### Packaging & Compilation

To compile and pack the production binary distribution executable for your corresponding desktop operating platform:

```bash
# Windows Distribution Compile (.exe)
npm run build:win

# macOS Distribution Compile (.dmg / .app)
npm run build:mac

# Linux Distribution Compile (.AppImage / .deb)
npm run build:linux
```

The output distribution binaries will be written seamlessly to your root `/dist` or `/out` packaging paths.

---

## 📘 Detailed Usage Architecture

### 1. Authentication Layer

Upon system initialization, securely capture and apply your authentication bearer access token into the application portal. The application validates endpoints asynchronously against your profile and provisions access tokens directly inside automated localized configurations.

### 2. Synchronization Settings

Before running mass execution pools, navigate directly to the **Settings** configuration tab:

- **Storage Location:** Declare your primary output directory path. Moving paths triggers an instantaneous file migration script safely adjusting existing targets.
- **Conditional Synchronization:** Choose whether the background worker processes or drops external captions and structural documents (`.pdf`, `.zip`, etc.).
- **Bandwidth & Scheduling:** Set a maximum download speed and/or a preferred download window (e.g. 1 AM – 6 AM) to keep large batch jobs from saturating your connection during the day.
- **Vault Mode:** Enable at-rest encryption for downloaded media and stored credentials, sealed behind your operating system's native credential store.

### 3. Background Processing Queue

Once you select a course module and append files to your actively working pipeline:

- Select one course, or check several at once from the Library grid (or use **Select All**), to queue multiple courses in a single action.
- The **Waiting** telemetry module displays absolute metrics remaining in the queue array.
- The **In Progress** counter tracks active background processes.
- The **Queue Manager** panel on the Downloads tab lets you reorder pending items to control what downloads next.
- The processing matrix updates state metrics seamlessly even if you return to alternative navigational tabs.
- Live progress mirrors to the OS taskbar/dock and system tray, so you can track downloads without keeping the window in focus.

### 4. Library Health & Storage

- Run an on-demand or scheduled **Library Health** scan to verify every downloaded file against its expected checksum and automatically repair any corruption.
- Review reclaimed storage from automatic deduplication, and pin individual courses to external drives or network shares from the **Storage** panel.

---

## 📐 Project Directory Structure

```text
├── .github/
│   ├── ISSUE_TEMPLATE/           # Guided bug report & feature request forms
│   ├── workflows/
│   │   ├── ci.yml                # Typecheck, lint & test — every PR, 3 OSes
│   │   └── release.yml           # Tag-triggered build & publish pipeline
│   └── pull_request_template.md
├── build/                        # OS entitlement rules & distribution parameters
├── resources/                    # Application-wide icons (.ico, .icns, .png, .svg)
├── scripts/
│   ├── prebuild.ts                # Automated versioning
│   └── export-i18n.ts             # Translation file validation/export
├── src/
│   ├── main/                    # Primary Electron Application Backend Process
│   │   ├── index.ts             # Window lifecycle and sandboxed IPC listeners
│   │   ├── download.ts          # Multi-stage request processor & Zod validation
│   │   ├── udemy.ts             # Course extraction mappings
│   │   ├── database/
│   │   │   ├── db.ts            # Content-addressable blob store & volume manifest (SQLite)
│   │   │   └── store.ts         # Persistent settings store
│   │   ├── network/
│   │   │   ├── throttle.ts      # Token-bucket bandwidth limiter
│   │   │   └── scheduler.ts     # Scheduled download-window engine
│   │   ├── os/
│   │   │   ├── os-integration.ts# Taskbar/dock progress, tray, Jump List
│   │   │   └── search-service.ts# Local full-text search index
│   │   ├── security/
│   │   │   ├── vault.ts         # AES-256-GCM encryption streams & keychain-backed keys
│   │   │   └── audit.ts         # Zero-trust IPC capability manifest & rate limiting
│   │   ├── workers/
│   │   │   ├── integrity-worker.ts # Background checksum verification & repair
│   │   │   └── volume-watcher.ts   # External drive / NAS mount detection
│   │   ├── validation/          # Zod schemas for IPC-adjacent data structures
│   │   └── **/*.test.ts         # Vitest unit tests (vault, db, throttle, search, audit…)
│   ├── preload/                 # Electron Context Bridge Isolation Layer
│   │   ├── index.ts             # Generic API Invoker bridge
│   │   └── types/ipc-types.d.ts # Single Source of Truth E2E Type Definitions
│   └── renderer/                # React Client Frontend Layer
│       ├── index.html           # Client viewport with hardened Content Security Profile
│       └── src/
│           ├── assets/          # Vector design definitions and global CSS styles
│           ├── components/      # Modular overlays, search, library health & release-notes panels
│           ├── contexts/        # React context state engine pipelines (incl. I18nContext)
│           ├── i18n/            # Translation loader & type definitions
│           ├── locales/         # Per-language JSON dictionaries (EnglishUS, Greek, …)
│           ├── views/           # Application views (Library Explorer, Settings)
│           └── App.tsx          # Main state routers
├── electron-builder.yml         # Desktop compilation assembly rules
├── electron.vite.config.ts      # Vite bundler parameters
├── vitest.config.ts             # Unit test runner configuration
└── CHANGELOG.md                 # Version history
```

---

## 🔒 Security Posture & Hardening

Udeler Reborn is designed to adhere to standard enterprise Electron application security metrics:

- **Strict Context Isolation:** Electron render engines are locked away from the bare operating system. Node APIs like `fs` and `child_process` are fully isolated to the backend layer and exposed safely via the custom Generic Electron Context Bridge.
- **Zero-Trust IPC Capability Manifest:** Every exposed IPC channel is registered with a declared risk tier (read-only metadata, filesystem-write, network, or credential-access), enforced per-channel rate limits, and rejection of calls from unauthorized sub-frames — so the trust boundary is enforced at the bridge itself, not just assumed.
- **Runtime Schema Protection:** All external API responses are intercepted and validated through strict Zod schemas, ensuring corrupted or malicious server data cannot poison the internal state.
- **Encrypted-at-Rest Vault Mode:** Optional AES-256-GCM encryption for downloaded media and stored credentials, with keys sealed behind your OS's native credential store and never exposed to the renderer process.
- **Hardened Content Security Policy (CSP):** The embedded `index.html` file employs a modern CSP directive policy limiting external injection patterns while carefully authorizing local file streaming configurations via `media-src 'self' local: blob: data:`.

---

## 💬 Community & Support

Join our community to report issues, suggest features, or chat with other developers and users! Found a bug? Please use the [guided bug report form](https://github.com/m3rcena/Udeler-Reborn/issues/new/choose) — it collects the OS, app version, and diagnostic logs needed to actually track it down. Curious what changed recently? Check the [CHANGELOG](./CHANGELOG.md), or visit the [official website](https://udeler-reborn.ddns.net/).

<div align="center">
  <br />
  <a href="https://discord.com/invite/W5UYYTPX" target="_blank">
    <img src="https://readme-stats-mocha-one.vercel.app/api/discord?id=1447491639550410796&bg_color=141321&title_color=70a5fd&icon_color=f8d847&text_color=a9fef7" alt="M3rcena Development Discord Server" />
  </a>
  <br />
</div>

---

## 💖 Support the Project

Udeler Reborn is a free, zero-trust, open-source project developed and maintained in my free time. If the software helped you preserve your educational library or saved you bandwidth and disk space, consider supporting ongoing development, reverse engineering, and platform maintenance!

<p align="left">
  <a href="https://github.com/sponsors/M3rcena">
    <img src="https://img.shields.io/badge/Sponsor_on_GitHub-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white" alt="GitHub Sponsors" />
  </a>
</p>

### Ways to Support
* **GitHub Sponsors:** [Become a sponsor](https://github.com/sponsors/M3rcena) to fund continuous maintenance and build server costs.
* **Star the Repo:** Give the project a ⭐ on GitHub to help others discover it.
* **Community Translations:** Help localize the client into your language via our [Crowdin Hub](https://crowdin.com/project/udeler-reborn).
* **Report & Feedback:** Submit bug reports or feature suggestions through [GitHub Issues](https://github.com/M3rcena/Udeler-Reborn/issues) or chat directly on [Discord](https://discord.gg/ZgXKk6eTfC).

---

## 📄 License

This software is distributed under the terms of the **MIT License**. Check the root `LICENSE` profile for comprehensive parameters.
