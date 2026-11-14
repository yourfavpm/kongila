import { useCallback, useEffect, useRef, useState } from 'react';

export interface RemoteReadinessReport {
  provider: 'LibreSpeed' | 'browser-only';
  testedAt: string;
  downloadMbps?: number;
  uploadMbps?: number;
  latencyMs?: number;
  jitterMs?: number;
  browser: string;
  operatingSystem: string;
  deviceType: string;
  viewport: string;
  networkEstimate?: {
    effectiveType?: string;
    downlinkMbps?: number;
    rttMs?: number;
    saveData?: boolean;
  };
}

type SpeedTestData = {
  testState: number;
  dlStatus: number | string;
  ulStatus: number | string;
  pingStatus: number | string;
  jitterStatus: number | string;
};

type LibreSpeedInstance = {
  setParameter: (name: string, value: string | number | boolean) => void;
  start: () => void;
  abort: () => void;
  onupdate?: (data: SpeedTestData) => void;
  onend?: (aborted: boolean) => void;
};

declare global {
  interface Window { Speedtest?: new () => LibreSpeedInstance }
}

type Props = {
  value: RemoteReadinessReport | null;
  onChange: (report: RemoteReadinessReport | null) => void;
};

const LIBRESPEED_URL = process.env.NEXT_PUBLIC_LIBRESPEED_URL?.trim().replace(/\/$/, '');
const LIBRESPEED_BACKEND_URL = (process.env.NEXT_PUBLIC_LIBRESPEED_BACKEND_URL || LIBRESPEED_URL || '').trim().replace(/\/$/, '');

function browserSummary() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) && !/Chrome\//.test(ua) ? 'Safari' : 'Other browser';
  const operatingSystem = /Windows/.test(ua) ? 'Windows' : /Mac OS|Macintosh/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Other OS';
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean; platform?: string } }).userAgentData;
  const mobile = typeof uaData?.mobile === 'boolean' ? uaData.mobile : /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const tablet = /iPad|Tablet/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua));
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection;
  return {
    browser,
    operatingSystem: uaData?.platform || operatingSystem,
    deviceType: tablet ? 'Tablet' : mobile ? 'Mobile' : 'Desktop',
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    networkEstimate: connection ? {
      effectiveType: connection.effectiveType,
      downlinkMbps: typeof connection.downlink === 'number' ? connection.downlink : undefined,
      rttMs: typeof connection.rtt === 'number' ? connection.rtt : undefined,
      saveData: connection.saveData,
    } : undefined,
  };
}

function loadScript(url: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.Speedtest) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-librespeed="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load the connection test.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.librespeed = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the connection test.'));
    document.head.appendChild(script);
  });
}

export default function RemoteReadinessTest({ value, onChange }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'error'>('idle');
  const [phase, setPhase] = useState('Ready to test');
  const [error, setError] = useState('');
  const [manualSpeed, setManualSpeed] = useState('');
  const instance = useRef<LibreSpeedInstance | null>(null);
  const lastData = useRef<SpeedTestData | null>(null);
  const mounted = useRef(false);

  const abort = useCallback(() => {
    instance.current?.abort();
    instance.current = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; instance.current?.abort(); };
  }, []);

  const start = async () => {
    if (!LIBRESPEED_URL || !LIBRESPEED_BACKEND_URL) {
      setError('');
      const speed = Number(manualSpeed);
      if (!Number.isFinite(speed) || speed <= 0 || speed > 10000) {
        setStatus('error');
        setError('Enter a valid connection speed in Mbps.');
        return;
      }
      onChange({ provider: 'browser-only', testedAt: new Date().toISOString(), downloadMbps: speed, ...browserSummary() });
      setStatus('idle');
      setPhase('Manual estimate saved');
      return;
    }
    setError('');
    lastData.current = null;
    setStatus('loading');
    try {
      await loadScript('/api/vetting/librespeed/speedtest.js');
      if (!mounted.current) return;
      if (!window.Speedtest) throw new Error('The LibreSpeed test library did not initialise.');
      const test = new window.Speedtest();
      instance.current = test;
      test.setParameter('test_order', 'D_U_P');
      test.setParameter('time_auto', true);
      test.setParameter('telemetry_level', 'none');
      // LibreSpeed emits its CORS response headers when this flag is present.
      test.setParameter('url_dl', `${LIBRESPEED_BACKEND_URL}/garbage.php?cors=true`);
      test.setParameter('url_ul', `${LIBRESPEED_BACKEND_URL}/empty.php?cors=true`);
      test.setParameter('url_ping', `${LIBRESPEED_BACKEND_URL}/empty.php?cors=true`);
      test.onupdate = (data) => {
        if (!mounted.current) return;
        lastData.current = data;
        setPhase(data.testState === 1 ? 'Measuring download' : data.testState === 2 ? 'Measuring latency and stability' : data.testState === 3 ? 'Measuring upload' : data.testState === 4 ? 'Test complete' : 'Preparing test');
      };
      test.onend = (wasAborted) => {
        instance.current = null;
        if (!mounted.current) return;
        if (wasAborted) {
          setStatus('idle');
          setPhase('Test stopped');
          return;
        }
        // LibreSpeed sends a final onupdate before onend.
        const data = lastData.current;
        const validMetric = (metric: number | string) => metric !== '' && metric !== 'Fail' && Number.isFinite(Number(metric));
        if (!data || data.testState !== 4 || !validMetric(data.dlStatus) || !validMetric(data.ulStatus) || !validMetric(data.pingStatus) || !validMetric(data.jitterStatus)) {
          setStatus('error');
          setError('The connection test did not return complete results. Please try again.');
          return;
        }
        onChange({
          provider: 'LibreSpeed', testedAt: new Date().toISOString(),
          downloadMbps: Number(data.dlStatus), uploadMbps: Number(data.ulStatus),
          latencyMs: Number(data.pingStatus), jitterMs: Number(data.jitterStatus),
          ...browserSummary(),
        });
        setStatus('idle');
        setPhase('Test complete');
      };
      setStatus('running');
      // LibreSpeed creates a classic Worker from a path relative to the page.
      // Temporarily set the base URL so it resolves to our same-origin,
      // allowlisted asset proxy; restore it immediately after Worker creation.
      let base = document.querySelector<HTMLBaseElement>('base');
      const createdBase = !base;
      if (!base) {
        base = document.createElement('base');
        document.head.prepend(base);
      }
      const previousBase = base.getAttribute('href');
      base.setAttribute('href', '/api/vetting/librespeed/');
      try { test.start(); }
      finally {
        if (createdBase) base.remove();
        else if (previousBase === null) base.removeAttribute('href');
        else base.setAttribute('href', previousBase);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not start the connection test.');
    }
  };

  return (
    <div style={{ border: '1px solid #DCE6F2', background: '#F8FAFD', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#14213D', fontWeight: 750, fontSize: 14 }}>Connection and device check</div>
          <div style={{ color: '#64748B', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>Measures download, upload, latency and jitter. Device details are coarse browser estimates; Kongila does not attach your IP to this report.</div>
        </div>
        {LIBRESPEED_URL ? <button type="button" onClick={start} disabled={status === 'running' || status === 'loading'} style={{ border: 0, borderRadius: 999, padding: '9px 15px', color: '#fff', background: '#1455D9', fontWeight: 700, cursor: status === 'running' || status === 'loading' ? 'wait' : 'pointer' }}>{status === 'loading' ? 'Loading…' : status === 'running' ? 'Testing…' : value ? 'Run again' : 'Run connection test'}</button> : <span style={{ color: '#64748B', fontSize: 12 }}>Manual check available</span>}
      </div>
      {(status === 'running' || status === 'loading') && <div role="status" style={{ marginTop: 12, color: '#1455D9', fontSize: 13, fontWeight: 650 }}>{phase}… This may take a short moment.</div>}
      {error && <div role="alert" style={{ marginTop: 10, color: '#9A3412', background: '#FFF7ED', padding: 10, borderRadius: 8, fontSize: 12 }}>{error}</div>}
      {!LIBRESPEED_URL && <div style={{ display: 'flex', alignItems: 'end', gap: 10, marginTop: 12, flexWrap: 'wrap' }}><label style={{ display: 'grid', gap: 5, color: '#14213D', fontSize: 12, fontWeight: 650 }}>Connection speed (Mbps, self-reported)<input type="number" min="0.1" max="10000" step="0.1" value={manualSpeed} onChange={e => setManualSpeed(e.target.value)} placeholder="e.g. 50" style={{ padding: '9px 10px', border: '1px solid #DCE6F2', borderRadius: 8, minWidth: 180, color: '#14213D', background: '#fff' }} /></label><button type="button" onClick={start} style={{ border: 0, borderRadius: 999, padding: '9px 15px', color: '#fff', background: '#1455D9', fontWeight: 700, cursor: 'pointer' }}>Save estimate</button></div>}
      {value && <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 8 }}>
        {[
          ['Download', value.downloadMbps == null ? '—' : `${value.downloadMbps.toFixed(1)} Mbps`],
          ['Upload', value.uploadMbps == null ? '—' : `${value.uploadMbps.toFixed(1)} Mbps`],
          ['Latency', value.latencyMs == null ? '—' : `${value.latencyMs.toFixed(0)} ms`],
          ['Jitter', value.jitterMs == null ? '—' : `${value.jitterMs.toFixed(1)} ms`],
        ].map(([label, result]) => <div key={label} style={{ background: '#fff', border: '1px solid #E5EAF1', borderRadius: 8, padding: '9px 10px' }}><div style={{ color: '#64748B', fontSize: 11 }}>{label}</div><div style={{ color: '#14213D', fontSize: 14, fontWeight: 750, marginTop: 3 }}>{result}</div></div>)}
        <div style={{ gridColumn: '1 / -1', color: '#64748B', fontSize: 11 }}>Detected: {value.deviceType} · {value.operatingSystem} · {value.browser} · {value.viewport}px viewport{value.networkEstimate?.effectiveType ? ` · network estimate ${value.networkEstimate.effectiveType}` : ''}</div>
      </div>}
      {!LIBRESPEED_URL && <p style={{ margin: '10px 0 0', color: '#64748B', fontSize: 11, lineHeight: 1.5 }}>A self-hosted LibreSpeed server has not been configured. The manual estimate is clearly marked as self-reported; device details are approximate and vary by browser.</p>}
      {status === 'running' && <button type="button" onClick={abort} style={{ marginTop: 8, border: 0, padding: 0, background: 'transparent', color: '#64748B', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>Stop test</button>}
    </div>
  );
}
