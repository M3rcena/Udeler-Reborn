# Changelog

All notable changes to **Udeler Reborn** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---
 
## [3.3.0] - 2026-08-26
 
This release focuses on making the app easier to use at scale and easier to trust as a project — bulk library actions, a real localization system, in-app release notes, and a proper testing/CI pipeline.
 
### Added
- **Bulk Course Selection** — select multiple courses in the Library view (or use "Select All") and queue them all for download in a single action, instead of opening each course individually.
- **Download Queue Reordering** — the Downloads tab now includes a Queue Manager panel where pending items can be moved up or down to control what downloads next.
- **Localization (i18n)** — the UI now ships with a full translation system, available at Settings → Language. English (US) and Greek are included at launch, with a flag-based language switcher and a community-translation workflow for contributing additional languages.
- **In-App Release Notes** — an "Update Available" toast now includes a **What's New** button that opens the actual GitHub release notes, rendered as formatted text inside the app. A one-time **What's New** dialog also appears automatically the first time the app is opened after an update.
- **Automated Test Suite** — introduced Vitest-based unit tests covering the vault encryption engine, database/manifest layer, bandwidth throttle, search service, IPC audit layer, and OS validation schemas.
- **Continuous Integration** — pull requests and pushes to `master` now run a GitHub Actions pipeline that type-checks, lints, and runs the test suite on Windows, macOS, and Linux before anything merges.
- **Structured Issue & PR Templates** — bug reports now use a guided form (OS, app version, account type, diagnostic log export) instead of a free-text box, alongside a new feature-request template and pull request checklist.
### Fixed
- The startup update-checker and post-update "What's New" dialog were pointed at the project's current repository; both previously referenced a legacy pre-rename repository path.
### Changed
- Added `scripts/export-i18n.ts` to help maintain and validate translation files as new languages are added.

---

## [3.2.0] - 2026-08-05

This is a massive milestone release that transforms Udeler Reborn from a simple downloader into a resilient, background-aware, and highly secure local course library.

### Added

- **Native OS Integration Suite** — download progress now shows directly in the Windows Taskbar / macOS Dock, a Jump List exposes quick actions like "Resume Last Course", and minimize-to-tray support was added with a live download-speed tooltip.
- **Bandwidth Throttling** — set a max download speed (KB/s) so the app doesn't consume the entire connection.
- **Scheduled Downloads** — configure specific download windows (e.g. 1 AM – 6 AM) for large course batches.
- **Rich Local Search** — `Cmd/Ctrl+K` opens a local search engine covering course titles, lectures, and full-text transcript/subtitle contents, so any keyword can be found across the entire library.
- **Smart Storage Tiering (External/NAS)** — pin individual courses to external SSDs or NAS mounts; if a mapped drive is unplugged, the UI shows a graceful "Offline - Archived" state instead of broken errors.
- **Content-Addressable Storage (CAS) & Deduplication** — downloaded assets are hashed (SHA-256) and deduplicated, so reused instructor intro/outro clips or PDFs are only stored once. Reclaimed space is now visible in the Storage tab.
- **Background Integrity & Self-Healing Scans** — a new "Library Health" panel runs non-blocking background workers that verify every downloaded file against its expected checksum/size, flag corruption, and offer one-click "Auto-Repair" to re-fetch only the broken files.
- **Encrypted-at-Rest Vault Mode** — downloaded videos and auth tokens can now be encrypted on disk with AES-256-GCM, with decryption keys derived from the OS-native credential store (Windows Credential Manager / macOS Keychain / libsecret) and media decrypted on-the-fly in memory.
- **Zero-Trust IPC Auditing** — a strict, deny-by-default IPC capability manifest now assigns every exposed method a declared risk tier (`filesystem-write`, `credential-access`, etc.) with rate limiting and frame origin validation. Live audit pass/fail stats are viewable in the About tab.

### Changed

- Added `scripts/prebuild.ts` to automate versioning and updated background worker configurations.
- Upgraded underlying dependencies, including Electron, React, and `@tailwindcss/postcss`.
- Integrated `better-sqlite3` for high-performance synchronous manifest management.

### Security

- CI/CD now runs `npm audit fix` for automated security enforcement.

---

## [3.1.1] - 2026-06-02

A minor patch update focused on expanding account compatibility and fixing curriculum rendering bugs.

### Added

- **Udemy Business Support** — a dedicated toggle and subdomain input for Enterprise/Business accounts, so both automated and manual login flows correctly route through company SSO portals.

### Fixed

- **Subscription Course Fetching** — resolved an API routing issue where courses accessed via a monthly Udemy Personal/Pro subscription weren't appearing alongside standard purchased courses.
- **Curriculum Sorting** — chapters and lectures are now sorted by Udemy's visual chronological index instead of internal database IDs.
- **Duration Badges** — the "Minutes" duration badge is now strictly reserved for video lectures, preventing confusing time estimates on text articles and quizzes.

---

## [3.1.0] - 2026-05-30 — "The Premium Learning Update"

This update transforms Udeler Reborn from a downloader into a fully-fledged desktop learning platform, with automated authentication, intelligent tracking, and seamless course syncing.

### Added

- **Automated Udemy Login** — log in directly and securely through the Udemy portal inside the app; no more manually extracting and pasting bearer tokens.
- **Intelligent Course Updates** — automatically detects when an instructor adds new videos to an already-downloaded course and flags them with a "NEW" badge.
- **Archived Video Protection** — if an instructor removes a video from Udemy that's already been downloaded, it's moved to a dedicated "📦 Archived (Removed by Instructor)" chapter instead of being hidden or lost.
- **Cross-Session Watch Progress Tracking** — the native media player now saves exact playback position to disk, shows progress bars across the Library and Curriculum lists, and resumes videos exactly where you left off, even across app restarts.

### Changed

- Redesigned the media player's "Close Player" control into a large, clearly visible button in the top right of the window.
- Enlarged file-type icons (Video/Document) in the Library explorer for easier scanning.
- Closing the video player now silently refreshes disk data and watch progress in the background instead of showing the full "Scanning local disk..." loading screen.

### Fixed

- Refactored the native video player hooks to strictly use `useRef` for DOM nodes, eliminating synchronous state leaks and cascading re-renders.
- Hardened IPC bridge types end-to-end, with frontend payloads now matching backend schema requirements via strict unions and `Omit` utility types.
- Rewrote `electron-store` progress tracking to use a flat dictionary indexed by globally unique `lectureId`s, bridging local disk files with live API data.

---

## [3.0.0] - 2026-05-18 — "Welcome to Udeler Reborn"

The official release of Udeler Reborn Version 3 — a complete, ground-up rewrite of the application, modernizing the architecture for a faster, more secure, and more reliable desktop experience.

### Added

- Rebuilt on a modern Electron and Node.js foundation for improved performance and stability.
- Strict Context Bridge and sandboxed renderer processes for enhanced security.
- Modernized UI/UX, rebuilt from scratch.
- Native, optimized cross-platform builds for Windows, macOS (Apple Silicon), and Linux (AppImage, `.deb`, and Snap).
- Built-in auto-updater, so future updates stream directly to the app without a manual download from GitHub.
