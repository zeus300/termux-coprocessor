<div align="center">

# 🚀 Termux ARM64 Co-Processor & Database Offloading Engine
### *Transform any Android smartphone into an ARM64 offloading co-processor and dedicated PostgreSQL database server for Windows 11*

<p>
  🌐 <b>Language / Idioma:</b> <b>English</b> • <a href="README_es.md">Español</a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows%2011%20%7C%20Android%20Termux-blue.svg)](https://termux.dev)
[![Architecture](https://img.shields.io/badge/Architecture-ARM64%20aarch64-green.svg)](https://github.com)
[![Engine](https://img.shields.io/badge/Engine-PostgreSQL%2018.2%20%7C%20Node.js-informational.svg)](https://www.postgresql.org)
[![Connection](https://img.shields.io/badge/Connection-USB%20ADB%20%7C%20Wireless%20WiFi-orange.svg)](https://developer.android.com/tools/adb)

> **Designed and Developed by:** [Marcos Bazán](https://github.com/zeus300)  
> **Community:** Open Source contribution for modern developers

</div>

---

## 🌟 What is this project and why is it unique?

Most software engineers working on laptops face a recurring pain point: spinning up local developer databases like **PostgreSQL** or running **Docker Desktop** immediately eats **2 to 4.5 GB of laptop RAM**, triggers cooling fans, and reduces battery life.

Meanwhile, almost everyone has an **Android smartphone** (either daily driver or an older device sitting in a drawer) powered by an **Octa-Core ARM processor (Snapdragon, MediaTek, Exynos)** and **4 to 8 GB of RAM** that are largely idle.

**This project creates a distributed hybrid compute bridge** between Windows 11 and Android (Termux):
1. **Dedicated Native PostgreSQL 18.2 Server:** 100% of database computation and disk I/O runs physically inside the phone's ARM chip. On your Windows laptop, memory consumption is **0 MB** and CPU load is **0%**.
2. **ARM64 Task Co-Processor (Offloading):** Delegate heavy Node.js scripts, data transformations, linting, or benchmarks straight to the mobile phone's CPU cores with a simple command (`termux-exec script.js`).
3. **Real-time Monitoring & Intelligent Failover:** Continuously monitors hardware and connection status. If you unplug the USB cable, Windows immediately switches to local fallback mode without freezing or throwing fatal crashes. Once you plug it back in, **the phone automatically resumes compute control**.
4. **Interactive Setup Wizard:** Automatically diagnoses missing permissions, ADB drivers, and provides a guided onboarding experience for both **USB Cable (<1ms latency)** and **Wireless ADB (Android 11+ Pairing Code)**.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 HOST PC (WINDOWS 11 / LAPTOP)               │
│                                                             │
│   • IDEs, VS Code, Browser, Frontend / Backend Code         │
│   • Offloading CLI: termux-exec.bat                         │
│   • Real-Time Monitor & Failover Daemon: cluster-manager.js │
│   • Database RAM Usage on Windows: 0 MB (0% CPU)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │       ADB Socket (Local Tunnel)     │
            │  • Option 1: USB Cable (< 1ms)      │
            │  • Option 2: Wireless WiFi (ADB)    │
            └──────────────────┬──────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│            SMARTPHONE ANDROID (TERMUX ARM64)                │
│                                                             │
│   • Compute Micro-Worker: 127.0.0.1:7777 (Node.js ARM)      │
│   • Database Server:      127.0.0.1:5432 (Postgres 18.2)   │
│   • 8 Dedicated ARM64 Cores handling heavy computation      │
│   • Continuous power supply via USB cable                   │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Performance Comparison

| Metric | Docker Desktop on Windows | Native PostgreSQL on Windows | Termux Co-Processor (This Project) |
| :--- | :---: | :---: | :---: |
| **PC RAM Footprint** | 2.5 GB – 4.5 GB | 300 MB – 800 MB | **0 MB (Zero impact on PC RAM)** |
| **PC CPU Load** | Medium / High | Medium | **0% (Offloaded to mobile ARM)** |
| **Thermal & Fan Noise** | Fans speed up | Increased heat | **Completely silent and cool** |
| **Portability** | Tied to PC drive | Tied to PC | **Pocketable database on your phone** |
| **Network Latency** | Localhost | Localhost | **< 1 ms (Direct USB socket)** |

---

## 📱 Hardware Compatibility

- **Any Android device running Android 7.0 or higher** (Android 8, 9, 10, 11, 12, 13, 14, 15+).
- Tested across **Snapdragon Octa-Core**, **MediaTek Helio/Dimensity**, and **Samsung Exynos** architectures.
- Recommended RAM: Devices with 2 GB, 3 GB, 4 GB, 6 GB, or 8 GB RAM.

---

## 🚀 Quick Start in 3 Minutes

### 1. Prerequisites
1. **On your PC:** Install [Node.js](https://nodejs.org) (v18 or newer).
2. **On your Phone:** Install **Termux** from its official distribution:
   - 📦 [Download APK from F-Droid (Recommended)](https://f-droid.org/packages/com.termux/)
   - 📦 [Download APK from GitHub Releases](https://github.com/termux/termux-app/releases/latest)
   *(⚠️ Warning: Avoid the outdated Google Play Store version).*

### 2. Clone the Repository
```bash
git clone https://github.com/zeus300/termux-coprocessor.git
cd termux-coprocessor
npm install
```

### 3. Launch with 1-Click
Simply double-click:
```cmd
iniciar.bat
```
*(Or execute `npm start` in your terminal).*

If this is your first time or if the phone is not yet paired, the **Interactive Setup Wizard** will open automatically.

---

## 🧙‍♂️ Interactive Setup Wizard

The setup assistant (`setup-wizard.js` / `setup.bat`) handles end-to-end configuration with zero guesswork:

```
  ┌─ PAIRING & SETUP WIZARD ────────────────────────────────────────┐
  │  Turn your Android phone into an ARM co-processor & DB server   │
  └─────────────────────────────────────────────────────────────────┘
```

1. **ADB Auto-Detection:** Automatically locates ADB in PATH or within the Android SDK directory, offering immediate download guidance if missing.
2. **Flexible Connection Modes:**
   - **Option [1] USB Cable:** Plug & Play with sub-millisecond latency and continuous charging.
   - **Option [2] Wireless WiFi (ADB):** Fully supports Android 11+ Wireless Debugging (6-digit Pairing Code + Real Connection Port).
3. **Guided Authorization Check (`unauthorized`):**
   - If your phone displays a security prompt, the console alerts you:
     > *"Unlock your phone screen, check 'Always allow from this computer', and tap OK"*.
   - When you press **Enter** or type `yes`, the wizard immediately re-tests the socket in real-time.
4. **Termux Environment Validation:**
   - Verifies if `com.termux` is installed.
   - Automatically injects or displays the master initialization command:
     ```bash
     pkg update -y && pkg install -y nodejs postgresql && termux-wake-lock
     ```
5. **ARM Worker & Port Forwarding Deployment:**
   - Automatically transfers `worker.js` to Termux `$HOME`.
   - Opens local tunnels (`adb forward tcp:7777 tcp:7777` and `adb forward tcp:5432 tcp:5432`).
6. **Live ARM Benchmark:**
   - Dispatches a prime-number calculation directly to the smartphone's ARM CPU, displaying execution time, active cores, and available RAM live.

---

## 🛠️ Usage Guide

### 1. Offloading Commands and Scripts to the ARM Processor
Use the `termux-exec` CLI:

- **Execute any terminal command inside the phone:**
  ```cmd
  termux-exec "node -e 'console.log(process.arch)'"
  termux-exec "uname -a"
  ```

- **Dispatch a local JavaScript file to run on the phone's CPU:**
  ```cmd
  termux-exec heavy-script.js
  ```
  *(The script is transferred in milliseconds, executes across the phone's Octa-Core ARM processor, and prints clean output to your Windows console with 0% PC CPU load).*

### 2. Connect Your Project to PostgreSQL on Android
Use the standard connection string in your `.env` file:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public"
```

Fully compatible with:
- **ORMs:** Prisma, Drizzle, TypeORM, Sequelize.
- **Frameworks:** Next.js, Nuxt, NestJS, Express, FastAPI, Django, Laravel, Spring Boot.
- **Database GUI Clients:** DBeaver, TablePlus, pgAdmin, DataGrip.

### 3. Real-Time Database Connection Monitor
To monitor active client sessions and queries live:
```cmd
ver-conexiones.bat
```
*(Or run `npm run connections`).*

---

## 🔄 Intelligent Automatic Failover

The `cluster-manager.js` background monitor watches your setup:
- **Phone Connected via USB:**
  The phone assumes full compute engine and database responsibilities.
- **USB Cable Disconnected:**
  Detected in under 2.5 seconds. Cleans local sockets and enables graceful PC contingency mode without crashing your running applications.
- **USB Cable Reconnected:**
  Instantly detects the device, restores ADB tunnels, ensures Termux processes are active, and **the smartphone seamlessly resumes control**.

---

## 📂 Repository Structure

```
termux-coprocessor/
│
├── iniciar.bat              # Smart 1-click master launcher
├── setup.bat                # Direct access to the Setup Wizard
├── setup-wizard.js          # Interactive configuration wizard (USB & WiFi)
│
├── cluster-manager.js       # Real-time daemon, CPU/RAM monitor & failover engine
├── termux-exec.bat          # Windows CLI for task offloading to mobile CPU
├── termux-exec.js           # HTTP client connecting to mobile ARM Worker
├── worker.js                # Distributed execution micro-daemon for Termux
│
├── iniciar-postgres.bat     # PostgreSQL and monitor launcher
├── ver-conexiones.bat       # Active SQL client connections monitor
├── ver-conexiones.js        # Real-time query inspector for pg_stat_activity
├── adb-forward.ps1          # PowerShell ADB forwarding script
├── test-arm.js              # Mathematical benchmark script
│
├── package.json             # NPM metadata and scripts
├── LICENSE                  # MIT Open Source License
├── README.md                # Official English documentation
└── README_es.md             # Official Spanish documentation
```

---

## ❓ Frequently Asked Questions (FAQ)

### Does Android kill Termux in the background?
No, as long as `termux-wake-lock` is enabled. The setup wizard runs this automatically. Additionally, ensure you disable "Battery Optimization" for Termux in your Android settings.

### Can I use this without a USB cable?
Yes! You can use the **Wireless WiFi Debugging** mode included in the wizard. Just ensure your PC and Android phone are connected to the same Wi-Fi network.

### Can I use an old smartphone with a broken screen?
Absolutely. As long as the device turns on and has USB debugging enabled, it can serve as a permanent, ultra-low-power dedicated database server.

---

## 🤝 Contributing

Community contributions are warmly welcomed!
1. Fork this repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a **Pull Request**.

---

## 📜 License

This project is licensed under the **MIT License**. Feel free to use, modify, and distribute it. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <b>Find this useful? Give it a ⭐ star on GitHub and share it with fellow developers!</b>
</div>
