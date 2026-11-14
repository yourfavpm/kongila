/**
 * Where "Join as Talent" leads.
 *
 * Unlike a client, a professional does start with an account: profile first,
 * then vetting, then matching. This hands over to the portal's signup with
 * the talent role already chosen, so nobody is asked to pick again after
 * clicking a button that said exactly which one they were.
 */

export async function getServerSideProps() {
  return { redirect: { destination: '/?view=signup&role=talent', permanent: false } };
}

export default function JoinTalent() { return null; }
