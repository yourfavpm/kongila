# Remote readiness connection test

Stage 5 supports an optional Kongila-controlled LibreSpeed installation. The
web app uses LibreSpeed's browser library to measure download, upload, HTTP
latency, and jitter. LibreSpeed telemetry is disabled. The app does not ask
LibreSpeed for the candidate IP address and stores only the measured values,
coarse browser/OS/device estimates, viewport dimensions, and the candidate's
workspace confirmations with the Remote Readiness stage.
As with any network test, the host receives normal connection metadata while
serving requests; configure its web-server logging and retention to your
organisation's privacy policy.

## Configure the host

1. Deploy the included [docker-compose.yml](../infra/librespeed/docker-compose.yml)
   on a Docker host that provides a public HTTPS domain. Vercel itself does
   not run this container, so use a separate Docker-capable host. LibreSpeed's
   official Docker guide documents the standalone mode and `8080` container
   port.
2. Point a domain such as `speedtest.yourdomain.com` to that host and enable
   HTTPS. Check that the LibreSpeed page opens at that domain. Do not use the
   example domain below literally.
3. Add these variables in Vercel → Kongila web project → Settings → Environment
   Variables. Add them for Production (and Preview if needed), then redeploy:

   - `NEXT_PUBLIC_LIBRESPEED_URL`: the domain root, for example
     `https://speedtest.yourdomain.com`.
   - `NEXT_PUBLIC_LIBRESPEED_BACKEND_URL`: the backend folder, for example
     `https://speedtest.yourdomain.com/backend`.

   The two values are URLs you create when you deploy LibreSpeed; they are not
   API keys or URLs you obtain from Kongila. For local development, put the
   same values in `apps/kongila-web/.env.local` and restart Next.js.

The app proxies `speedtest.js` and `speedtest_worker.js` through the Kongila
origin so the browser can run LibreSpeed's worker. It connects directly to
`/backend/garbage.php` and `/backend/empty.php` for measurements. The app adds
LibreSpeed's documented `cors=true` parameter to those calls, and does not
enable result telemetry. The browser contacts the server only when a candidate
presses **Run connection test**.

## If the speed-test host is not deployed

Candidates can submit a manually reported download speed, explicitly labelled
as self-reported. No measured upload, latency, or jitter is implied. Browser
network estimates and device classification are approximate and depend on the
browser; they are not hardware certification or a guarantee of remote-work
readiness. Administrators can see the report source and the available fields.
