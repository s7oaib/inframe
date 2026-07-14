# Inframe — AI Classroom Attendance System

Inframe is a modern, real-time facial recognition attendance system designed for educational institutions. Using CCTV camera feeds and facial embeddings, Inframe automates attendance logging, provides real-time visualization of classroom attendance status, and enables administrators and students to manage schedules, view reports, and analyze attendance trends.

[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://inframe-dashboard.vercel.app/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.137-green?logo=fastapi)](https://fastapi.tiangolo.com/)

---

## 🚀 Key Features

*   **Real-time Tracking:** Real-time logging of classroom entries and exits via WebSockets.
*   **Facial Recognition Pipeline:** Face detection, liveness checking, and embedding comparisons.
*   **Student Portal:** Simple registration and login for students to view their attendance history and register their profiles.
*   **Instructor Dashboard:** Full management suite for sessions, schedule conflicts, student verification, and exports.
*   **Analytics & Reporting:** Interactive charts showing daily attendance, top-performing students, and customizable reports (CSV/JSON exports).
*   **Webcam Photo Enrollment:** High-quality face capture directly from the client interface with active user consent.

---

## 🛠 Tech Stack

### Backend
*   **Core:** Python, FastAPI
*   **Database:** SQLite, SQLAlchemy ORM
*   **Facial Processing:** Face embeddings & recognition
*   **Server:** Uvicorn (WebSockets enabled)

### Frontend (Dashboard)
*   **Framework:** React 19 (Vite 8)
*   **Animations:** Framer Motion
*   **Charts:** Chart.js, Recharts, React Chartjs 2
*   **Routing:** React Router v7

---

## 📁 Project Structure

```
Project Attendence/
├── .gitignore                   # Root gitignore excluding caches, databases & node_modules
├── README.md                    # Project documentation
├── attendence/
│   ├── backend/                 # FastAPI backend application
│   │   ├── config.py            # Overridable thresholds and app configuration
│   │   ├── database.py          # SQLAlchemy models and SQLite connection
│   │   ├── main.py              # Application startup, lifespan and root routes
│   │   ├── routes/              # API router modules (attendance, schedule, students, etc.)
│   │   ├── services/            # Face recognition embeddings & auth services
│   │   └── requirements.txt     # Python dependencies
│   │
│   └── dashboard/               # React + Vite frontend dashboard
│       ├── src/                 # React component source code
│       ├── public/              # Static assets
│       ├── package.json         # Node dependencies and npm scripts
│       ├── vercel.json          # Vercel deployment SPA rewrite configuration
│       └── vite.config.js       # Vite proxy settings for development
└── inframe.db                   # Local SQLite database (ignored by Git)
```

---

## 💻 Local Setup Guide

### 1. Backend Setup

Make sure you have Python 3.10+ installed.

1. Navigate to the backend directory:
   ```bash
   cd attendence/backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .venv\Scripts\Activate.ps1
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend will be running at `http://localhost:8000`. Swagger documentation is available at `http://localhost:8000/docs`.

### 2. Frontend Setup

Make sure you have Node.js 18+ installed.

1. Navigate to the dashboard directory:
   ```bash
   cd attendence/dashboard
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the development server (runs Vite and proxies API requests):
   ```bash
   npm run dev
   ```
   The dashboard will be running at `http://localhost:5174` (or `http://localhost:5173`).

---

## 🌐 Production Deployment

### Frontend (Vercel)
The React dashboard is configured for seamless deployment to **Vercel** with SPA fallback rewrites.
1. Build the production site locally or set the build settings on Vercel to:
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
   * **Install Command:** `npm install`
2. Set the `VITE_API_URL` environment variable on Vercel to point to your deployed FastAPI backend (e.g. `https://your-backend-api.com`).

---

## 📄 License
This project is proprietary and confidential. All rights reserved.
