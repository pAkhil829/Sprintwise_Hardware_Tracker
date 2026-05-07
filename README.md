# ⚡ Sprintwise Hardware Tracker

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Storage](https://img.shields.io/badge/database-LocalStorage-orange.svg)
![UI](https://img.shields.io/badge/UI-Glassmorphism-cyan.svg)

> **Sprintwise** is a lightning-fast, zero-install Single Page Application (SPA) built for engineering teams. It provides a secure, client-side environment to track hardware boards, test devices, and shared resources across active development sprints.

---

## 🌟 Core Features

### 📦 Master Stock & Inventory
* **Strict Stock Limits (Hard Stop):** The system actively prevents logging more Serial Numbers (S/Ns) than the total physical units owned.
* **Missing Item Tracking:** Instantly flag specific boards as "Missing" to remove them from available stock and track losses.
* **Regional Tracking:** Categorize inventory accurately across standard and custom geographical regions.

### 🏃‍♂️ Sprint & Resource Management
* **Smart Allocation:** Assign specific boards and devices to borrowers and teams with expected return dates.
* **Auto-Archiving:** The system automatically detects expired sprints on startup and safely archives them to maintain dashboard performance.
* **Health Condition Tracking:** Log whether a board is "Working" or "Not Working" at the time of deployment and upon its return.

### 🔍 Deep Search & Traceability
* **S/N Lifecycle Trace:** Enter any Serial Number into the Global Search to instantly see its current status, active borrower, and its entire borrowing history across all past sprints.
* **Due Date Audit Trails (🕒):** A built-in ledger tracks every time a due date is modified, showing exactly when the deadline was changed and what the previous date was.

### 📋 The Unreturned Backlog
* **Persistent Tracking:** When a sprint is archived, all unreturned items automatically migrate to a dedicated Backlog tab.
* **Inline Remarks (💾):** Add and save custom notes or follow-up remarks directly to backlog items without needing to un-archive the original sprint.

### ⚙️ System Controls & Data Export
* **Custom CSV Exports:** Generate granular reports. Filter exports by specific sprints, resource categories (Boards vs. Devices), and select exactly which columns to download.
* **10MB Storage Monitor:** A built-in settings dashboard displays your browser's LocalStorage capacity usage via a visual progress bar.
* **Format Scan & Upgrade:** A one-click diagnostic tool ensures older data structures are instantly upgraded to current v1.1 standards.

---

## 🎨 UI & User Experience

Sprintwise is designed to be as beautiful as it is functional.

* **Deep Glassmorphism:** A modern, frosted-glass aesthetic with soft ambient background elements.
* **Bento-Grid Dashboard:** An organized layout that optimizes screen space and keeps crucial stats visible at all times.
* **Dynamic Dark/Light Mode (🌙/☀️):** Seamlessly switch between themes. 
* **Power-User Keyboard Shortcuts:** * Press `Enter` to instantly execute a Global S/N Search.
  * Press `Escape` to quickly close any open modal or menu.

---

## 🚀 Quick Start (Zero Installation)

Because Sprintwise runs entirely in your browser's memory, there is no backend to configure, no dependencies to install, and no servers to maintain.

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/YourUsername/Sprintwise_Hardware_Tracker.git](https://github.com/YourUsername/Sprintwise_Hardware_Tracker.git)
