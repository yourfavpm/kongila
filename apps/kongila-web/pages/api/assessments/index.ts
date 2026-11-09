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
  const { data: assignments, error: assignmentError } = await supabase
    .from('talent_skill_assessments')
    .select('*')
    .eq('talent_id', talentId);
  if (assignmentError) {
    console.error('[assessments] assignment list failed:', assignmentError.message);
    return res.status(500).json({ error: 'Could not load assessment assignments' });
  }

  const ids = Array.from(new Set((assignments || []).map((row: any) => row.assessment_id).filter(Boolean)));
  const { data: assessments, error: assessmentError } = ids.length
    ? await supabase.from('assessments').select('*').in('id', ids)
    : { data: [], error: null };
  if (assessmentError) {
    console.error('[assessments] assessment list failed:', assessmentError.message);
    return res.status(500).json({ error: 'Could not load assessments' });
  }

  return res.status(200).json({ assessments: assessments || [], talentSkillAssessments: assignments || [] });
}
