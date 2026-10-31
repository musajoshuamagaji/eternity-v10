const { supabase, hashKey, sign, SESSION_SECONDS, setSessionCookie, send, logEvent, methodNotAllowed } = require("./_lib/auth");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const keyValue = typeof req.body?.key === "string" ? req.body.key.trim() : "";
    if (!keyValue || keyValue.length > 256) return send(res, 400, { error: "Enter a valid access key." });
    const db = supabase();
    const digest = hashKey(keyValue);
    const { data: key, error } = await db.from("access_keys").select("id, label, revoked, expires_at, is_owner").eq("key_hash", digest).maybeSingle();
    if (error) throw error;
    if (!key || key.revoked || (key.expires_at && new Date(key.expires_at).getTime() <= Date.now())) {
      await logEvent(db, "login_failed", "Rejected invalid, revoked, or expired access key");
      return send(res, 401, { error: "Access denied. Check your key or ask the owner for a new one." });
    }
    const now = Math.floor(Date.now() / 1000);
    const token = sign({ keyId: key.id, iat: now, exp: now + SESSION_SECONDS });
    setSessionCookie(res, token);
    await logEvent(db, "login_success", `Access granted to key label: ${key.label}`);
    return send(res, 200, { ok: true });
  } catch (error) {
    console.error("login error", error.message);
    return send(res, 500, { error: "Login service is not configured correctly. Check server environment variables and Supabase schema." });
  }
};
