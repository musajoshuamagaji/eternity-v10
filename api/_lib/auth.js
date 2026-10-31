const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const COOKIE_NAME = "eternity_session";
const SESSION_SECONDS = 60 * 60 * 12;

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
function supabase() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
function hashKey(key) {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", env("SESSION_SECRET")).update(body).digest("base64url");
  return `${body}.${signature}`;
}
function verify(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac("sha256", env("SESSION_SECRET")).update(parts[0]).digest();
  let received;
  try { received = Buffer.from(parts[1], "base64url"); } catch (_) { return null; }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000) || !payload.keyId) return null;
    return payload;
  } catch (_) { return null; }
}
function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map(x => x.trim()).filter(Boolean).map(pair => {
    const i = pair.indexOf("=");
    return [pair.slice(0, i), decodeURIComponent(pair.slice(i + 1))];
  }));
}
function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`);
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}
function send(res, status, data) {
  res.status(status).json(data);
}
async function requireSession(req, res) {
  const token = parseCookies(req)[COOKIE_NAME];
  const payload = verify(token);
  if (!payload) { send(res, 401, { error: "Session expired. Enter your access key again." }); return null; }
  const db = supabase();
  const { data: key, error } = await db.from("access_keys").select("id, revoked, expires_at, is_owner").eq("id", payload.keyId).maybeSingle();
  if (error || !key || key.revoked || (key.expires_at && new Date(key.expires_at).getTime() <= Date.now())) {
    clearSessionCookie(res);
    send(res, 401, { error: "This access key is no longer valid. Enter an active key." });
    return null;
  }
  return { keyId: key.id, isOwner: key.is_owner === true, db };
}
async function logEvent(db, eventType, details) {
  try { await db.from("activity_logs").insert({ event_type: eventType, details: String(details || "").slice(0, 300) }); } catch (_) {}
}
function requireOwner(session, res) {
  if (!session.isOwner) {
    send(res, 403, { error: "Owner access required for this administration feature." });
    return false;
  }
  return true;
}
function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  send(res, 405, { error: "Method not allowed." });
}
module.exports = { env, supabase, hashKey, sign, verify, SESSION_SECONDS, setSessionCookie, clearSessionCookie, send, requireSession, logEvent, methodNotAllowed, requireOwner };
