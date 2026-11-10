/**
 * One shape for a work simulation task row.
 *
 * The table is snake_case; both portals speak camelCase. This lived inside
 * workSimulationService as a private helper, so readDbAsync — which is what
 * actually puts tasks in front of a candidate — had no way to reach it
 * without importing the service, and the service imports getSupabaseClient
 * from index. Rather than keep two mappers that drift, it lives here and
 * both sides import it.
 */

export interface WorkSimulationTask {
  id: string;
  talentId: string;
  title: string;
  description: string | null;
  /** 'file' | 'link' | 'text'. */
  submissionType: string;
  assignedBy: string | null;
  assignedAt: string | null;
  deadline: string | null;
  submittedAt: string | null;
  submissionUrl: string | null;
  submissionText: string | null;
  submissionName: string | null;
  score: number | null;
  maxScore: number | null;
  reviewerNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  status: string;
  createdAt: string | null;
}

export function mapWorkSimulationTask(row: any): any {
  if (!row) return row;
  return {
    id: row.id,
    talentId: row.talent_id,
    title: row.title,
    description: row.description,
    submissionType: row.submission_type,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    deadline: row.deadline,
    submittedAt: row.submitted_at,
    submissionUrl: row.submission_url,
    submissionText: row.submission_text,
    submissionName: row.submission_name,
    score: row.score,
    maxScore: row.max_score,
    reviewerNotes: row.reviewer_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    status: row.status,
    createdAt: row.created_at
  };
}
