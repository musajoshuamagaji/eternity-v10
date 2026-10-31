# ETERNITY V10 — Private Dashboard

A mobile-first, black/red private dashboard. Access keys are validated by Vercel server functions; raw keys are never stored in Supabase, only SHA-256 hashes. Sessions use a signed, HttpOnly, Secure, SameSite=Strict cookie and every protected API route re-checks that the access key remains active.

## Important scope notes

- The dashboard and access-key management are real.
- Group ID Lookup validates a string's format only. It does not discover groups or contact services.
- Bot status is real only after `BOT_HEALTH_URL` is configured to an HTTPS health endpoint that you control.
- The first key is created with a one-time bootstrap script and marked as the owner. Keys generated from the dashboard are regular user keys and cannot manage other keys, read activity logs, or access owner statistics. Do not add a public "create owner key" endpoint.
- Use only with systems, accounts, and groups you own or are authorized to administer.

## 1. Create Supabase database

1. Create a Supabase project.
2. Open **SQL Editor** → **New query**.
3. Paste the entire `supabase-schema.sql` file and run it.
4. Open **Project Settings → API** and copy:
   - Project URL
   - `service_role` secret key (keep it private)

## 2. Create the first owner access key

After you create the GitHub repo and set the Vercel environment variables below, create the first key locally on a trusted computer using the Vercel CLI, or use a one-time local Node script that inserts the SHA-256 hash. Do not publish a bootstrap endpoint.

Simplest beginner option: use the temporary `scripts/bootstrap-owner.js` file included in this project. Run it only on a trusted computer with Node.js, and delete it after use. **Do not run bootstrap scripts in a public online code runner.**

### Bootstrap on a computer with Node.js

1. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. Run `npm install`.
3. Run `node scripts/bootstrap-owner.js "YOUR OWNER LABEL"` and follow the prompt. The script prints the raw owner key once.
4. Keep the key private. Remove `.env` and never commit it.

If you only have an Android phone, you can still edit and deploy from Spck/GitHub, but generating the first owner key requires a trusted Node.js runtime. Do not expose the service-role key to a browser page. You can use a trusted terminal environment that you control, or ask a trusted developer to run the bootstrap script privately.

## 3. Vercel environment variables

In Vercel → Project → Settings → Environment Variables, add these for Production, Preview, and Development as appropriate:

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role secret
- `SESSION_SECRET` — a long random secret, at least 32 random bytes encoded as hex
- `BOT_HEALTH_URL` — optional HTTPS health endpoint you control

Do not prefix secrets with `NEXT_PUBLIC_` or `VITE_`. Never add them to `app.js`, `index.html`, or GitHub.

## 4. Deploy

1. Upload all project files to a GitHub repository; keep `.env` out of GitHub.
2. In Vercel, import that repository.
3. Framework preset: **Other**. Build command can be blank; output directory is the project root.
4. Add environment variables, then deploy.
5. After changing environment variables, redeploy.
6. Open the deployment URL over HTTPS.

## 5. Security reminders

- Access keys are bearer secrets: anyone who gets a key can use it until it expires or is revoked. Share carefully.
- The session cookie is HttpOnly and cannot be read by browser JavaScript.
- Protected endpoints re-check key status, so revocation takes effect on the next request.
- Use a strong `SESSION_SECRET`; rotate it if it is exposed.
- The Supabase service-role key bypasses RLS. It belongs only in Vercel server environment variables.
- The dashboard is not an identity system. If you need to know exactly which person used a shared key, issue one key per person.
- For production with many users, add rate limiting/WAF rules and alerting for repeated failed login attempts.


**Owner-only administration:** the initial bootstrap key is the only owner key. Dashboard-created keys are non-owner keys. Keep the owner key private; use it to manage and revoke user keys.
