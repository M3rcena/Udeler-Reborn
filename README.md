<div align="center">
  <br />
  <img src="https://raw.githubusercontent.com/m3rcena/udeler_gui/v3/src/renderer/src/assets/brand.svg" alt="Udeler Reborn Logo" width="480" />
  <br />
  <h3><b>Udeler Reborn (v3)</b></h3>
  <p>An advanced, high-performance, asynchronous desktop platform for offline course management.</p>
  
  <p>
    <img src="https://img.shields.io/github/v/release/m3rcena/udeler_gui?include_prereleases&style=for-the-badge&color=2563eb" alt="Release" />
    <img src="https://img.shields.io/github/license/m3rcena/udeler_gui?style=for-the-badge&color=7e22ce" alt="License" />
    <img src="https://img.shields.io/github/stars/m3rcena/udeler_gui?style=for-the-badge&color=00e5ff" alt="Stars" />
  </p>
  
  <br />
</div>

---

## ✨ Features

* **📦 Centralized Background Execution Engine**
  * Downloads process non-blocking in the native backend thread while navigating the UI.
  * Adaptive state tracking prevents queue reset when closing or shifting tabs.
  * Global master controls allow pausing, resuming, or stopping the active pool safely.
* **📂 Explorer-Style Library View**
  * Automated directory aggregation that maps your downloaded files into interactive nested collections (`Library > Course > Chapter`).
  * Built-in dynamic storage computation reading precise allocations per file directly from native disk.
* **🎥 Secure Media Streaming**
  * Custom `local://` safe streaming protocol to bypass standard Chromium media-sandboxing rules.
  * Decoupled subtitle engine sanitizing, cleaning, and compiling `.vtt` tracks dynamically on-the-fly into embedded Data URIs to eliminate strict browser Cross-Origin Resource Sharing (CORS) faults.
* **⚙️ Complete Settings Synchronization**
  * Automated retries for failed downloads (up to 5 continuous passes).
  * Conditional synchronization configurations to filter supplementary attachments, asset structures, and localized caption languages.
  * Native asynchronous file migration when paths change on disk.

---

## 🛠️ Technology Stack

* **Core Framework:** Electron (Native Asynchronous Desktop Bridging)
* **Frontend Layer:** React 18, TypeScript (TSX), Tailwind CSS
* **Build System:** Vite, `electron-vite`
* **Data Management:** `electron-store` (Persistent Encrypted App Settings & DRM Mappings)
* **Packaging Toolchain:** `electron-builder`

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) and `npm` installed on your development workstation.

### Installation & Initialization

1. Clone your active development branch:
   ```bash
   git clone -b v3 https://github.com/m3rcena/udeler_gui.git
   cd udeler_gui
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
* **Storage Location:** Declare your primary output directory path. Moving paths triggers an instantaneous file migration script safely adjusting existing targets.
* **Conditional Synchronization:** Choose whether the background worker processes or drops external captions and structural documents (`.pdf`, `.zip`, etc.).

### 3. Background Processing Queue
Once you select a course module and append files to your actively working pipeline:
* The **Waiting** telemetry module displays absolute metrics remaining in the queue array.
* The **In Progress** counter tracks active background processes.
* The processing matrix updates state metrics seamlessly even if you return to alternative navigational tabs.

---

## 📐 Project Directory Structure

```text
├── .github/                 # Repository metadata profiles
├── build/                   # OS entitlement rules & distribution parameters
├── resources/               # Application-wide icons (.ico, .icns, .png, .svg)
├── src/
│   ├── main/                # Primary Electron Application Backend Process
│   │   ├── index.ts         # Window lifecycle and sandboxed IPC listeners
│   │   ├── download.ts      # Multi-stage request processor, file system sync
│   │   └── udemy.ts         # Course extraction mappings
│   ├── preload/             # Electron Context Bridge Isolation Layer
│   └── renderer/            # React Client Frontend Layer
│       ├── index.html       # Client viewport with hardened Content Security Profile (CSP)
│       └── src/
│           ├── assets/      # Vector design definitions and global CSS styles
│           ├── components/  # Modular overlays and notification components
│           ├── contexts/    # React context state engine pipelines
│           ├── views/       # Application views (Library Explorer, Settings)
│           └── App.tsx      # Main state routers
├── electron-builder.yml     # Desktop compilation assembly rules
└── electron.vite.config.ts  # Vite bundler parameters
```

---

## 🔒 Security Posture & Hardening

Udeler Reborn is designed to adhere to standard enterprise Electron application security metrics:
* **Strict Context Isolation:** Electron render engines are locked away from the bare operating system. Node APIs like `fs` and `child_process` are fully isolated to the backend layer and exposed safely via the Electron Context Bridge layer.
* **Hardened Content Security Policy (CSP):** The embedded `index.html` file employs a modern CSP directive policy limiting external injection patterns while carefully authorizing local file streaming configurations via `media-src 'self' local: blob: data:`.

---

## 📄 License

This software is distributed under the terms of the **MIT License**. Check the root `LICENSE` profile for comprehensive parameters.