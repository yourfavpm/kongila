import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, getSupabaseClient } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawDb = await readDbAsync();
  const db = rawDb as any;
  if (!db.assessments) db.assessments = [];
  if (!db.assessmentCategories) db.assessmentCategories = [];
  if (!db.assessmentQuestions) db.assessmentQuestions = [];
  if (!db.assessmentAssignments) db.assessmentAssignments = [];
  if (!db.skillAssessmentResults) db.skillAssessmentResults = [];

  const supabase = getSupabaseClient();
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
      const newCat = { ...body.data };
      const { data, error } = await supabase.from('assessment_categories').insert([newCat]).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    if (actionEntity === 'question') {
      const newQ = { ...body.data };
      const { data, error } = await supabase.from('assessment_questions').insert([newQ]).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    if (actionEntity === 'assignment') {
      const newAsg = { ...body.data, start_time: new Date().toISOString(), status: 'in_progress' };
      const { data, error } = await supabase.from('assessment_assignments').insert([newAsg]).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
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
          catMaxScore += q.max_score || 0;
          maxTotalScore += q.max_score || 0;
          
          if (q.type === 'multiple_choice') {
            const userAnswer = asg.answers?.[q.id];
            if (Array.isArray(q.correct_answer)) {
              if (Array.isArray(userAnswer) && JSON.stringify([...userAnswer].sort()) === JSON.stringify([...q.correct_answer].sort())) {
                catScore += q.max_score || 0;
              }
            } else {
              if (userAnswer === q.correct_answer) {
                catScore += q.max_score || 0;
              }
            }
          }
        }
        
        categoryScores.push({ category_id: catId, score: catMaxScore > 0 ? (catScore / catMaxScore) * 100 : 0 });
        totalScore += catScore;
      }
      
      asg.score = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
      asg.category_scores = categoryScores;
      
      // Save assignment to Supabase
      const { error: asgError } = await supabase.from('assessment_assignments').update({
        status: asg.status,
        end_time: asg.end_time,
        answers: asg.answers,
        score: asg.score,
        category_scores: asg.category_scores
      }).eq('id', asg.id);
      if (asgError) return res.status(500).json({ error: asgError.message });
      
      // Backward compatibility with results
      const newResult = {
        "talentId": asg.talent_id,
        "assessmentId": asg.assessment_id,
        score: asg.score,
        passed: asg.score >= (assessment?.passing_score || 0),
        "completedAt": asg.end_time
      };
      
      const { error: resError } = await supabase.from('skill_assessment_results').insert([newResult]);
      if (resError) console.error("Failed to insert skill_assessment_results:", resError.message);

      return res.status(200).json(asg);
    }

    // Grade subjective
    if (body.type === 'grade_subjective') {
      const { error: resError } = await supabase.from('skill_assessment_results').update({
        score: body.score,
        passed: body.passed,
        "subjectiveScores": body.subjectiveScores,
        "categoryScores": body.categoryScores
      }).eq('id', body.resultId);
      
      if (resError) return res.status(500).json({ error: resError.message });
      
      if (body.talentSkillAssessmentId) {
         await supabase.from('talent_skill_assessments').update({
           status: body.passed ? 'Passed' : 'Failed',
           score: body.score
         }).eq('id', body.talentSkillAssessmentId);
      }
      
      return res.status(200).json({ success: true });
    }

    // Record raw result (legacy or simple)
    if (body.type === 'result') {
      const newResult = {
        "talentId": body.talentId,
        "assessmentId": body.assessmentId,
        score: body.score,
        passed: body.passed,
        "submittedAt": new Date().toISOString(),
      };
      const { data, error } = await supabase.from('skill_assessment_results').insert([newResult]).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    // Default: Create Assessment
    const newAssessment = {
      ...body.data,
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
    
    const { data, error } = await supabase.from('assessments').insert([newAssessment]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (method === 'PUT') {
    const body = req.body;
    const actionEntity = body.entity || entity;

    if (actionEntity === 'category') {
      const { error } = await supabase.from('assessment_categories').update(body.data).eq('id', body.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    if (actionEntity === 'question') {
      const { error } = await supabase.from('assessment_questions').update(body.data).eq('id', body.id);
      if (error) return res.status(500).json({ error: error.message });
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
    
    const { data, error } = await supabase.from('assessments').update(body.data).eq('id', body.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (method === 'DELETE') {
    if (entity === 'category') {
      // Questions cascade on delete due to foreign keys, but just to be safe
      const { error } = await supabase.from('assessment_categories').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
    if (entity === 'question') {
      const { error } = await supabase.from('assessment_questions').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
    
    // Default Assessment delete
    const { error } = await supabase.from('assessments').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
