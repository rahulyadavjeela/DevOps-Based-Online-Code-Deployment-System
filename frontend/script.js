// ─── Config ──────────────────────────────────────────────
const API_BASE = window.location.origin;

// ─── Tab Switching ───────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab + "Tab").classList.add("active");
  });
});

// ─── File Upload (Drag & Drop + Click) ──────────────────
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const uploadFileName = document.getElementById("uploadFileName");
const btnDeployUpload = document.getElementById("btnDeployUpload");
let selectedFile = null;

uploadArea.addEventListener("click", () => fileInput.click());

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith(".zip")) {
    selectFile(file);
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) {
    selectFile(fileInput.files[0]);
  }
});

function selectFile(file) {
  selectedFile = file;
  uploadFileName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  uploadArea.classList.add("has-file");
  btnDeployUpload.disabled = false;
}

// ─── Deploy: Built-in App ────────────────────────────────
async function deployBuiltin() {
  const btn = document.getElementById("btnDeploy");
  await performDeploy(btn, () =>
    fetch(`${API_BASE}/deploy`, { method: "POST" })
  );
}

// ─── Deploy: GitHub Repo ─────────────────────────────────
async function deployGithub() {
  const repoUrl = document.getElementById("repoUrl").value.trim();
  if (!repoUrl) {
    showResult("Please enter a GitHub repository URL.", "error");
    return;
  }

  const btn = document.getElementById("btnDeployGithub");
  await performDeploy(btn, () =>
    fetch(`${API_BASE}/deploy/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl }),
    })
  );
}

// ─── Deploy: ZIP Upload ─────────────────────────────────
async function deployUpload() {
  if (!selectedFile) {
    showResult("Please select a ZIP file first.", "error");
    return;
  }

  const btn = document.getElementById("btnDeployUpload");
  const formData = new FormData();
  formData.append("file", selectedFile);

  await performDeploy(btn, () =>
    fetch(`${API_BASE}/deploy/upload`, {
      method: "POST",
      body: formData,
    })
  );
}

// ─── Shared Deploy Logic ─────────────────────────────────
async function performDeploy(btn, fetchFn) {
  const originalHTML = btn.innerHTML;
  btn.classList.add("deploying");
  btn.innerHTML = `<span class="btn-icon">⏳</span> Deploying...`;

  showProgress(true);
  hideResult();

  try {
    const res = await fetchFn();
    const data = await res.json();

    if (res.ok) {
      showResult(
        `✅ ${data.message} — <a href="${data.url}" target="_blank">${data.url}</a> (${data.duration})`,
        "success"
      );
    } else {
      showResult(`❌ ${data.message}: ${data.error || "Unknown error"}`, "error");
    }
  } catch (err) {
    showResult(`❌ Network error: ${err.message}`, "error");
  } finally {
    btn.classList.remove("deploying");
    btn.innerHTML = originalHTML;
    showProgress(false);
    refreshStatus();
    refreshHistory();
  }
}

// ─── Progress Bar ────────────────────────────────────────
function showProgress(show) {
  const bar = document.getElementById("progressBar");
  const fill = document.getElementById("progressFill");
  if (show) {
    bar.classList.add("active");
    fill.style.width = "0%";
    let width = 0;
    const interval = setInterval(() => {
      width += Math.random() * 8;
      if (width >= 90) {
        clearInterval(interval);
        width = 90;
      }
      fill.style.width = width + "%";
    }, 300);
    bar.dataset.interval = interval;
  } else {
    const fill = document.getElementById("progressFill");
    fill.style.width = "100%";
    setTimeout(() => {
      bar.classList.remove("active");
      fill.style.width = "0%";
    }, 500);
    if (bar.dataset.interval) clearInterval(bar.dataset.interval);
  }
}

// ─── Result Display ──────────────────────────────────────
function showResult(message, type) {
  const el = document.getElementById("deployResult");
  el.className = "deploy-result " + type;
  el.innerHTML = message;
}

function hideResult() {
  const el = document.getElementById("deployResult");
  el.className = "deploy-result";
  el.innerHTML = "";
}

// ─── Status ──────────────────────────────────────────────
async function refreshStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    const data = await res.json();

    // Header dot
    const dot = document.querySelector(".status-dot");
    const statusText = document.querySelector(".status-text");
    dot.className = "status-dot " + (data.status === "running" ? "running" : data.status === "stopped" ? "stopped" : "not-deployed");
    statusText.textContent = data.status;

    // Status badge
    const badge = document.getElementById("statusBadge");
    badge.textContent = data.status;
    badge.className = "status-badge " + (data.status === "running" ? "running" : data.status === "stopped" ? "stopped" : "not-deployed");

    // Details
    document.getElementById("containerName").textContent = data.container || "—";
    document.getElementById("startedAt").textContent = data.startedAt ? new Date(data.startedAt).toLocaleString() : "—";

    const appUrl = document.getElementById("appUrl");
    if (data.url) {
      appUrl.textContent = data.url;
      appUrl.href = data.url;
    } else {
      appUrl.textContent = "—";
      appUrl.href = "#";
    }
  } catch {
    document.querySelector(".status-text").textContent = "Offline";
  }
}

// ─── Health Check ────────────────────────────────────────
async function refreshHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    document.getElementById("apiHealth").textContent = "✅ Online";
    document.getElementById("apiHealth").style.color = "var(--success)";
    document.getElementById("apiUptime").textContent = formatUptime(data.uptime);
  } catch {
    document.getElementById("apiHealth").textContent = "❌ Offline";
    document.getElementById("apiHealth").style.color = "var(--danger)";
    document.getElementById("apiUptime").textContent = "—";
  }
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Logs ────────────────────────────────────────────────
async function refreshLogs() {
  try {
    const res = await fetch(`${API_BASE}/logs?lines=100`);
    const data = await res.json();
    const el = document.getElementById("logsOutput");
    el.textContent = data.logs || "No logs available.";
    el.scrollTop = el.scrollHeight;
  } catch {
    document.getElementById("logsOutput").textContent = "Failed to fetch logs. Is the backend running?";
  }
}

// ─── Deployment History ──────────────────────────────────
async function refreshHistory() {
  try {
    const res = await fetch(`${API_BASE}/history`);
    const data = await res.json();
    const tbody = document.getElementById("historyBody");

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No deployments yet</td></tr>`;
      return;
    }

    tbody.innerHTML = data
      .map(
        (d) => `
      <tr>
        <td>${new Date(d.timestamp).toLocaleString()}</td>
        <td>${truncate(d.source, 35)}</td>
        <td class="${d.status === "success" ? "badge-success" : "badge-failed"}">${d.status === "success" ? "✅ Success" : "❌ Failed"}</td>
        <td>${d.duration || "—"}</td>
        <td>${d.containerId || "—"}</td>
      </tr>`
      )
      .join("");
  } catch {
    // History not available
  }
}

function truncate(str, max) {
  if (!str) return "—";
  return str.length > max ? str.substring(0, max) + "…" : str;
}

// ─── Container Controls ─────────────────────────────────
async function stopContainer() {
  const btn = document.getElementById("btnStop");
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/stop`, { method: "POST" });
    const data = await res.json();
    showResult(data.message, res.ok ? "success" : "error");
  } catch (err) {
    showResult("Failed to stop: " + err.message, "error");
  } finally {
    btn.disabled = false;
    refreshStatus();
  }
}

async function restartContainer() {
  const btn = document.getElementById("btnRestart");
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/restart`, { method: "POST" });
    const data = await res.json();
    showResult(data.message, res.ok ? "success" : "error");
  } catch (err) {
    showResult("Failed to restart: " + err.message, "error");
  } finally {
    btn.disabled = false;
    refreshStatus();
  }
}

// ─── Init ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  refreshStatus();
  refreshHealth();
  refreshHistory();

  // Auto-refresh status every 10 seconds
  setInterval(refreshStatus, 10000);
  setInterval(refreshHealth, 30000);
});
