# Transactional email setup

Kongila sends application notifications through Resend from server-side API
routes. The Resend API key must never be exposed as a `NEXT_PUBLIC_` variable.

## Resend

1. Add and verify the sending domain in Resend. Publish the exact SPF/DKIM DNS
   records Resend provides, and configure DMARC for the domain.
2. Create a Resend API key with permission to send email. Set `RESEND_API_KEY`
   and `RESEND_FROM` in both the `kongila-web` and `admin-panel` Vercel projects.
   `RESEND_FROM` must be an address on the verified domain, for example
   `Kongila <notifications@your-verified-domain>`.
3. Set `NEXT_PUBLIC_SITE_URL` to the deployed client portal and
   `NEXT_PUBLIC_ADMIN_URL` to the deployed admin portal in each app. For local
   development, use `http://localhost:3000` and `http://localhost:3002`.
4. Optionally set `EMAIL_LOGO_URL` to a publicly reachable logo image,
   `EMAIL_SUPPORT_EMAIL` for the branded footer, and `EMAIL_REPLY_TO` for replies.
   `apps/kongila-web/public/images/kongilalogo.png` is the fallback logo.
5. Add the same variables to each app's ignored `.env.local` for local tests.
   Never paste actual credentials into `.env.example` or commit them.

The admin portal's **Users & Roles** page has a test-email button. It sends
only to the signed-in operator's own address; verify the message in the inbox
and Resend's delivery logs before sending real invitations.

## Client and talent verification and recovery

Client and talent signup verification and password recovery use six-digit
codes sent directly by the Kongila server through the Resend API. Supabase
Auth remains the account, password, and session provider; it does not send the
signup or recovery messages in these flows.

1. In Resend, verify the sender domain and set `RESEND_API_KEY` and
   `RESEND_FROM` in the **kongila-web** Vercel project. Do not prefix either
   variable with `NEXT_PUBLIC_`.
2. Generate a separate OTP hashing secret, for example with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   Set it as `OTP_HASH_SECRET` in the kongila-web Vercel project and in
   `apps/kongila-web/.env.local`. Keep the same value across instances of that
   deployment. Never commit it.
3. In the Supabase SQL editor, review and manually apply
   `packages/database/migrations/2026-11-11b_auth_email_otp.sql`. The OTP
   endpoints cannot send or verify codes until the service-role-only challenge
   and IP rate-limit tables and function exist. The migration is not run
   automatically by deployment.
4. In Supabase Dashboard → Authentication → Providers → Email, turn off
   **Confirm email** for password signups. The app creates an Auth user only
   after the Resend code is verified and marks that email confirmed server
   side. Do not enable another client signup path that calls
   `supabase.auth.signUp`.
5. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only in the kongila-web Vercel
   project and local server environment. The OTP routes use the Auth Admin API
   to create verified users and update passwords. Never put this key in a
   `NEXT_PUBLIC_` variable or a browser-readable env file.
6. Publish the deployment after the migration and env vars are ready. Test
   with an address you control: complete a talent signup and a client request
   signup, then request a password reset. Codes expire in 10 minutes, can be
   used once, and are limited to five sends per email per hour with a
   one-minute resend cooldown, five verification attempts, and 20 sends per IP
   per hour.

Unknown addresses receive the same request-success message as existing
accounts. Resend delivery errors are returned explicitly; check the Resend
dashboard and server logs for provider failures.

Supabase Auth still stores users and verifies passwords. This setup removes
Supabase-managed signup confirmation and recovery email delivery; it does not
replace Supabase Auth with a separate identity provider.

Admin invitations and resend-invite actions use a Supabase-generated
single-use link delivered through Kongila's branded Resend template. Add the
admin portal's `/set-password` URL to Supabase Auth's allowed redirect URLs.
The invited operator sets their own password on that page.

## Smoke test

1. Use the Users & Roles test-email button and verify the logo, footer, and
   reply address.
2. Invite a test operator from **Users** in the admin panel. Confirm the email
   arrives, the setup link opens the admin portal, and the password can be set.
3. Change the test operator's role and confirm they receive the role-change
   email. Then verify Resend shows accepted delivery for both messages.
4. Test client and talent signup verification and password recovery with a
   mailbox you control. Confirm the messages appear in Resend's delivery logs
   and that a code cannot be reused after success.

Email dispatch failures are shown as warnings for non-blocking notifications.
Invitation creation remains visible when Resend rejects delivery, and the
admin can use **Resend invite** after resolving the provider/configuration
issue.
