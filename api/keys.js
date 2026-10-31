const crypto = require("node:crypto");
const { send, requireSession, logEvent, methodNotAllowed, requireOwner } = require("./_lib/auth");
module.exports = async function handler(req, res) {
  try {
    const session = await requireSession(req, res);
    if (!session) return;
    const { db, keyId } = session;
    if (!requireOwner(session, res)) return;
    if (req.method === "GET") {
      const { data, error } = await db.from("access_keys").select("id,label,created_at,expires_at,revoked").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return send(res, 200, { keys: data || [] });
    }
    if (req.method === "POST") {
      const label = typeof req.body?.label === "string" ? req.body.label.trim().slice(0, 80) : "";
      const days = Number(req.body?.days);
      if (!label) return send(res, 400, { error: "A label is required." });
      if (![1, 7, 30, 90, 365].includes(days)) return send(res, 400, { error: "Choose a valid expiration period." });
      const rawKey = "ETV10-" + crypto.randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
      const { data, error } = await db.from("access_keys").insert({ label, key_hash: require("./_lib/auth").hashKey(rawKey), expires_at: expiresAt, created_by_key_id: keyId }).select("id,label,created_at,expires_at,revoked").single();
      if (error) throw error;
      await logEvent(db, "key_created", `Created key "${label}" expiring ${expiresAt}`);
      return send(res, 201, { key: rawKey, record: data });
    }
    if (req.method === "DELETE") {
      const id = typeof req.body?.id === "string" ? req.body.id : "";
      if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: "Invalid key ID." });
      if (id === keyId) return send(res, 400, { error: "You cannot revoke the key currently used by this session. Log in with another owner key to revoke it." });
      const { data, error } = await db.from("access_keys").update({ revoked: true }).eq("id", id).eq("revoked", false).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 404, { error: "Key not found or already revoked." });
      await logEvent(db, "key_revoked", `Revoked access key ${id}`);
      return send(res, 200, { ok: true });
    }
    return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
  } catch (error) {
    console.error("keys error", error.message);
    return send(res, 500, { error: "Access key operation failed. Check your Supabase schema and server configuration." });
  }
};
