const { send, requireSession, methodNotAllowed } = require("./_lib/auth");
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const session = await requireSession(req, res); if (!session) return;
    const url = process.env.BOT_HEALTH_URL;
    if (!url) return send(res, 200, { status: "NOT CONFIGURED", message: "No BOT_HEALTH_URL has been set in Vercel yet. The dashboard cannot verify a bot without a real health endpoint." });
    let parsed;
    try { parsed = new URL(url); } catch (_) { return send(res, 200, { status: "CONFIG ERROR", message: "BOT_HEALTH_URL is not a valid URL." }); }
    if (parsed.protocol !== "https:") return send(res, 200, { status: "CONFIG ERROR", message: "For safety, BOT_HEALTH_URL must use HTTPS." });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(parsed.toString(), { method: "GET", signal: controller.signal, headers: { "User-Agent": "ETERNITY-V10-health-check" } });
      if (response.ok) return send(res, 200, { status: "ONLINE", message: `Health endpoint responded with HTTP ${response.status}.` });
      return send(res, 200, { status: "OFFLINE", message: `Health endpoint responded with HTTP ${response.status}.` });
    } catch (_) {
      return send(res, 200, { status: "OFFLINE", message: "The health endpoint did not respond successfully within 4.5 seconds." });
    } finally { clearTimeout(timeout); }
  } catch (error) {
    console.error("bot status error", error.message);
    return send(res, 500, { error: "Could not check bot status." });
  }
};
