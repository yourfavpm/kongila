/**
 * The same check, run the way the app runs.
 *
 * /api/selftest opened in the address bar always reports "not authenticated",
 * because a plain navigation sends no Authorization header — apiFetch is what
 * attaches the token. That made the API-only version useless as a diagnostic
 * and briefly made it look like authentication was broken when nothing had
 * been tested at all.
 *
 * This page runs in the browser, signed in, and goes through exactly the path
 * the dashboards use: supabase.auth.getSession for a token, then apiFetch to
 * the routes. Whatever fails here is what is failing for the portals.
 *
 * Open /selftest while signed in.
 */

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';
import { apiFetch } from '../lib/apiFetch';
import { Mascot } from '@kongila/ui';

interface Step {
  name: string;
  ok: boolean | null;
  detail: string;
  data?: unknown;
}

const RESOURCES = [
  'users', 'talents', 'clientRequests', 'matches', 'organizations',
  'notifications', 'interviews', 'assessments'
];

export default function SelfTest() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const found: Step[] = [];
    const push = (s: Step) => {
      found.push(s);
      if (!cancelled) setSteps([...found]);
    };

    (async () => {
      // 1. Is there a session in this browser at all?
      let token: string | undefined;
      try {
        const { data, error } = await supabase.auth.getSession();
        token = data?.session?.access_token;
        push({
          name: 'Session in the browser',
          ok: Boolean(token),
          detail: error
            ? `getSession errored: ${error.message}`
            : token
              ? `Signed in as ${data?.session?.user?.email || 'unknown'}. Token present (${token.length} chars).`
              : 'No session. You are not signed in in this browser — sign in, then reload this page.'
        });
      } catch (err: any) {
        push({
          name: 'Session in the browser',
          ok: false,
          detail: `getSession threw: ${err?.message || String(err)}`
        });
      }

      // 2. Does the token reach the server and resolve to a user?
      try {
        const res = await apiFetch('/api/selftest');
        const body = await res.json().catch(() => ({}));
        push({
          name: 'Server recognises the caller',
          ok: res.ok && body?.stages?.authentication?.ok === true,
          detail: res.ok
            ? body?.stages?.authentication?.ok
              ? `Recognised as ${body.actorKind}.`
              : 'The token did not resolve to a row in public.users with a role.'
            : `HTTP ${res.status}`,
          data: body
        });
      } catch (err: any) {
        push({
          name: 'Server recognises the caller',
          ok: false,
          detail: `Request threw: ${err?.message || String(err)}`
        });
      }

      // 3. The call the dashboards actually make.
      try {
        const res = await apiFetch(`/api/resources?names=${RESOURCES.join(',')}`);
        const body = await res.json().catch(() => ({}));
        const counts = Object.fromEntries(
          RESOURCES.map(n => [n, Array.isArray(body?.data?.[n]) ? body.data[n].length : null])
        );
        const total = Object.values(counts).reduce<number>((a, b) => a + (b || 0), 0);
        push({
          name: 'The call the dashboards make',
          ok: res.ok && total > 0,
          detail: res.ok
            ? total > 0
              ? `Returned ${total} records.`
              : 'Returned 200 with every list empty.'
            : `HTTP ${res.status} — ${body?.error || 'no error body'}`,
          data: counts
        });
      } catch (err: any) {
        push({
          name: 'The call the dashboards make',
          ok: false,
          detail: `Request threw: ${err?.message || String(err)}`
        });
      }

      if (!cancelled) setRunning(false);
    })();

    return () => { cancelled = true; };
  }, []);

  const verdict = (() => {
    if (running) return null;
    const session = steps.find(s => s.name === 'Session in the browser');
    const auth = steps.find(s => s.name === 'Server recognises the caller');
    const call = steps.find(s => s.name === 'The call the dashboards make');

    if (session && !session.ok) {
      return 'You are not signed in in this browser. Sign in first, then reload this page — nothing below means anything until that is true.';
    }
    if (auth && !auth.ok) {
      return 'The browser has a valid session but the server does not recognise it. Either the token is not reaching the route, or your user has no row in public.users with a role. That is why every screen is empty.';
    }
    if (call && !call.ok) {
      return 'Authentication works and the read works, but the resources call came back empty or errored. The detail line above says which.';
    }
    return 'Everything the portals depend on is working. If a screen is still empty, it is that screen rather than the data layer — tell me which one.';
  })();

  return (
    <>
      <Head>
        <title>Self test · Kongila</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main
        style={{
          minHeight: '100vh',
          background: '#F6F8FC',
          padding: '48px 24px',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <Mascot state={running ? 'loading' : 'thinking'} size={64} label="" />
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: '#0E1726' }}>
                Why are the screens empty?
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6B7A99' }}>
                Run while signed in. Each step is the one the dashboards take.
              </p>
            </div>
          </div>

          {steps.map(step => (
            <div
              key={step.name}
              style={{
                background: '#fff',
                border: '1px solid #E4E9F2',
                borderRadius: 14,
                padding: 20,
                marginBottom: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: step.ok ? '#1FB97A' : '#E2504A',
                    flexShrink: 0
                  }}
                />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#0E1726' }}>{step.name}</span>
              </div>
              <p style={{ margin: '0 0 0 22px', fontSize: 13.5, lineHeight: 1.6, color: '#526180' }}>
                {step.detail}
              </p>
              {step.data != null && (
                <pre
                  style={{
                    margin: '12px 0 0 22px',
                    padding: 12,
                    background: '#F6F8FC',
                    borderRadius: 8,
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    color: '#33415C',
                    overflowX: 'auto'
                  }}
                >
                  {JSON.stringify(step.data, null, 2)}
                </pre>
              )}
            </div>
          ))}

          {verdict && (
            <div
              style={{
                marginTop: 20,
                padding: 20,
                borderRadius: 14,
                background: '#EAF1FF',
                border: '1px solid #C3D8F8',
                fontSize: 14,
                lineHeight: 1.65,
                color: '#0E2A66'
              }}
            >
              {verdict}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
