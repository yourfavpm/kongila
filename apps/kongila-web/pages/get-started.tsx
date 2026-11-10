/**
 * Where "Get Started" leads.
 *
 * A client does not sign up and then file a request. They file a request,
 * and the account is created as part of it — so this is not a signup page,
 * it is the front door to the service request, and it hands straight over to
 * the intake the portal already runs. The model slug, if one came from a
 * Solutions page, rides along so the form opens on the right engagement type
 * instead of asking a question the visitor just answered by clicking.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Mascot from '../components/brand/Mascot';
import { SOLUTIONS } from '../components/marketing/siteMap';

export default function GetStarted() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.model;
    const slug = Array.isArray(raw) ? raw[0] : raw;
    const known = SOLUTIONS.find(s => s.slug === slug);
    const query = known ? `&model=${known.slug}` : '';
    router.replace(`/?intake=1${query}`);
  }, [router.isReady, router.query.model, router]);

  return (
    <>
      <Head>
        <title>Get started · Kongila</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fff' }}>
        <Mascot state="loading" size={72} label="Opening your request" />
      </div>
    </>
  );
}
