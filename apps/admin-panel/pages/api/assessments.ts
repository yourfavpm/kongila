import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawDb = await readDbAsync();
  const db = rawDb as any;
  if (!db.assessments) db.assessments = [];
  if (!db.assessmentCategories) db.assessmentCategories = [];
  if (!db.assessmentQuestions) db.assessmentQuestions = [];
  if (!db.assessmentAssignments) db.assessmentAssignments = [];
  if (!db.skillAssessmentResults) db.skillAssessmentResults = [];

  const { method } = req;
  const { entity, id } = req.query; // entity can be 'assessment', 'category', 'question', 'assignment'

  if (method === 'GET') {
    if (entity === 'category') return res.status(200).json(db.assessmentCategories);
    if (entity === 'question') {
      const catId = req.query.categoryId;
      if (catId) {
        return res.status(200).json(db.assessmentQuestions.filter((q: any) => q.category_id === catId));
      }
      return res.status(200).json(db.assessmentQuestions);
    }
    if (entity === 'assignment') return res.status(200).json(db.assessmentAssignments);
    
    // Default GET returns all base assessment data
    return res.status(200).json({ 
      assessments: db.assessments, 
      categories: db.assessmentCategories,
      questions: db.assessmentQuestions,
      assignments: db.assessmentAssignments,
      results: db.skillAssessmentResults 
    });
  }

  if (method === 'POST') {
    const body = req.body;
    const actionEntity = body.entity || entity;

    if (actionEntity === 'category') {
      const newCat = { ...body.data, id: `cat_${Date.now()}`, created_at: new Date().toISOString() };
      db.assessmentCategories.push(newCat);
      await writeDbAsync(db);
      return res.status(201).json(newCat);
    }

    if (actionEntity === 'question') {
      const newQ = { ...body.data, id: `q_${Date.now()}` };
      db.assessmentQuestions.push(newQ);
      
      // Also attach to category if needed
      const cat = db.assessmentCategories.find((c: any) => c.id === newQ.category_id);
      if (cat) {
        if (!cat.questions) cat.questions = [];
        cat.questions.push(newQ.id);
      }
      
      await writeDbAsync(db);
      return res.status(201).json(newQ);
    }

    if (actionEntity === 'assignment') {
      const newAsg = { ...body.data, id: `asg_${Date.now()}`, start_time: new Date().toISOString(), status: 'in_progress' };
      db.assessmentAssignments.push(newAsg);
      await writeDbAsync(db);
      return res.status(201).json(newAsg);
    }

    if (actionEntity === 'submit_assignment') {
      // Auto-marking logic
      const asg = db.assessmentAssignments.find((a: any) => a.id === body.assignment_id);
      if (!asg) return res.status(404).json({ error: 'Assignment not found' });
      
      asg.answers = body.answers;
      asg.end_time = new Date().toISOString();
      asg.status = 'completed';
      
      // Calculate scores
      let totalScore = 0;
      let maxTotalScore = 0;
      const categoryScores: any[] = [];
      
      const assessment = db.assessments.find((a: any) => a.id === asg.assessment_id);
      
      for (const catId of (assessment?.categories || [])) {
        let catScore = 0;
        let catMaxScore = 0;
        
        const questions = db.assessmentQuestions.filter((q: any) => q.category_id === catId);
        for (const q of questions) {
          catMaxScore += q.max_score;
          maxTotalScore += q.max_score;
          
          if (q.type === 'multiple_choice') {
            const userAnswer = asg.answers?.[q.id];
            // Compare answers (can be single string or array of strings, we'll do JSON stringify for arrays, exact string matching for single)
            if (Array.isArray(q.correct_answer)) {
              if (Array.isArray(userAnswer) && JSON.stringify([...userAnswer].sort()) === JSON.stringify([...q.correct_answer].sort())) {
                catScore += q.max_score;
              }
            } else {
              if (userAnswer === q.correct_answer) {
                catScore += q.max_score;
              }
            }
          } else {
            // Subjective questions need manual marking later, score is 0 for now
          }
        }
        
        categoryScores.push({ category_id: catId, score: catMaxScore > 0 ? (catScore / catMaxScore) * 100 : 0 });
        totalScore += catScore;
      }
      
      asg.score = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
      asg.category_scores = categoryScores;
      
      // Backward compatibility with results
      db.skillAssessmentResults.push({
        id: `asr_${Date.now()}`,
        talentId: asg.talent_id,
        assessmentId: asg.assessment_id,
        score: asg.score,
        passed: asg.score >= (assessment?.passing_score || 0),
        completedAt: asg.end_time
      });

      await writeDbAsync(db);
      return res.status(200).json(asg);
    }

    // Grade subjective
    if (body.type === 'grade_subjective') {
      const idx = db.skillAssessmentResults.findIndex((r: any) => r.id === body.resultId);
      if (idx !== -1) {
        db.skillAssessmentResults[idx].score = body.score;
        db.skillAssessmentResults[idx].passed = body.passed;
        db.skillAssessmentResults[idx].subjectiveScores = body.subjectiveScores;
        db.skillAssessmentResults[idx].categoryScores = body.categoryScores;
      }
      
      if (body.talentSkillAssessmentId) {
        // Find and update the talentSkillAssessment as well if it exists
        if (!db.talentSkillAssessments) db.talentSkillAssessments = [];
        const tIdx = db.talentSkillAssessments.findIndex((t: any) => t.id === body.talentSkillAssessmentId);
        if (tIdx !== -1) {
           db.talentSkillAssessments[tIdx].status = body.passed ? 'Passed' : 'Failed';
           db.talentSkillAssessments[tIdx].score = body.score;
        }
      }
      
      await writeDbAsync(db);
      return res.status(200).json({ success: true });
    }

    // Record raw result (legacy or simple)
    if (body.type === 'result') {
      const newResult = {
        id: `asr_${Date.now()}`,
        talentId: body.talentId,
        assessmentId: body.assessmentId,
        score: body.score,
        passed: body.passed,
        submittedAt: new Date().toISOString(),
      };
      db.skillAssessmentResults.push(newResult);
      await writeDbAsync(db);
      return res.status(201).json(newResult);
    }

    // Default: Create Assessment
    const newAssessment = {
      ...body.data,
      id: `asmnt_${Date.now()}`,
      created_at: new Date().toISOString(),
      status: body.data.status || 'draft',
      categories: body.data.categories || [],
      category_overrides: body.data.category_overrides || []
    };
    
    // Validation before publishing
    if (newAssessment.status === 'published') {
      if (newAssessment.categories.length === 0) return res.status(400).json({ error: 'Assessment must have at least one category to be published.' });
      
      for (const catId of newAssessment.categories) {
        const cat = db.assessmentCategories.find((c: any) => c.id === catId);
        if (!cat) return res.status(400).json({ error: `Category ${catId} not found.` });
        
        // Time limit override check
        const override = newAssessment.category_overrides?.find((o: any) => o.categoryId === catId);
        const timeLimit = override?.timeLimitMinutes || cat.time_limit_minutes;
        if (!timeLimit || timeLimit <= 0) return res.status(400).json({ error: `Category "${cat.name}" must have a time limit.` });
        
        const qs = db.assessmentQuestions.filter((q: any) => q.category_id === catId);
        if (qs.length === 0) return res.status(400).json({ error: `Category "${cat.name}" must have at least one question.` });
        
        for (const q of qs) {
          if (!q.type) return res.status(400).json({ error: 'Question missing type.' });
          if (!q.scoring_weight) return res.status(400).json({ error: 'Question missing scoring weight.' });
          if (q.type === 'multiple_choice' && (!q.correct_answer || q.correct_answer === '')) {
            return res.status(400).json({ error: `MCQ question "${q.question_text}" is missing a correct answer.` });
          }
        }
      }
      
      if (!newAssessment.passing_score) return res.status(400).json({ error: 'Passing score must be set.' });
    }

    db.assessments.push(newAssessment);
    
    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: 'Admin',
        action: 'Create Assessment',
        details: `Assessment "${newAssessment.title}" created.`,
        timestamp: new Date().toISOString(),
      },
      ...(db.auditLogs || []),
    ];

    await writeDbAsync(db);
    return res.status(201).json(newAssessment);
  }

  if (method === 'PUT') {
    const body = req.body;
    const actionEntity = body.entity || entity;

    if (actionEntity === 'category') {
      db.assessmentCategories = db.assessmentCategories.map((c: any) => c.id === body.id ? { ...c, ...body.data } : c);
      await writeDbAsync(db);
      return res.status(200).json({ success: true });
    }

    if (actionEntity === 'question') {
      db.assessmentQuestions = db.assessmentQuestions.map((q: any) => q.id === body.id ? { ...q, ...body.data } : q);
      await writeDbAsync(db);
      return res.status(200).json({ success: true });
    }

    // Update Assessment
    const idx = db.assessments.findIndex((a: any) => a.id === body.id);
    if (idx === -1) return res.status(404).json({ error: 'Assessment not found' });
    
    const updated = { ...db.assessments[idx], ...body.data };
    
    // Publish validation
    if (updated.status === 'published') {
      if (updated.categories.length === 0) return res.status(400).json({ error: 'Assessment must have at least one category to be published.' });
      
      for (const catId of updated.categories) {
        const cat = db.assessmentCategories.find((c: any) => c.id === catId);
        if (!cat) return res.status(400).json({ error: `Category ${catId} not found.` });
        
        const override = updated.category_overrides?.find((o: any) => o.categoryId === catId);
        const timeLimit = override?.timeLimitMinutes || cat.time_limit_minutes;
        if (!timeLimit || timeLimit <= 0) return res.status(400).json({ error: `Category "${cat.name}" must have a time limit.` });
        
        const qs = db.assessmentQuestions.filter((q: any) => q.category_id === catId);
        if (qs.length === 0) return res.status(400).json({ error: `Category "${cat.name}" must have at least one question.` });
        
        for (const q of qs) {
          if (!q.type) return res.status(400).json({ error: 'Question missing type.' });
          if (!q.scoring_weight) return res.status(400).json({ error: 'Question missing scoring weight.' });
          if (q.type === 'multiple_choice' && (!q.correct_answer || q.correct_answer === '')) {
            return res.status(400).json({ error: `MCQ question "${q.question_text}" is missing a correct answer.` });
          }
        }
      }
      
      if (!updated.passing_score) return res.status(400).json({ error: 'Passing score must be set.' });
    }
    
    db.assessments[idx] = updated;
    await writeDbAsync(db);
    return res.status(200).json(updated);
  }

  if (method === 'DELETE') {
    if (entity === 'category') {
      db.assessmentCategories = db.assessmentCategories.filter((c: any) => c.id !== id);
      db.assessmentQuestions = db.assessmentQuestions.filter((q: any) => q.category_id !== id);
      await writeDbAsync(db);
      return res.status(200).json({ success: true });
    }
    if (entity === 'question') {
      db.assessmentQuestions = db.assessmentQuestions.filter((q: any) => q.id !== id);
      await writeDbAsync(db);
      return res.status(200).json({ success: true });
    }
    
    // Default Assessment delete
    db.assessments = db.assessments.filter((a: any) => a.id !== id);
    await writeDbAsync(db);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
