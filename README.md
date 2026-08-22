<div align="center">
  <br />
  <img src="https://raw.githubusercontent.com/m3rcena/Udeler-Reborn/v3/src/renderer/src/assets/brand.svg" alt="Udeler Reborn Logo" width="480" />
  <br />
  <h3><b>Udeler Reborn (v3)</b></h3>
  <p>An advanced, high-performance, asynchronous desktop platform for offline course management.</p>

  <p>
    <img src="https://img.shields.io/github/v/release/m3rcena/Udeler-Reborn?include_prereleases&style=for-the-badge&color=2563eb" alt="Release" />
    <img src="https://img.shields.io/github/license/m3rcena/Udeler-Reborn?style=for-the-badge&color=7e22ce" alt="License" />
    <img src="https://img.shields.io/github/stars/m3rcena/Udeler-Reborn?style=for-the-badge&color=00e5ff" alt="Stars" />
    <img src="https://img.shields.io/badge/version-3.2.0-00e5ff?style=for-the-badge" alt="Version 3.2.0" />
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

### 🆕 New in v3.2.0

- **🖥️ Native OS Integration** — Live taskbar/dock download progress, a system tray icon with pause/resume/cancel controls, and a Jump List for instantly resuming your last course or continuing recently-watched lectures, without ever bringing the window into focus.
- **🐢 Bandwidth Throttling & Scheduled Download Windows** — Cap download speed with a token-bucket rate limiter, or restrict large batch downloads to off-peak hours (e.g. overnight) so Udeler never competes with the rest of your household's connection.
- **🔎 Full-Text Library Search** — A local search index built over course metadata and subtitle tracks lets you find every lecture across your entire library that mentions a specific term — something the Udemy web player can't do at all. Try pressing **Ctrl + K**!
- **🗜️ Content-Addressable Storage & Deduplication** — Downloaded assets are hashed and stored in a shared content-addressable blob store, so instructors' reused intro clips, outros, and resource files are only ever stored once across your whole library. A background garbage collector reclaims space automatically and reports exactly how much was saved.
- **🩺 Library Health & Self-Healing Scans** — A background worker verifies every downloaded file against its expected checksum, flags corruption from partial downloads or disk errors, and offers one-click repair that re-fetches only the broken files using the existing delta-update pipeline.
- **💾 Smart Storage Tiering (External Drives & NAS)** — Pin individual courses to an external SSD or network share while keeping active courses on your fast local disk. Udeler detects drive attach/detach in real time and gracefully marks courses "offline" instead of breaking, when their volume isn't mounted.
- **🔐 Encrypted Vault Mode** — Optional at-rest encryption (AES-256-GCM) for downloaded media and stored credentials, with the master key sealed behind your OS's native credential store (Windows Credential Manager, macOS Keychain, or libsecret on Linux) via Electron's `safeStorage`. Files are streamed through dedicated encrypt/decrypt transform streams, so nothing decrypted ever touches disk.
- **🛡️ Zero-Trust IPC Audit Layer** — Every single main↔renderer IPC channel is routed through a capability manifest that tags it with a risk tier, enforces per-channel rate limits, and rejects calls originating from any unauthorized sub-frame — hardening the context bridge itself rather than just the code running behind it.

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

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v20 or higher) and `npm` installed on your development workstation.

### Installation & Initialization

1. Clone your active development branch:

   ```bash
   git clone -b v3 https://github.com/m3rcena/Udeler-Reborn.git
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

- The **Waiting** telemetry module displays absolute metrics remaining in the queue array.
- The **In Progress** counter tracks active background processes.
- The processing matrix updates state metrics seamlessly even if you return to alternative navigational tabs.
- Live progress mirrors to the OS taskbar/dock and system tray, so you can track downloads without keeping the window in focus.

### 4. Library Health & Storage

- Run an on-demand or scheduled **Library Health** scan to verify every downloaded file against its expected checksum and automatically repair any corruption.
- Review reclaimed storage from automatic deduplication, and pin individual courses to external drives or network shares from the **Storage** panel.

---

## 📐 Project Directory Structure

```text
├── .github/                     # Repository metadata profiles
├── build/                       # OS entitlement rules & distribution parameters
├── resources/                   # Application-wide icons (.ico, .icns, .png, .svg)
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
│   │   └── validation/          # Zod schemas for IPC-adjacent data structures
│   ├── preload/                 # Electron Context Bridge Isolation Layer
│   │   ├── index.ts             # Generic API Invoker bridge
│   │   └── types/ipc-types.d.ts # Single Source of Truth E2E Type Definitions
│   └── renderer/                # React Client Frontend Layer
│       ├── index.html           # Client viewport with hardened Content Security Profile
│       └── src/
│           ├── assets/          # Vector design definitions and global CSS styles
│           ├── components/      # Modular overlays, search, and library health panels
│           ├── contexts/        # React context state engine pipelines
│           ├── views/           # Application views (Library Explorer, Settings)
│           └── App.tsx          # Main state routers
├── electron-builder.yml         # Desktop compilation assembly rules
└── electron.vite.config.ts      # Vite bundler parameters
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

Join our community to report issues, suggest features, or chat with other developers and users!

<div align="center">
  <br />
  <a href="https://discord.com/invite/W5UYYTPX" target="_blank">
    <img src="https://readme-stats-mocha-one.vercel.app/api/discord?id=1447491639550410796&bg_color=141321&title_color=70a5fd&icon_color=f8d847&text_color=a9fef7" alt="M3rcena Development Discord Server" />
  </a>
  <br />
</div>

---

## 📄 License

This software is distributed under the terms of the **MIT License**. Check the root `LICENSE` profile for comprehensive parameters.
