# Contributing to Udeler Reborn

First off, thank you for taking the time to contribute! 🎉 

Udeler Reborn is an community-driven project aiming to provide a high-performance, modern, and reliable desktop course management application. Contributions from developers like you help make this tool better for everyone.

Please read through these guidelines to understand how to best interact with the project and submit your modifications.

---

## 🌿 Our Branching Model

All active development for the version 3 framework line happens on the `v3` branch. 

* **`v3`**: The main development branch for modern updates, TypeScript features, and bug fixes. All feature branches should target `v3`.

---

## 🐛 Reporting Bugs & Suggesting Features

We track everything using **GitHub Issues**. Before creating a new issue, please search existing issues to see if it has already been reported or discussed.

### Writing a Good Bug Report:
* **Use a descriptive title:** Summarize the issue clearly.
* **Provide environment details:** Mention your OS (Windows, macOS, Linux) and Node.js version.
* **Steps to reproduce:** Detail exactly how someone else can replicate the behavior.
* **Error logs:** Paste relevant frontend console errors or backend terminal outputs.

> ⚠️ **Security Vulnerabilities:** Do not report security vulnerabilities or data leaks through public GitHub issues. Please use the **Private Vulnerability Reporting** feature under the **Security** tab of this repository.

---

## 🛠️ Local Development Setup

To set up the development environment locally, follow these steps:

1. Fork this repository and clone your fork:
   ```bash
   git clone -b v3 https://github.com/YOUR_USERNAME/udeler_gui.git
   cd udeler_gui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application in development mode with Hot-Reloading:
   ```bash
   npm run dev
   ```

---

## 📥 Submitting a Pull Request (PR)

When you are ready to submit your changes, follow this workflow:

1. **Create a feature branch** off of `v3`:
   ```bash
   git checkout -b feature/your-awesome-feature
   ```
2. **Commit your changes:** Keep commits focused, modular, and use meaningful commit messages.
3. **Format your code:** Ensure your code matches the existing style rules by running the formatting scripts if configured.
4. **Push your branch:**
   ```bash
   git push origin feature/your-awesome-feature
   ```
5. **Open a Pull Request:** Target the **`v3`** branch of the main repository. Provide a thorough summary of what your code does, what issues it addresses, and any testing notes.

---

## 📜 Code Style Guidelines

* **TypeScript Type Safety:** Ensure strict typing across both the Electron main process and React renderer process. Avoid using `any` whenever possible.
* **Tailwind & UI:** Keep the layout fluid, fully accessible, and responsive. If your element is an interactive clickable target, include the `cursor-pointer` utility class.
* **Context Bridge Separation:** Do not attempt to run Node.js core modules (`fs`, `path`, etc.) directly inside the React frontend components. Expose these safe mappings via `src/preload/index.ts` using IPC handlers.