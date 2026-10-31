const { clearSessionCookie, send, methodNotAllowed } = require("./_lib/auth");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  clearSessionCookie(res);
  return send(res, 200, { ok: true });
};
