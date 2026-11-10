import { parseStorageUrl } from './signedUrls.ts';

export function deadlinePassed(deadline: string | null | undefined, now = Date.now()): boolean {
  if (!deadline) return false;
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return false;
  const end = new Date(due);
  if (due.getUTCHours() === 0 && due.getUTCMinutes() === 0) end.setUTCHours(23, 59, 59, 999);
  return now > end.getTime();
}

export function canSubmitWorkSimulation(status: unknown): boolean {
  return ['assigned', 'in_progress'].includes(String(status));
}

export function canMarkWorkSimulation(status: unknown): boolean {
  return ['submitted', 'marked'].includes(String(status));
}

export function isWorkSimulationStageActive(pipeline: unknown, taskId?: string): boolean {
  if (!Array.isArray(pipeline)) return false;
  const stage = pipeline[5];
  if (!stage || String(stage.status) !== 'in_progress') return false;
  return taskId === undefined || String(stage.taskId || '') === taskId;
}

export function canAssignWorkSimulation(pipeline: unknown): boolean {
  if (!Array.isArray(pipeline)) return false;
  const stage = pipeline[5];
  return Boolean(stage && String(stage.status) === 'in_progress'
    && !String(stage.taskId || '').trim());
}

export function canManageWorkSimulation(role: unknown): boolean {
  return ['admin', 'super_admin', 'superadmin', 'talent_manager', 'ops_manager', 'operations_manager']
    .includes(String(role));
}

export function ownsWorkSimulationTask(task: unknown, talentId: string): boolean {
  return Boolean(task && typeof task === 'object'
    && String((task as Record<string, unknown>).talent_id || '') === talentId);
}

export function validateWorkSimulationSubmission(input: {
  submissionType: unknown;
  talentId: string;
  submissionUrl: string;
  submissionText: string;
}): string | null {
  const { submissionType, talentId, submissionUrl, submissionText } = input;

  if (submissionType === 'link') {
    let parsed: URL;
    try {
      parsed = new URL(submissionUrl);
    } catch {
      return 'Enter a valid HTTPS link before submitting.';
    }
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
      return 'Enter a valid HTTPS link before submitting.';
    }
    if (submissionText) return 'This task expects a link, not a written response.';
    return null;
  }

  if (submissionType === 'text') {
    if (!submissionText) return 'Write your response before submitting.';
    if (submissionUrl) return 'This task expects a written response, not a link.';
    return null;
  }

  if (submissionType === 'file') {
    const storedFile = parseStorageUrl(submissionUrl);
    if (!storedFile || storedFile.bucket !== 'documents'
      || !storedFile.path.startsWith(`${talentId}/`) || submissionText) {
      return 'Upload your file before submitting.';
    }
    return null;
  }

  return 'This task has an unsupported submission type. Contact your Kongila contact.';
}

export function validateWorkSimulationScore(
  value: unknown,
  maxScore: number
): { score?: number; error?: string } {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || value == null || String(value).trim() === '') {
    return { error: 'A score is required.' };
  }
  const score = Number(value);
  if (!Number.isFinite(score)) return { error: 'A score is required.' };
  if (score < 0 || score > maxScore) {
    return { error: `The score must be between 0 and ${maxScore}.` };
  }
  return { score: Math.round(score) };
}
