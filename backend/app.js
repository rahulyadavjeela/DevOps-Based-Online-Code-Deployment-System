const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

// ─── App Setup ───────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const CONTAINER_NAME = "heroku-lite-app";
const IMAGE_NAME = "heroku-lite-app";
const APP_PORT = 3001;
const USER_APP_DIR = path.resolve(__dirname, "../user-app");
const UPLOADS_DIR = path.resolve(__dirname, "uploads");
const DEPLOYMENTS_FILE = path.resolve(__dirname, "deployments.json");

// Serve the frontend
app.use(express.static(path.resolve(__dirname, "../frontend")));

// Configure multer for ZIP uploads
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are allowed"));
    }
  },
});

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── Deployment History Helpers ──────────────────────────────────
function loadHistory() {
  try {
    const data = fs.readFileSync(DEPLOYMENTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(history, null, 2));
}

function addDeploymentRecord(record) {
  const history = loadHistory();
  history.unshift(record); // newest first
  if (history.length > 50) history.pop(); // keep last 50
  saveHistory(history);
}

// ─── Auto-generate Dockerfile based on package.json ─────────────
function generateDockerfile(appDir) {
  const pkgPath = path.join(appDir, "package.json");
  let startCmd = '["node", "app.js"]'; // default fallback

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

      if (pkg.scripts && pkg.scripts.start) {
        // If a start script exists, use "npm start" (most reliable, like real Heroku)
        startCmd = '["npm", "start"]';
      } else if (pkg.main) {
        // Use the "main" field from package.json
        startCmd = `["node", "${pkg.main}"]`;
      } else {
        // Scan for common entry files
        const commonFiles = ["index.js", "server.js", "app.js", "main.js"];
        for (const file of commonFiles) {
          if (fs.existsSync(path.join(appDir, file))) {
            startCmd = `["node", "${file}"]`;
            break;
          }
        }
      }
    } catch {}
  }

  return `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ${startCmd}
`;
}


// ─── Health Check ────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ─── Deploy from built-in user-app ───────────────────────────────
app.post("/deploy", async (req, res) => {
  const startTime = Date.now();

  try {
    // Stop & remove old container
    await runCommand("docker", ["rm", "-f", CONTAINER_NAME]).catch(() => {});

    // Build the Docker image
    await runCommand("docker", ["build", "-t", IMAGE_NAME, USER_APP_DIR]);

    // Run the new container (PORT=3000 ensures app listens on mapped port)
    const runResult = await runCommand("docker", [
      "run", "-d",
      "--name", CONTAINER_NAME,
      "-e", "PORT=3000",
      "-p", `${APP_PORT}:3000`,
      "--restart", "unless-stopped",
      IMAGE_NAME,
    ]);

    const containerId = runResult.stdout.trim().substring(0, 12);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    const record = {
      id: Date.now(),
      source: "user-app (built-in)",
      status: "success",
      containerId,
      url: `http://localhost:${APP_PORT}`,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    };
    addDeploymentRecord(record);

    res.json({ ...record, message: "Deployment successful 🚀" });
  } catch (err) {
    const record = {
      id: Date.now(),
      source: "user-app (built-in)",
      status: "failed",
      error: err.stderr || err.message,
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      timestamp: new Date().toISOString(),
    };
    addDeploymentRecord(record);

    res.status(500).json({ ...record, message: "Deployment failed ❌" });
  }
});

// ─── Deploy from GitHub Repo URL ─────────────────────────────────
app.post("/deploy/github", async (req, res) => {
  const { repoUrl } = req.body;
  const startTime = Date.now();

  if (!repoUrl) {
    return res.status(400).json({ status: "error", message: "repoUrl is required" });
  }

  // Validate GitHub URL format
  const githubUrlRegex = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;
  if (!githubUrlRegex.test(repoUrl)) {
    return res.status(400).json({ status: "error", message: "Invalid GitHub URL. Use format: https://github.com/user/repo" });
  }

  const cloneDir = path.resolve(UPLOADS_DIR, `github-${Date.now()}`);

  try {
    // Clone the repository
    await runCommand("git", ["clone", "--depth", "1", repoUrl, cloneDir]);

    // Check if Dockerfile exists, if not auto-generate one
    const dockerfilePath = path.join(cloneDir, "Dockerfile");
    if (!fs.existsSync(dockerfilePath)) {
      fs.writeFileSync(dockerfilePath, generateDockerfile(cloneDir));
    }

    // Stop & remove old container
    await runCommand("docker", ["rm", "-f", CONTAINER_NAME]).catch(() => {});

    // Build Docker image
    await runCommand("docker", ["build", "-t", IMAGE_NAME, cloneDir]);

    // Run container (PORT=3000 ensures app listens on mapped port)
    const runResult = await runCommand("docker", [
      "run", "-d",
      "--name", CONTAINER_NAME,
      "-e", "PORT=3000",
      "-p", `${APP_PORT}:3000`,
      "--restart", "unless-stopped",
      IMAGE_NAME,
    ]);

    const containerId = runResult.stdout.trim().substring(0, 12);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Cleanup cloned repo
    fs.rmSync(cloneDir, { recursive: true, force: true });

    const record = {
      id: Date.now(),
      source: repoUrl,
      status: "success",
      containerId,
      url: `http://localhost:${APP_PORT}`,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    };
    addDeploymentRecord(record);

    res.json({ ...record, message: "GitHub deploy successful 🚀" });
  } catch (err) {
    // Cleanup on failure
    if (fs.existsSync(cloneDir)) {
      fs.rmSync(cloneDir, { recursive: true, force: true });
    }

    const record = {
      id: Date.now(),
      source: repoUrl,
      status: "failed",
      error: err.stderr || err.message,
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      timestamp: new Date().toISOString(),
    };
    addDeploymentRecord(record);

    res.status(500).json({ ...record, message: "GitHub deploy failed ❌" });
  }
});

// ─── Deploy from ZIP Upload ─────────────────────────────────────
app.post("/deploy/upload", upload.single("file"), async (req, res) => {
  const startTime = Date.now();

  if (!req.file) {
    return res.status(400).json({ status: "error", message: "No ZIP file uploaded" });
  }

  const extractDir = path.resolve(UPLOADS_DIR, `upload-${Date.now()}`);

  try {
    // Create extraction directory
    fs.mkdirSync(extractDir, { recursive: true });

    // Extract the ZIP file
    await runCommand("tar", ["-xf", req.file.path, "-C", extractDir]);

    // Find the actual app directory (might be nested)
    let appDir = extractDir;
    const contents = fs.readdirSync(extractDir);
    if (contents.length === 1 && fs.statSync(path.join(extractDir, contents[0])).isDirectory()) {
      appDir = path.join(extractDir, contents[0]);
    }

    // Check if Dockerfile exists, if not auto-generate one
    const dockerfilePath = path.join(appDir, "Dockerfile");
    if (!fs.existsSync(dockerfilePath)) {
      fs.writeFileSync(dockerfilePath, generateDockerfile(appDir));
    }

    // Stop & remove old container
    await runCommand("docker", ["rm", "-f", CONTAINER_NAME]).catch(() => {});

    // Build Docker image
    await runCommand("docker", ["build", "-t", IMAGE_NAME, appDir]);

    // Run container (PORT=3000 ensures app listens on mapped port)
    const runResult = await runCommand("docker", [
      "run", "-d",
      "--name", CONTAINER_NAME,
      "-e", "PORT=3000",
      "-p", `${APP_PORT}:3000`,
      "--restart", "unless-stopped",
      IMAGE_NAME,
    ]);

    const containerId = runResult.stdout.trim().substring(0, 12);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Cleanup
    fs.unlinkSync(req.file.path);
    fs.rmSync(extractDir, { recursive: true, force: true });

    const record = {
      id: Date.now(),
      source: `Upload: ${req.file.originalname}`,
      status: "success",
      containerId,
      url: `http://localhost:${APP_PORT}`,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    };
    addDeploymentRecord(record);

    res.json({ ...record, message: "Upload deploy successful 🚀" });
  } catch (err) {
    // Cleanup on failure
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });

    const record = {
      id: Date.now(),
      source: `Upload: ${req.file?.originalname || "unknown"}`,
      status: "failed",
      error: err.stderr || err.message,
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      timestamp: new Date().toISOString(),
    };
    addDeploymentRecord(record);

    res.status(500).json({ ...record, message: "Upload deploy failed ❌" });
  }
});

// ─── Status Endpoint ─────────────────────────────────────────────
app.get("/status", async (req, res) => {
  try {
    const result = await runCommand("docker", [
      "inspect", CONTAINER_NAME,
      "--format", "{{.State.Status}}|{{.State.StartedAt}}|{{.Config.Image}}"
    ]);

    const parts = result.stdout.trim().split("|");
    const isRunning = parts[0] === "running";

    res.json({
      status: isRunning ? "running" : "stopped",
      container: CONTAINER_NAME,
      startedAt: parts[1] || null,
      image: parts[2] || IMAGE_NAME,
      url: isRunning ? `http://localhost:${APP_PORT}` : null,
    });
  } catch {
    res.json({
      status: "not deployed",
      container: CONTAINER_NAME,
      message: "No deployment found. Deploy an app to get started.",
    });
  }
});

// ─── Logs Endpoint ───────────────────────────────────────────────
app.get("/logs", async (req, res) => {
  const lines = req.query.lines || 100;

  try {
    const result = await runCommand("docker", [
      "logs", "--tail", String(lines), CONTAINER_NAME,
    ]);

    res.json({
      container: CONTAINER_NAME,
      logs: result.stdout || result.stderr || "No logs available.",
    });
  } catch {
    res.status(404).json({
      status: "error",
      message: "No container found. Deploy an app first.",
    });
  }
});

// ─── Deployment History ──────────────────────────────────────────
app.get("/history", (req, res) => {
  const history = loadHistory();
  res.json(history);
});

// ─── Stop Container ──────────────────────────────────────────────
app.post("/stop", async (req, res) => {
  try {
    await runCommand("docker", ["stop", CONTAINER_NAME]);
    res.json({ status: "stopped", message: "Container stopped ✅" });
  } catch (err) {
    res.status(400).json({
      status: "error",
      message: "Failed to stop container",
      error: err.stderr || err.message,
    });
  }
});

// ─── Restart Container ───────────────────────────────────────────
app.post("/restart", async (req, res) => {
  try {
    await runCommand("docker", ["restart", CONTAINER_NAME]);
    res.json({
      status: "restarted",
      message: "Container restarted 🔄",
      url: `http://localhost:${APP_PORT}`,
    });
  } catch (err) {
    res.status(400).json({
      status: "error",
      message: "Failed to restart container",
      error: err.stderr || err.message,
    });
  }
});

// ─── Helper: run a command safely ────────────────────────────────
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

// ─── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Heroku-Lite Backend running on http://localhost:${PORT}`);
  console.log(`📦 Frontend dashboard: http://localhost:${PORT}`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  POST /deploy          - Deploy built-in user-app`);
  console.log(`  POST /deploy/github   - Deploy from GitHub repo URL`);
  console.log(`  POST /deploy/upload   - Deploy from ZIP file upload`);
  console.log(`  GET  /status          - Check deployment status`);
  console.log(`  GET  /logs            - View container logs`);
  console.log(`  GET  /history         - View deployment history`);
  console.log(`  GET  /health          - Backend health check`);
  console.log(`  POST /stop            - Stop container`);
  console.log(`  POST /restart         - Restart container`);
});