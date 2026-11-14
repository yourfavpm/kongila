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

import { SOLUTIONS } from '../components/marketing/siteMap';

export async function getServerSideProps(context: { query: Record<string, string | string[] | undefined> }) {
  const raw = context.query.model;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  const known = SOLUTIONS.find(solution => solution.slug === slug);
  const query = known ? `&model=${encodeURIComponent(known.slug)}` : '';
  return { redirect: { destination: `/?intake=1${query}`, permanent: false } };
}

export default function GetStarted() { return null; }
