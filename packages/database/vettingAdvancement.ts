import { VETTING_STAGES } from '../matching-engine/index.ts';

/**
 * Derive an advancement event from a persisted pipeline transition. Requiring
 * an active stage to change from in_progress to passed makes approvals,
 * assignments, retries, and re-approvals distinguishable at the source.
 */
export function getVettingStageAdvancement(
  previousPipeline: unknown,
  nextPipeline: unknown
): { fromStage: string; toStage: string } | null {
  if (!Array.isArray(previousPipeline) || !Array.isArray(nextPipeline)) return null;

  const activeBefore = VETTING_STAGES.filter(stage =>
    (previousPipeline.find((item: any) => Number(item?.stageIndex) === stage.index) as any)?.status === 'in_progress'
  );
  const activeAfter = VETTING_STAGES.filter(stage =>
    (nextPipeline.find((item: any) => Number(item?.stageIndex) === stage.index) as any)?.status === 'in_progress'
  );
  if (activeBefore.length !== 1 || activeAfter.length !== 1) return null;

  const newlyPassed = VETTING_STAGES.filter(stage => {
    const before = previousPipeline.find((item: any) => Number(item?.stageIndex) === stage.index) as any;
    const after = nextPipeline.find((item: any) => Number(item?.stageIndex) === stage.index) as any;
    return before?.status === 'in_progress' && after?.status === 'passed';
  });
  if (newlyPassed.length !== 1) return null;

  const completed = newlyPassed[0];
  if (activeBefore[0].index !== completed.index) return null;
  const nextStage = VETTING_STAGES.find(stage => stage.index === completed.index + 1);
  if (!nextStage) return null;
  if (activeAfter[0].index !== nextStage.index) return null;

  const nextRecord = nextPipeline.find((item: any) => Number(item?.stageIndex) === nextStage.index) as any;
  if (nextRecord?.status !== 'in_progress') return null;

  return { fromStage: String(completed.name), toStage: String(nextStage.name) };
}
