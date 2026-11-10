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

## Supabase Auth email

Account signup confirmation and password recovery are sent by Supabase Auth,
not the Kongila Resend transport. To brand and deliver those messages through
Resend:

1. Configure Supabase Auth's custom SMTP with Resend's SMTP credentials.
   Use `smtp.resend.com`, port `465` (SSL) or `587` (STARTTLS), username
   `resend`, and the Resend API key as the SMTP password. Use a sender address
   on the domain verified above.
2. Replace the Supabase confirmation and recovery templates with Kongila's
   approved copy and logo. The signup confirmation redirects to
   `/?authView=verified`; password recovery redirects to `/reset-password`.
3. Add the deployed client portal's root and `/reset-password` URLs to Supabase
   Auth's allowed redirect URLs.

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
4. Test client signup confirmation and password recovery separately; those
   depend on Supabase SMTP/templates and do not use the admin test endpoint.

Email dispatch failures are shown as warnings for non-blocking notifications.
Invitation creation remains visible when Resend rejects delivery, and the
admin can use **Resend invite** after resolving the provider/configuration
issue.
