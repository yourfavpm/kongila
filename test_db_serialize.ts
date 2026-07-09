import { readDbAsync, writeDbAsync } from './packages/database/index.ts';
import fs from 'fs';

async function test() {
  const db = await readDbAsync();
  console.log("INITIAL TALENT Pipeline:", db.talents[0]?.vettingPipeline);

  // simulate admin updating
  if (db.talents[0]) {
    db.talents[0].vettingPipeline = [
      { stageIndex: 0, stageName: 'Application Screening', status: 'passed' },
      { stageIndex: 1, stageName: 'Skill Assessment', status: 'in_progress', assessmentId: 'tsa_123' }
    ] as any;
    
    db.talents[0].vettingScores = { technical: 99, behavioral: 88, personality: 77, remoteReadiness: 66, workSimulation: 55, communication: 44, experience: 33 };
  }

  await writeDbAsync(db);
  console.log("WROTE DB");

  const db2 = await readDbAsync();
  console.log("READ TALENT Pipeline:", JSON.stringify(db2.talents[0]?.vettingPipeline, null, 2));
  console.log("READ TALENT Scores:", JSON.stringify(db2.talents[0]?.vettingScores, null, 2));
}

test().catch(console.error);
