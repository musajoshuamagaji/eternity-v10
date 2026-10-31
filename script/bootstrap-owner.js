// Run only on a trusted computer. Never deploy this script as an API endpoint.
require("dotenv").config();
const crypto = require("node:crypto");
const readline = require("node:readline");
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local .env first.");
  process.exit(1);
}
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const labelArg = process.argv.slice(2).join(" ").trim() || "Owner";
rl.question("Type CREATE-OWNER-KEY to confirm this is a trusted private terminal: ", async answer => {
  rl.close();
  if (answer !== "CREATE-OWNER-KEY") {
    console.error("Cancelled.");
    process.exit(1);
  }
  const rawKey = "ETV10-" + crypto.randomBytes(24).toString("base64url");
  const keyHash = crypto.createHash("sha256").update(rawKey, "utf8").digest("hex");
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.from("access_keys").insert({
    label: labelArg.slice(0, 80),
    key_hash: keyHash,
    expires_at: null,
    revoked: false,
    is_owner: true
  });
  if (error) {
    console.error("Could not create owner key:", error.message);
    process.exit(1);
  }
  console.log("\nOWNER ACCESS KEY — COPY IT NOW. IT WILL NOT BE SHOWN AGAIN:\n");
  console.log(rawKey);
  console.log("\nKeep this key private. Do not commit it to GitHub.\n");
});
