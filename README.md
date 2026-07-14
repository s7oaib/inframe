# Inframe — AI Classroom Attendance System

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/FastAPI-0.137-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

> **Inframe** is a modern, real-time facial recognition attendance system designed for educational institutions. Using CCTV camera feeds and facial embeddings, it automates attendance logging, provides real-time classroom attendance visualization, and enables administrators and students to manage schedules, view reports, and analyze attendance trends.

---

## 🚀 Live Demo

| Service | URL |
|---------|-----|
| **Frontend Dashboard** | [https://inframe-dashboard.vercel.app](https://inframe-dashboard.vercel.app) |
| **API Docs (Swagger)** | `https://your-backend-api.com/docs` |

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Real-time Attendance** | Live camera feed with face detection & recognition via WebSockets |
| **Facial Recognition Pipeline** | Face detection → liveness check → embedding comparison |
| **Student Portal** | Registration, login, attendance history, profile management |
| **Instructor Dashboard** | Session management, schedule conflicts, student verification, exports |
| **Analytics & Reports** | Daily trends, top attendees, customizable CSV/PDF/Excel exports |
| **Webcam Enrollment** | High-quality face capture with active user consent |
| **Role-based Access** | JWT-based auth with role separation (Admin, Instructor, Student) |

---

## 🛠 Tech Stack

### Backend
| Layer | Technology |
|-------|------------|
| API Framework | **FastAPI** (Python 3.10+) |
| Database | **SQLite** + **SQLAlchemy ORM** |
| Face Recognition | Custom embeddings + similarity search |
| Real-time | **WebSockets** (Uvicorn) |
| Auth | **JWT** (access + refresh tokens) |

### Frontend
| Layer | Technology |
|-------|------------|
| Framework | **React 19** + **Vite 8** |
| Routing | **React Router v7** |
| Styling | **Tailwind CSS** + **Framer Motion** |
| Charts | **Recharts**, **Chart.js** |
| State | React Context + Custom Hooks |
| HTTP | **Axios** with interceptors |

---

## 📁 Project Structure

```
inframe/
├── .gitignore
├── README.md
├── attendence/
│   ├── backend/                 # FastAPI backend
│   │   ├── config.py            # Config & thresholds
│   │   ├── database.py          # SQLAlchemy models & DB
│   │   ├── main.py              # App entry, lifespan, routes
│   │   ├── routes/              # API routers
│   │   │   ├── attendance.py
│   │   │   ├── auth.py
│   │   │   ├── schedule.py
│   │   │   ├── students.py
│   │   │   └── ...
│   │   ├── services/            # Business logic
│   │   │   ├── face_recognition.py
│   │   │   └── auth_service.py
│   │   └── requirements.txt
│   │
│   └── dashboard/               # React + Vite frontend
│       ├── src/
│       │   ├── api/             # Axios client & endpoints
│       │   ├── components/      # Reusable UI components
│       │   ├── context/         # AuthContext, etc.
│       │   ├── hooks/           # Custom React hooks
│       │   ├── pages/           # Page components
│       │   └── main.jsx         # App entry
│       ├── public/
│       ├── package.json
│       ├── vercel.json          # Vercel SPA config
│       └── vite.config.js
│
└── inframe.db                   # SQLite DB (gitignored)
```

---

## 💻 Local Development

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **Git**

### 1. Backend Setup
```bash
cd attendence/backend

# Create virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server (with auto-reload)
uvicorn main:app --reload --port 8000
```
> API docs available at `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
cd attendence/dashboard

# Install dependencies
npm install

# Start dev server (proxies API to backend)
npm run dev
```
> Frontend runs at `http://localhost:5174` (proxies `/api` → `http://localhost:8000`)

---

## 🌐 Production Deployment

### Frontend → Vercel (Automatic)
1. Push to GitHub → Connect repo in Vercel
2. Build settings auto-detected from `vercel.json`:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
3. Set `VITE_API_URL` env var to your backend URL
4. Deploy 🚀

### Backend Options
| Platform | Notes |
|----------|-------|
| **Render / Railway / Fly.io** | Native Python support, WebSocket support |
| **Docker + VPS** | Full control, Dockerfile included below |
| **AWS/GCP/Azure** | Container services or VMs |

#### Dockerfile (Backend)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 🔐 Environment Variables

### Backend (`attendence/backend/.env`)
```env
SECRET_KEY=your-super-secret-jwt-key
DATABASE_URL=sqlite:///./inframe.db
ALLOWED_ORIGINS=http://localhost:5174,https://inframe-dashboard.vercel.app
```

### Frontend (`attendence/dashboard/.env`)
```env
VITE_API_URL=http://localhost:8000
# Production:
# VITE_API_URL=https://your-backend-api.com
```

---

## 📚 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login (returns access + refresh tokens) |
| `POST` | `/api/auth/register` | Student registration |
| `GET` | `/api/students` | List all students |
| `POST` | `/api/students` | Create student |
| `GET` | `/api/attendance` | Get attendance records |
| `POST` | `/api/attendance` | Log attendance |
| `GET` | `/api/schedule` | Get schedule |
| `POST` | `/api/schedule` | Create session |
| `WS` | `/ws/attendance` | Real-time attendance feed |

> Full interactive docs: `GET /docs` (Swagger UI)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Face Recognition** — Inspired by face_recognition library concepts
- **UI Components** — Built with Tailwind CSS + Framer Motion
- **Charts** — Recharts & Chart.js communities
- **Deployment** — Vercel for seamless frontend hosting

---

<p align="center">
  Made with ❤️ for modern education
</p>