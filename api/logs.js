const { send, requireSession, methodNotAllowed, requireOwner } = require("./_lib/auth");
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const session = await requireSession(req, res); if (!session) return;
    if (!requireOwner(session, res)) return;
    const { data, error } = await session.db.from("activity_logs").select("id,event_type,details,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return send(res, 200, { logs: data || [] });
  } catch (error) {
    console.error("logs error", error.message);
    return send(res, 500, { error: "Could not load activity logs." });
  }
};
