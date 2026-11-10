import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient } from '@kongila/database';

/** Returns only assessments and assignments visible to the signed-in talent. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'talent') return res.status(403).json({ error: 'Only talents can read this resource' });

  const talentId = actor.talentProfileId || actor.userId;
  const supabase = getSupabaseClient();

  // "talentId", not talent_id. This table and skill_assessment_results use
  // quoted camelCase column names while everything around them is snake_case
  // — see the note above the tables in supabase_migration.sql. Querying
  // talent_id raised 42703, which this handler turned into "Could not load
  // assessment assignments", so a candidate could not open an assessment
  // that had been assigned to them at all.
  const { data: assignments, error: assignmentError } = await supabase
    .from('talent_skill_assessments')
    .select('*')
    .eq('talentId', talentId);
  if (assignmentError) {
    console.error('[assessments] assignment list failed:', assignmentError.message);
    return res.status(500).json({ error: 'Could not load assessment assignments' });
  }

  // Same table, same convention: the column is "assessmentId". Reading
  // assessment_id gave undefined for every row, so `ids` came back empty,
  // the assessments query was skipped, and the portal received an
  // assignment pointing at an assessment it had not been sent. The runner
  // then had no paper to open — the same silent dead end as above, one
  // line further down.
  const ids = Array.from(new Set(
    (assignments || []).map((row: any) => row.assessmentId).filter(Boolean)
  ));
  const { data: assessments, error: assessmentError } = ids.length
    ? await supabase.from('assessments').select('*').in('id', ids)
    : { data: [], error: null };
  if (assessmentError) {
    console.error('[assessments] assessment list failed:', assessmentError.message);
    return res.status(500).json({ error: 'Could not load assessments' });
  }

  return res.status(200).json({ assessments: assessments || [], talentSkillAssessments: assignments || [] });
}
