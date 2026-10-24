# 🎓 Student Survival Kit (SSK)
> **Modern College Academic Command Center & Productivity Hub**  
> *Developed for College "Computing Aptitude" Project Submission*

[![C++17](https://img.shields.io/badge/Language-C%2B%2B17-blue.svg)](https://en.wikipedia.org/wiki/C%2B%2B17)
[![Framework](https://img.shields.io/badge/Backend-Crow%20v1.2.0-purple.svg)](https://crowcpp.org/)
[![JSON](https://img.shields.io/badge/JSON-nlohmann%2Fjson-green.svg)](https://github.com/nlohmann/json)
[![AI](https://img.shields.io/badge/AI-Anthropic%20Claude%203.5-orange.svg)](https://www.anthropic.com/)
[![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20HTML5%20%7C%20CSS3%20%7C%20JS-yellow.svg)](https://developer.mozilla.org/)

---

## 🌟 Overview

**Student Survival Kit (SSK)** is a high-performance student productivity web application engineered to solve the most pressing challenges of college life. It centralizes assignment deadlines, calculates attendance thresholds (including the critical 75% college rule), runs live examination countdown clocks, tracks daily tasks with drag-and-drop reordering, and features an integrated **AI Study Advisor** (powered by Anthropic's Claude 3.5 API and a local fallback engine).

---

## 🚀 Key Features

### 1. 📊 Executive Academic Dashboard
- **Dynamic Productivity Score (0–100%)**: An algorithmically computed composite score incorporating today's task completion rate (40%), assignment progress (35%), and overall attendance health (25%).
- **Interactive SVG Progress Ring**: Visualizes live productivity status ("Exceptional", "On Track", "Needs Attention").
- **Nearest Exam Counter**: Real-time ticking countdown showing Days, Hours, Minutes, and Seconds.
- **7-Day Deadline Stream**: Flags imminent deadlines with color-coded urgency badges.
- **Attendance Bar Chart**: Visualizes subject attendance side-by-side using Chart.js with the mandatory 75% target threshold line.

### 2. 📝 Assignment Management System
- Complete CRUD operations: Title, Subject, Due Date/Time, Priority (High/Medium/Low), Status (Pending/In-Progress/Done), Weightage %, and Description.
- Dynamic search and multi-criteria filtering by subject, priority, and status.
- Quick status switcher directly from assignment cards.

### 3. 🎯 Attendance 75% Rule Engine & Bunk Calculator
College students face mandatory attendance thresholds (typically 75%). SSK provides mathematically rigorous guidance for every subject:
- **Safe Zone ($\ge 75\%$)**: Calculates the maximum number of classes the student can safely bunk without falling below the cutoff:
  $$\text{Classes Can Bunk} = \left\lfloor \frac{100 \times \text{Attended} - 75 \times \text{Total}}{75} \right\rfloor$$
- **Danger Zone ($< 75\%$)**: Calculates the minimum consecutive classes the student must attend to restore their attendance to 75%:
  $$\text{Classes Must Attend} = \left\lceil \frac{75 \times \text{Total} - 100 \times \text{Attended}}{25} \right\rceil$$
- **One-Click Actions**: "+ Present" and "+ Absent" buttons for instant updates with zero latency.

### 4. 📅 Deadlines & Interactive Calendar
- **Full Monthly Calendar View**: Day-by-day visualization with color-coded marker dots for assignments and exams.
- **Date Inspector**: Clicking any day displays all deliverables due on that specific date.
- **Chronological List**: Automatically highlights overdue items with prominent red alerts.

### 5. ⏳ Live Examination Countdowns
- Visual flip-card digital countdown ticking every single second.
- Venue information, syllabus notes, and grade weightage breakdown.
- Add/Edit exam modals with automatic sorting by proximity.

### 6. ✅ Daily Tasks & Habits (Drag-to-Reorder)
- Inline quick-add bar with category and priority tagging.
- HTML5 Drag-and-Drop reordering + accessible Move Up / Move Down controls.
- Automatic server persistence via `POST /api/tasks/reorder`.
- SVG circular completion ring tracking daily goals.

### 7. 🤖 AI Study Buddy ("Aura")
- **Dual Interface**: Full dedicated view + slide-over quick drawer accessible from any screen.
- **Personalized Context Injection**: Injects the student's actual assignments, attendance shortages, and exams into the system prompt.
- **Specialized Modes**:
  - **Study Planner**: Generates a 7-day revision schedule with dedicated Pomodoro focus blocks.
  - **Smart Weekly Summary**: Analyzes low-attendance subjects, impending deadlines, and top 3 priorities.
  - **Study Guidance**: Free-form chat for concept review, active recall strategies, and viva prep.
- **Dual-Mode Reliability**: Connects live to **Anthropic Claude 3.5 / Haiku** when `ANTHROPIC_API_KEY` is provided; seamlessly falls back to a smart local rule engine if offline or key is missing.

---

## 🛠️ Tech Stack Architecture

| Layer | Technology | Details |
|---|---|---|
| **Backend** | **C++17** | High-performance, memory-safe, compiled binary |
| **HTTP Framework** | **Crow v1.2.0** | Modern header-only microframework inspired by Flask |
| **JSON Serialization** | **nlohmann/json v3.11.3** | Intuitive, strongly-typed JSON library |
| **HTTP Client** | **libcurl** | Secure HTTPS client for calling the Anthropic API |
| **Frontend** | **Vanilla HTML5, CSS3, JS** | Zero dependencies, no heavy build tools, pure browser APIs |
| **Data Persistence** | **JSON Flat-File** | Thread-safe, atomic disk storage in `data/db.json` |
| **Visualization** | **Chart.js v4.4** | Clean canvas-based attendance and productivity charts |

---

## 📁 Project Structure

```
student-survival-kit/
├── CMakeLists.txt                # CMake build configuration (FetchContent)
├── main.cpp                      # C++ entry point & Crow server initialization
├── server.py                     # Zero-dependency Python companion runner for instant testing
├── README.md                     # Complete project documentation
├── VIVA_GUIDE.md                 # Viva examination preparation and defense guide
├── data/
│   └── db.json                   # Local persistent JSON storage with rich sample data
├── include/
│   ├── models.hpp                # C++ data models with nlohmann/json serialization & math
│   ├── storage.hpp               # Thread-safe DatabaseManager with atomic file persistence
│   ├── ai_service.hpp            # libcurl Anthropic Claude integration & local fallback
│   └── routes.hpp               # Crow HTTP routes, static file serving, CORS headers
├── public/
│   ├── index.html                # Modern semantic HTML5 markup
│   ├── style.css                 # Obsidian dark/light glassmorphic SaaS design system
│   └── app.js                    # Vanilla JS application state, timers, and charts
└── scripts/
    ├── build_msvc.bat            # Windows MSVC 2022 build script
    ├── build_mingw.bat           # Windows MinGW-w64 build script
    └── build_linux.sh            # Linux build script
```

---

## ⚡ Quick Start: 2-Second Test Preview

If you want to immediately launch and preview the complete web application right now:

```bash
# From the student-survival-kit folder:
python server.py
```
Open **`http://localhost:8080`** in any browser. All features (Dashboard, Attendance math, Deadlines, Exams, Tasks, and AI) work out-of-the-box!

---

## 🔨 Step-by-Step C++ Build & Run Instructions

### 1. Windows (Visual Studio 2022 / MSVC)

#### Prerequisites:
- Visual Studio 2022 with **"Desktop development with C++"**
- CMake 3.16+
- libcurl (installed via vcpkg or system PATH)

#### Build Commands:
```cmd
cd student-survival-kit
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release

# (Optional) Set your Anthropic API Key:
set ANTHROPIC_API_KEY=your_actual_api_key_here

# Run the server:
cd Release
student_survival_kit.exe
```

---

### 2. Windows (MinGW-w64 / MSYS2)

#### Prerequisites:
Install MinGW-w64 with GCC 9+ and CMake:
```bash
pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-cmake mingw-w64-x86_64-curl
```

#### Build Commands:
```cmd
cd student-survival-kit
mkdir build
cd build
cmake .. -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build . -j4

# Run the server:
student_survival_kit.exe
```

---

### 3. Linux (Ubuntu / Debian / Raspberry Pi)

#### Prerequisites:
```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake libcurl4-openssl-dev libboost-all-dev libasio-dev
```

#### Build Commands:
```bash
cd student-survival-kit
chmod +x scripts/build_linux.sh
./scripts/build_linux.sh

# Run executable:
cd build
export ANTHROPIC_API_KEY="your_actual_api_key_here"  # optional
./student_survival_kit
```

---

## 🌐 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Returns composite productivity score, deadlines, and metrics |
| `GET` | `/api/assignments` | Retrieves all assignments |
| `POST` | `/api/assignments` | Creates a new assignment |
| `PUT` | `/api/assignments/:id` | Updates an existing assignment |
| `DELETE`| `/api/assignments/:id` | Deletes an assignment |
| `GET` | `/api/attendance` | Returns all subjects with 75% bunk/attend calculations |
| `POST` | `/api/attendance` | Adds a new attendance subject |
| `POST` | `/api/attendance/:id/mark` | Quick mark class: `{ "present": true/false }` |
| `PUT` | `/api/attendance/:id` | Updates a subject's attendance counts |
| `DELETE`| `/api/attendance/:id` | Removes a subject from attendance |
| `GET` | `/api/exams` | Lists all upcoming exams |
| `POST` | `/api/exams` | Adds a new exam with date/time and syllabus |
| `PUT` | `/api/exams/:id` | Updates an exam |
| `DELETE`| `/api/exams/:id` | Removes an exam |
| `GET` | `/api/tasks` | Lists daily to-do tasks sorted by order index |
| `POST` | `/api/tasks` | Creates a new daily task |
| `PUT` | `/api/tasks/:id` | Updates task title or completed status |
| `POST` | `/api/tasks/reorder` | Reorders tasks given an array of IDs |
| `DELETE`| `/api/tasks/:id` | Deletes a daily task |
| `POST` | `/api/ai` | Processes student query, returns Claude / local advice |
| `GET` | `/api/profile` | Retrieves student profile info |
| `PUT` | `/api/profile` | Updates student profile info |

---

## 🔒 Security & Best Practices
- **No API Key Exposure**: The Anthropic API key is strictly read server-side from `ANTHROPIC_API_KEY` and is never passed or visible to the client browser.
- **Directory Traversal Protection**: Static file requests in Crow and Python sanitize relative paths against `..` exploits.
- **Thread Safety**: All file reads/writes in C++ are guarded by `std::mutex` locks.
- **Atomic Persistence**: Database records are cleanly flushed to disk so that server restarts never corrupt data.
