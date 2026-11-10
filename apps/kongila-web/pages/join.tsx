/**
 * Where "Join as Talent" leads.
 *
 * Unlike a client, a professional does start with an account: profile first,
 * then vetting, then matching. This hands over to the portal's signup with
 * the talent role already chosen, so nobody is asked to pick again after
 * clicking a button that said exactly which one they were.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Mascot from '../components/brand/Mascot';

export default function JoinTalent() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    router.replace('/?view=signup&role=talent');
  }, [router.isReady, router]);

  return (
    <>
      <Head>
        <title>Join the talent network · Kongila</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fff' }}>
        <Mascot state="loading" size={72} label="Opening your application" />
      </div>
    </>
  );
}
