const $ = (id) => document.getElementById(id);
const state = { page: "overview", keys: [], logs: [], newlyCreatedKey: "", isOwner: false };
const pageMeta = {
  overview: ["SYSTEM OVERVIEW", "Command Center", "Monitor your private workspace."],
  keys: ["ACCESS CONTROL", "Access Key Manager", "Create and revoke private access keys."],
  activity: ["SECURITY CENTER", "Activity Logs", "Review recent access and administration events."],
  groups: ["UTILITY TOOL", "Group ID Lookup", "Validate a group identifier format."],
  bots: ["INTEGRATIONS", "Bot Connection Status", "Check configured service health."]
};
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function fmtDate(value) {
  if (!value) return "Never";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
function showAlert(message, isError = true) {
  const box = $("alertBox");
  box.textContent = message;
  box.classList.remove("hidden");
  box.style.borderColor = isError ? "#ff4d7540" : "#42d7a244";
  box.style.color = isError ? "#ff91a5" : "#79e8c2";
  window.setTimeout(() => box.classList.add("hidden"), 5000);
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function setPage(page) {
  if (!pageMeta[page]) return;
  if (!state.isOwner && ["overview", "keys", "activity"].includes(page)) page = "groups";
  state.page = page;
  Object.keys(pageMeta).forEach(name => {
    $(name + "Page").classList.toggle("hidden", name !== page);
  });
  $("pageEyebrow").textContent = pageMeta[page][0];
  $("pageTitle").textContent = pageMeta[page][1];
  $("pageSubtitle").textContent = pageMeta[page][2];
  document.querySelectorAll("[data-page]").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
  if (page === "keys") loadKeys();
  if (page === "activity") loadLogs();
  if (page === "overview" && state.isOwner) loadOverview();
  if (page === "bots") checkBotStatus(false);
}
function showApp() {
  document.querySelectorAll('[data-page="keys"], [data-page="activity"]').forEach(el => {
    el.classList.toggle("hidden", !state.isOwner);
  });
  document.querySelectorAll('[data-goto="keys"]').forEach(el => {
    el.classList.toggle("hidden", !state.isOwner);
  });
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  setPage(state.isOwner ? "overview" : "groups");
}
function showLogin(message = "") {
  $("appView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("loginMessage").textContent = message;
}
async function boot() {
  try { const me = await api("/api/me"); state.isOwner = me.isOwner === true; showApp(); }
  catch (_) { showLogin(); }
}
async function login(event) {
  event.preventDefault();
  const button = $("loginForm").querySelector("button");
  const key = $("accessKey").value.trim();
  if (!key) return;
  button.disabled = true;
  $("loginMessage").textContent = "Checking access key…";
  try {
    await api("/api/login", { method: "POST", body: { key } });
    $("accessKey").value = "";
    showApp();
  } catch (error) {
    $("loginMessage").textContent = error.message || "Access denied.";
  } finally { button.disabled = false; }
}
async function logout() {
  try { await api("/api/logout", { method: "POST", body: {} }); } catch (_) {}
  showLogin("You have been logged out.");
}
async function loadOverview() {
  try {
    const data = await api("/api/overview");
    $("statKeys").textContent = data.totalKeys;
    $("statActive").textContent = data.activeKeys;
    $("statEvents").textContent = data.events24h;
    $("statBots").textContent = data.botStatus || "UNKNOWN";
    renderEvents($("recentEvents"), data.recentLogs || []);
  } catch (e) { showAlert(e.message); }
}
function renderEvents(container, logs) {
  if (!logs.length) { container.innerHTML = '<div class="empty">No activity recorded yet.</div>'; return; }
  container.innerHTML = logs.map(log => `<div class="event-row"><div class="event-mark">${log.event_type === "login_failed" ? "!" : "◆"}</div><div class="event-main"><b>${esc((log.event_type || "event").replaceAll("_"," ").toUpperCase())}</b><small>${esc(log.details || "Security event")}</small></div><div class="event-time">${esc(fmtDate(log.created_at))}</div></div>`).join("");
}
async function loadKeys() {
  const holder = $("keysTable");
  holder.innerHTML = '<div class="empty">Loading keys…</div>';
  try {
    const data = await api("/api/keys");
    state.keys = data.keys || [];
    if (!state.keys.length) { holder.innerHTML = '<div class="empty">No keys created yet. Generate your first key above.</div>'; return; }
    holder.innerHTML = `<table><thead><tr><th>LABEL</th><th>STATUS</th><th>CREATED</th><th>EXPIRES</th><th>ACTION</th></tr></thead><tbody>${state.keys.map(k => {
      const expired = k.revoked || (k.expires_at && new Date(k.expires_at) < new Date());
      const status = k.revoked ? "revoked" : expired ? "expired" : "active";
      return `<tr><td>${esc(k.label)}<small>ID ${esc(k.id.slice(0,8))}</small></td><td><span class="status-pill ${status}">${status.toUpperCase()}</span></td><td>${esc(fmtDate(k.created_at))}</td><td>${esc(fmtDate(k.expires_at))}</td><td>${status === "active" ? `<button class="danger-btn" data-revoke="${esc(k.id)}">REVOKE</button>` : "—"}</td></tr>`;
    }).join("")}</tbody></table>`;
    holder.querySelectorAll("[data-revoke]").forEach(btn => btn.addEventListener("click", () => revokeKey(btn.dataset.revoke)));
  } catch (e) { holder.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
async function createKey(event) {
  event.preventDefault();
  const label = $("keyLabel").value.trim();
  const days = Number($("keyDays").value);
  const button = $("createKeyForm").querySelector("button");
  button.disabled = true;
  try {
    const data = await api("/api/keys", { method: "POST", body: { label, days } });
    state.newlyCreatedKey = data.key;
    $("newKeyValue").textContent = data.key;
    $("newKeyResult").classList.remove("hidden");
    $("keyLabel").value = "";
    showAlert("Access key created. Copy it now; it will not be shown again.", false);
    await loadKeys(); await loadOverview();
  } catch (e) { showAlert(e.message); }
  finally { button.disabled = false; }
}
async function revokeKey(id) {
  if (!confirm("Revoke this key now? Any session created with it will be invalidated on its next protected request.")) return;
  try {
    await api("/api/keys", { method: "DELETE", body: { id } });
    showAlert("Access key revoked.", false);
    await loadKeys(); await loadOverview();
  } catch (e) { showAlert(e.message); }
}
async function loadLogs() {
  const holder = $("logsTable");
  holder.innerHTML = '<div class="empty">Loading activity…</div>';
  try {
    const data = await api("/api/logs");
    const logs = data.logs || [];
    if (!logs.length) { holder.innerHTML = '<div class="empty">No activity recorded yet.</div>'; return; }
    holder.innerHTML = `<table><thead><tr><th>EVENT</th><th>DETAILS</th><th>TIME</th></tr></thead><tbody>${logs.map(l => `<tr><td><span class="status-pill ${l.event_type === "login_failed" ? "revoked" : "active"}">${esc((l.event_type || "event").toUpperCase())}</span></td><td>${esc(l.details || "—")}</td><td>${esc(fmtDate(l.created_at))}</td></tr>`).join("")}</tbody></table>`;
  } catch (e) { holder.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
async function groupLookup(event) {
  event.preventDefault();
  const id = $("groupId").value.trim();
  const holder = $("groupResult");
  holder.classList.remove("hidden");
  try {
    const data = await api("/api/group-lookup", { method: "POST", body: { groupId: id } });
    holder.innerHTML = `<b>${data.valid ? "FORMAT LOOKS VALID" : "FORMAT NEEDS REVIEW"}</b><br>${esc(data.message)}<br><small class="muted">This is format validation only; it does not confirm that the group exists.</small>`;
  } catch (e) { holder.textContent = e.message; }
}
async function checkBotStatus(showMessage = true) {
  try {
    const data = await api("/api/bot-status");
    $("botStatusTitle").textContent = data.status;
    $("botStatusText").textContent = data.message;
    $("statBots").textContent = data.status;
    if (showMessage) showAlert(data.message, data.status !== "ONLINE");
  } catch (e) { $("botStatusTitle").textContent = "CHECK FAILED"; $("botStatusText").textContent = e.message; if (showMessage) showAlert(e.message); }
}
document.addEventListener("click", event => {
  const pageBtn = event.target.closest("[data-page]");
  const gotoBtn = event.target.closest("[data-goto]");
  if (pageBtn) setPage(pageBtn.dataset.page);
  if (gotoBtn) setPage(gotoBtn.dataset.goto);
});
$("loginForm").addEventListener("submit", login);
$("logoutBtn").addEventListener("click", logout);
$("refreshBtn").addEventListener("click", () => { if (state.page === "overview" && state.isOwner) loadOverview(); if (state.page === "keys") loadKeys(); if (state.page === "activity") loadLogs(); });
$("createKeyForm").addEventListener("submit", createKey);
$("reloadKeysBtn").addEventListener("click", loadKeys);
$("reloadLogsBtn").addEventListener("click", loadLogs);
$("groupForm").addEventListener("submit", groupLookup);
$("checkBotBtn").addEventListener("click", () => checkBotStatus(true));
$("copyKeyBtn").addEventListener("click", async () => {
  if (!state.newlyCreatedKey) return;
  try { await navigator.clipboard.writeText(state.newlyCreatedKey); showAlert("Key copied to clipboard.", false); }
  catch (_) { showAlert("Copy was blocked by your browser. Press and hold the key text to copy it."); }
});
boot();
