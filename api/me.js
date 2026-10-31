const { send, requireSession, methodNotAllowed } = require("./_lib/auth");
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const session = await requireSession(req, res);
    if (!session) return;
    return send(res, 200, { ok: true, isOwner: session.isOwner });
  } catch (error) {
    console.error("me error", error.message);
    return send(res, 500, { error: "Could not validate session." });
  }
};
