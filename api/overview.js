const { send, requireSession, methodNotAllowed, requireOwner } = require("./_lib/auth");
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const session = await requireSession(req, res); if (!session) return;
    if (!requireOwner(session, res)) return;
    const { db } = session;
    const [{ data: keys, error: ke }, { data: logs, error: le }] = await Promise.all([
      db.from("access_keys").select("id,revoked,expires_at").limit(1000),
      db.from("activity_logs").select("id,event_type,details,created_at").order("created_at", { ascending: false }).limit(12)
    ]);
    if (ke) throw ke; if (le) throw le;
    const allKeys = keys || [], allLogs = logs || [];
    const activeKeys = allKeys.filter(k => !k.revoked && (!k.expires_at || new Date(k.expires_at).getTime() > Date.now())).length;
    const events24h = allLogs.filter(l => new Date(l.created_at).getTime() > Date.now() - 86400000).length;
    let botStatus = "NOT CONFIGURED";
    if (process.env.BOT_HEALTH_URL) botStatus = "CONFIGURED";
    return send(res, 200, { totalKeys: allKeys.length, activeKeys, events24h, recentLogs: allLogs.slice(0, 5), botStatus });
  } catch (error) {
    console.error("overview error", error.message);
    return send(res, 500, { error: "Could not load dashboard overview." });
  }
};
