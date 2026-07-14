# Inframe — Dashboard React App

A modern, AI-powered Classroom Attendance System dashboard built with React 19, Vite, and modern UI libraries.

## 🚀 Live Demo

**[https://inframe-dashboard.vercel.app](https://inframe-dashboard.vercel.app)**

## ✨ Features

- **Real-time Attendance Tracking** — Live camera feed with face recognition
- **Student Portal** — Student enrollment and self-check-in
- **Analytics Dashboard** — Attendance trends, statistics, and reports
- **Schedule Management** — Class scheduling and session management
- **Reports & Exports** — PDF/Excel export with filtering
- **Modern UI** — Built with React 19, Framer Motion, Recharts, Tailwind CSS

## 🛠 Tech Stack

| Category | Technologies |
|----------|-------------|
| Framework | React 19, Vite 8 |
| Routing | React Router v7 |
| Styling | Tailwind CSS, Framer Motion |
| Charts | Recharts, Chart.js |
| Auth | JWT Auth Context |
| API | Axios client with interceptors |

## 📦 Quick Start

```bash
# Install dependencies
npm install

# Development (runs frontend + backend)
npm run dev

# Frontend only
npm run dev:frontend

# Production build
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
dashboard/
├── src/
│   ├── api/           # API client & endpoints
│   ├── components/    # Reusable UI components
│   ├── context/       # React Context (Auth)
│   ├── hooks/         # Custom React hooks
│   ├── pages/         # Page components
│   └── main.jsx       # App entry point
├── public/            # Static assets
└── index.html         # HTML template
```

## 🚀 Deployment

Deployed on **Vercel** with automatic deployments from `main` branch.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000?logo=vercel)](https://inframe-dashboard.vercel.app)

### Vercel Configuration

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

## 📄 License

MIT License — feel free to use for learning or production.