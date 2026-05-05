# Heroku-Lite: DevOps-Based Online Code Deployment System

A simplified Platform-as-a-Service (PaaS) system inspired by Heroku that enables developers to deploy applications through an automated CI/CD pipeline with Docker containerization.

---

## 📋 Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Usage Guide](#usage-guide)
- [API Endpoints](#api-endpoints)
- [CI/CD Pipeline](#cicd-pipeline)
- [Screenshots](#screenshots)
- [Future Enhancements](#future-enhancements)

---

## 📖 About the Project

Traditional deployment methods require manual server configuration, dependency installation, and environment setup — processes that are time-consuming and error-prone. This project addresses these challenges by providing an automated deployment platform that:

- Eliminates the **"it works on my machine"** problem through Docker containerization
- Automates the entire **build → package → deploy** lifecycle
- Provides a **web-based dashboard** for deployment management
- Implements a **CI/CD pipeline** using GitHub Actions

---

## ✨ Features

### Core Features
- **Three Deployment Methods:**
  - 🏠 **Built-in App** — Deploy the included sample Node.js application
  - 🐙 **GitHub Repository** — Deploy directly from any public GitHub repo URL
  - 📁 **ZIP File Upload** — Upload and deploy application code as a ZIP archive

- **Smart Auto-Detection:**
  - Automatically generates a Dockerfile if the repository doesn't include one
  - Detects entry point from `package.json` (`scripts.start` → `main` → common files)
  - Sets `PORT` environment variable for seamless container port mapping

- **Container Lifecycle Management:**
  - Start, stop, and restart deployed containers
  - Auto-removes old containers before redeployment
  - Restart policy (`unless-stopped`) for reliability

- **Monitoring & Logging:**
  - Real-time deployment status tracking
  - Container log viewer
  - Deployment history with timestamps, duration, and status
  - Backend health check endpoint

### Frontend Dashboard
- Modern dark-themed UI with glassmorphism design
- Tabbed deploy interface (Built-in / GitHub / Upload)
- Drag-and-drop ZIP file upload
- Auto-refreshing status indicators
- Deployment history table
- Responsive layout for all screen sizes

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User / Developer                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Frontend Dashboard (HTML/CSS/JS)           │
│         http://localhost:5000                           │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐     │
│  │ Deploy   │  │  Status   │  │  Logs & History  │     │
│  │ Panel    │  │  Monitor  │  │  Viewer          │     │
│  └──────────┘  └───────────┘  └──────────────────┘     │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Backend Server (Node.js + Express)         │
│         http://localhost:5000                           │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  API Endpoints:                                  │   │
│  │  POST /deploy         - Built-in app deploy      │   │
│  │  POST /deploy/github  - GitHub repo deploy       │   │
│  │  POST /deploy/upload  - ZIP file deploy          │   │
│  │  GET  /status         - Container status         │   │
│  │  GET  /logs           - Container logs           │   │
│  │  GET  /history        - Deployment history       │   │
│  │  POST /stop           - Stop container           │   │
│  │  POST /restart        - Restart container        │   │
│  │  GET  /health         - Health check             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌────────────────┐   ┌─────────────────────────────┐   │
│  │ deployments.   │   │  Auto Dockerfile Generator  │   │
│  │ json           │   │  (smart entry detection)    │   │
│  └────────────────┘   └─────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │ Docker CLI
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  Docker Engine                          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Container: heroku-lite-app                      │   │
│  │  Image: heroku-lite-app                          │   │
│  │  Port: 3001 → 3000                               │   │
│  │  ENV: PORT=3000                                  │   │
│  │  Restart: unless-stopped                         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Deployed App accessible at http://localhost:3001       │
└─────────────────────────────────────────────────────────┘
```

### CI/CD Workflow

```
Developer Push Code → GitHub Actions Triggered → Build + Install Dependencies
                                                         ↓
    Application Live ← Container Deployment ← Docker Image Creation
```

---

## 🛠️ Technology Stack

| Technology | Purpose | Justification |
|------------|---------|---------------|
| **Node.js** | Backend runtime | Event-driven, non-blocking I/O for handling concurrent requests |
| **Express.js** | Web framework | Lightweight, middleware-based HTTP server |
| **Docker** | Containerization | Environment consistency, isolation, portability |
| **GitHub Actions** | CI/CD pipeline | Seamless GitHub integration, YAML-based workflows |
| **HTML/CSS/JS** | Frontend dashboard | Lightweight, no build step required |
| **JSON File** | Data persistence | Zero-config storage for deployment history |
| **Multer** | File uploads | Handles multipart form data for ZIP uploads |
| **CORS** | Cross-origin support | Enables frontend-backend communication |

---

## 📁 Project Structure

```
heroku-lite/
│
├── backend/
│   ├── app.js                 # Main API server (9 REST endpoints)
│   ├── package.json           # Backend dependencies
│   ├── package-lock.json      # Dependency lock file
│   ├── deployments.json       # Deployment history store
│   └── uploads/               # Temporary directory for uploads
│
├── frontend/
│   ├── index.html             # Dashboard page
│   ├── style.css              # Dark theme styles (glassmorphism)
│   └── script.js              # Client-side logic & API calls
│
├── user-app/                  # Sample application for deployment
│   ├── app.js                 # Simple Express "Hello World" app
│   ├── package.json           # App dependencies
│   ├── Dockerfile             # Optimized container configuration
│   └── .dockerignore          # Files excluded from Docker build
│
├── .github/workflows/
│   └── deploy.yml             # CI/CD pipeline (GitHub Actions → GHCR)
│
├── .gitignore                 # Git ignore rules
└── README.md                  # Project documentation
```

---

## 📦 Prerequisites

Before running the project, ensure you have the following installed:

| Requirement | Minimum Version | Check Command |
|------------|----------------|---------------|
| **Node.js** | v18+ | `node --version` |
| **npm** | v9+ | `npm --version` |
| **Docker** | v20+ | `docker --version` |
| **Git** | v2+ | `git --version` |

> **Note:** Docker Desktop must be **running** before starting the application.

---

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/vanamakrishnagurusai/DevOps-Based-Online-Code-Deployment-System
cd DevOps-Based-Online-Code-Deployment-System
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Start the Application

```bash
npm start
```

### 4. Open the Dashboard

Navigate to **http://localhost:5000** in your browser.

---

## 📘 Usage Guide

### Method 1: Deploy Built-in Sample App

1. Open the dashboard at `http://localhost:5000`
2. Click the **"Built-in App"** tab
3. Click **"Deploy Now"**
4. Wait for the build to complete
5. Access the deployed app at `http://localhost:3001`

### Method 2: Deploy from GitHub Repository

1. Click the **"GitHub Repo"** tab
2. Enter a public GitHub repository URL
   - Example: `https://github.com/heroku/node-js-getting-started`
3. Click **"Deploy"**
4. The system will clone, build, and deploy automatically
5. Access the deployed app at `http://localhost:3001`

### Method 3: Deploy from ZIP Upload

1. Click the **"Upload ZIP"** tab
2. Drag & drop a ZIP file or click to browse
3. Click **"Deploy ZIP"**
4. Access the deployed app at `http://localhost:3001`

### Container Management

- **Stop** — Click the "Stop" button in the Status section
- **Restart** — Click the "Restart" button
- **View Logs** — Click "Refresh" in the Container Logs section
- **Deployment History** — Scroll down to see past deployments

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| `POST` | `/deploy` | Deploy built-in sample app | — |
| `POST` | `/deploy/github` | Deploy from GitHub repo | `{ "repoUrl": "https://github.com/..." }` |
| `POST` | `/deploy/upload` | Deploy from ZIP file | `multipart/form-data` with `file` field |
| `GET` | `/status` | Get container status | — |
| `GET` | `/logs?lines=100` | Get container logs | — |
| `GET` | `/history` | Get deployment history | — |
| `GET` | `/health` | Backend health check | — |
| `POST` | `/stop` | Stop running container | — |
| `POST` | `/restart` | Restart container | — |

### Example API Calls

```bash
# Deploy built-in app
curl -X POST http://localhost:5000/deploy

# Deploy from GitHub
curl -X POST http://localhost:5000/deploy/github \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/heroku/node-js-getting-started"}'

# Check status
curl http://localhost:5000/status

# View logs
curl http://localhost:5000/logs?lines=50

# Stop container
curl -X POST http://localhost:5000/stop
```

---

## ⚙️ CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automates the following on every push to `main`:

```
Code Push → Checkout → Setup Node.js → Install Dependencies
                                              ↓
              Verify Push ← Push to GHCR ← Build Docker Image
```

### Pipeline Steps:
1. **Checkout** — Fetches the latest source code
2. **Setup Node.js** — Configures Node.js v18
3. **Install Dependencies** — Runs `npm install` in backend
4. **Login to GHCR** — Authenticates with GitHub Container Registry
5. **Build Docker Image** — Builds from `user-app/Dockerfile`
6. **Push Image** — Pushes to `ghcr.io/<username>/heroku-lite`
7. **Verify** — Confirms successful push

---

## 🔒 Security Measures

- **No shell injection:** Uses `execFile` with argument arrays instead of `exec` with string concatenation
- **Input validation:** GitHub URLs are validated against a regex pattern before cloning
- **File type restriction:** Only `.zip` files accepted for upload (MIME type + extension check)
- **File size limit:** 50MB maximum for uploaded files
- **Temp cleanup:** Cloned repos and uploaded files are deleted after deployment
- **Container isolation:** Each deployed app runs in its own Docker container

---

## 🖼️ Screenshots

### Dashboard — Deploy Section
The main interface with three deployment tabs (Built-in, GitHub, Upload).

### Dashboard — Status & Monitoring
Real-time container status, backend health, logs viewer, and deployment history.

---

## 🔮 Future Enhancements

- Multi-cloud deployment support (AWS, Azure, GCP)
- Kubernetes orchestration for scalability
- Role-based access control (RBAC)
- Auto-scaling and load balancing
- Support for multiple programming languages (Python, Go, Java)
- Custom domain mapping for deployed apps
- Real-time log streaming via WebSockets
- Environment variable management per deployment
- Rollback to previous deployments

---

## 👨‍💻 Author

**Vanama Krishna Guru Sai**

---

## 📄 License

This project is developed for academic purposes as part of a DevOps-Based Online Code Deployment System project.

---

## 🙏 Acknowledgments

- [Docker](https://www.docker.com/) — Containerization platform
- [Express.js](https://expressjs.com/) — Web framework for Node.js
- [GitHub Actions](https://github.com/features/actions) — CI/CD automation
- [Heroku](https://www.heroku.com/) — Inspiration for the platform design
