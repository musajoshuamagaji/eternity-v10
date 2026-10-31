const { send, requireSession, logEvent, methodNotAllowed } = require("./_lib/auth");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const session = await requireSession(req, res); if (!session) return;
    const value = typeof req.body?.groupId === "string" ? req.body.groupId.trim() : "";
    if (!value || value.length > 180) return send(res, 400, { error: "Enter a group identifier between 1 and 180 characters." });
    const valid = /^[A-Za-z0-9._:@+-]+$/.test(value);
    await logEvent(session.db, "group_id_checked", `Group ID format check: ${valid ? "valid" : "needs review"}`);
    return send(res, 200, { valid, message: valid ? "The identifier contains only common ID characters." : "The identifier contains spaces or unsupported characters. Check the source format." });
  } catch (error) {
    console.error("group lookup error", error.message);
    return send(res, 500, { error: "Could not check the group identifier." });
  }
};
