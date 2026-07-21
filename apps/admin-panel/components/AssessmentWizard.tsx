import React, { useState, useEffect } from 'react';
import { Assessment, AssessmentCategory, AssessmentQuestion, QuestionType } from '@kongila/shared-types';

interface AssessmentWizardProps {
  onClose: () => void;
  onSuccess: () => void;
  globalCategories: AssessmentCategory[];
  globalQuestions: AssessmentQuestion[];
  initialAssessment?: Partial<Assessment>;
}

export default function AssessmentWizard({ onClose, onSuccess, globalCategories, globalQuestions, initialAssessment }: AssessmentWizardProps) {
  const [step, setStep] = useState(initialAssessment ? 2 : 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft Data
  const [assessment, setAssessment] = useState<Partial<Assessment>>(initialAssessment || {
    title: '',
    role_targeted: '',
    description: '',
    total_time_limit_minutes: 60,
    passing_score: 70,
    categories: [],
    category_overrides: [],
    status: 'draft'
  });

  // Local drafted categories & questions before they are saved to global DB
  // This allows the wizard to save everything at the end or step-by-step
  const [draftCategories, setDraftCategories] = useState<AssessmentCategory[]>([]);
  const [draftQuestions, setDraftQuestions] = useState<AssessmentQuestion[]>([]);
  
  // UI States for Modals inside the wizard
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState<Partial<AssessmentCategory>>({ name: '', description: '', time_limit_minutes: 15, is_reusable: true, tags: [] });
  
  const [showQuestionModal, setShowQuestionModal] = useState<string | null>(null); // category ID
  const [newQuestion, setNewQuestion] = useState<Partial<AssessmentQuestion>>({ type: 'multiple_choice', question_text: '', options: ['', '', '', ''], correct_answer: '', scoring_weight: 1, max_score: 10 });

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!assessment.title || !assessment.role_targeted || !assessment.passing_score) {
        setError("Please fill out all required fields.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (assessment.categories?.length === 0) {
        setError("Please add at least one category to proceed.");
        return;
      }
      setStep(3);
    }
  };

  const handlePublish = async (status: 'draft' | 'published') => {
    setError(null);
    setSaving(true);
    try {
      // 1. Create drafted categories via API
      const catIdsMap: Record<string, string> = {};
      for (const cat of draftCategories) {
        if (!cat.id.startsWith('cat_')) {
          const res = await fetch('/api/assessments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity: 'category', data: cat })
          });
          const savedCat = await res.json();
          catIdsMap[cat.id] = savedCat.id; // Map temp ID to real ID
        }
      }

      // 2. Create drafted questions via API
      for (const q of draftQuestions) {
        const catId = catIdsMap[q.category_id] || q.category_id;
        await fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: 'question', data: { ...q, category_id: catId } })
        });
      }

      // 3. Create Assessment
      const finalCategories = (assessment.categories || []).map(id => catIdsMap[id] || id);
      const finalOverrides = (assessment.category_overrides || []).map(o => ({ ...o, categoryId: catIdsMap[o.categoryId] || o.categoryId }));

      const payload = {
        ...assessment,
        status,
        categories: finalCategories,
        category_overrides: finalOverrides,
        created_by: 'Admin'
      };

      const res = await fetch('/api/assessments', {
        method: assessment.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'assessment', id: assessment.id, data: payload })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create assessment');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    if (!newCategory.name || !newCategory.time_limit_minutes) return;
    const tempId = `temp_cat_${Date.now()}`;
    const cat = { ...newCategory, id: tempId, questions: [] } as AssessmentCategory;
    setDraftCategories([...draftCategories, cat]);
    setAssessment({ ...assessment, categories: [...(assessment.categories || []), tempId] });
    setShowCategoryModal(false);
    setNewCategory({ name: '', description: '', time_limit_minutes: 15, is_reusable: true, tags: [] });
  };

  const importCategory = (catId: string, clone: boolean = false) => {
    const globalCat = globalCategories.find(c => c.id === catId);
    if (!globalCat) return;

    if (clone) {
      const tempId = `temp_cat_${Date.now()}`;
      const clonedCat = { ...globalCat, id: tempId, name: `${globalCat.name} (Copy)` };
      setDraftCategories([...draftCategories, clonedCat]);
      
      // clone questions
      const qs = globalQuestions.filter(q => q.category_id === catId);
      const newQs = qs.map(q => ({ ...q, id: `temp_q_${Date.now()}_${Math.random()}`, category_id: tempId }));
      setDraftQuestions([...draftQuestions, ...newQs]);

      setAssessment({ ...assessment, categories: [...(assessment.categories || []), tempId] });
    } else {
      // Linked
      setAssessment({ ...assessment, categories: [...(assessment.categories || []), catId] });
    }
  };

  const addQuestion = () => {
    if (!showQuestionModal || !newQuestion.question_text) return;
    
    if (newQuestion.id) {
      setDraftQuestions(draftQuestions.map(q => q.id === newQuestion.id ? { ...newQuestion, category_id: showQuestionModal } as AssessmentQuestion : q));
    } else {
      const q = { ...newQuestion, id: `temp_q_${Date.now()}`, category_id: showQuestionModal } as AssessmentQuestion;
      setDraftQuestions([...draftQuestions, q]);
    }
    
    setShowQuestionModal(null);
    setNewQuestion({ type: 'multiple_choice', question_text: '', options: ['', '', '', ''], correct_answer: '', scoring_weight: 1, max_score: 10 });
  };

  const toggleOverride = (catId: string, value: number) => {
    const overrides = assessment.category_overrides || [];
    const idx = overrides.findIndex(o => o.categoryId === catId);
    if (idx >= 0) {
      overrides[idx].timeLimitMinutes = value;
    } else {
      overrides.push({ categoryId: catId, timeLimitMinutes: value });
    }
    setAssessment({ ...assessment, category_overrides: [...overrides] });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: '800px', width: '100%', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Assessment Builder</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        {/* Wizard Steps */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ flex: 1, height: '4px', borderRadius: '2px', background: s <= step ? 'var(--kongila-blue)' : 'var(--border-glass)' }} />
          ))}
        </div>

        {error && <div style={{ padding: '12px', background: 'rgba(255, 60, 60, 0.1)', color: 'var(--accent-magenta)', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>{error}</div>}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Step 1: Assessment Details</h3>
            <div>
              <label className="form-label">Assessment Title*</label>
              <input type="text" className="form-input" value={assessment.title} onChange={e => setAssessment({ ...assessment, title: e.target.value })} placeholder="e.g. Senior Frontend React Assessment" />
            </div>
            <div>
              <label className="form-label">Target Role*</label>
              <input type="text" className="form-input" value={assessment.role_targeted} onChange={e => setAssessment({ ...assessment, role_targeted: e.target.value })} placeholder="e.g. Frontend Engineer" />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={assessment.description} onChange={e => setAssessment({ ...assessment, description: e.target.value })} placeholder="Brief description of this assessment..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">Total Time Limit (minutes)</label>
                <input type="number" className="form-input" value={assessment.total_time_limit_minutes} onChange={e => setAssessment({ ...assessment, total_time_limit_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <label className="form-label">Passing Score (%)*</label>
                <input type="number" className="form-input" value={assessment.passing_score} onChange={e => setAssessment({ ...assessment, passing_score: Number(e.target.value) })} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Step 2: Categories & Sections</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Assessments are broken into categories. Add new ones or import existing from the library.</p>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button type="button" onClick={() => setShowCategoryModal(true)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}>+ New Category</button>
              <select className="form-input" style={{ flex: 1, padding: '8px' }} onChange={(e) => {
                if (e.target.value) {
                  importCategory(e.target.value, false);
                  e.target.value = ''; // reset
                }
              }}>
                <option value="">Import Linked Category from Library...</option>
                {globalCategories.filter(c => !(assessment.categories || []).includes(c.id)).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.time_limit_minutes}m)</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(assessment.categories || []).map(catId => {
                const cat = draftCategories.find(c => c.id === catId) || globalCategories.find(c => c.id === catId);
                const isLinked = !draftCategories.find(c => c.id === catId);
                const override = (assessment.category_overrides || []).find(o => o.categoryId === catId);
                const timeLimit = override ? override.timeLimitMinutes : cat?.time_limit_minutes;

                if (!cat) return null;
                return (
                  <div key={catId} style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cat.name} {isLinked && <span style={{ fontSize: '10px', background: 'var(--border-glass)', padding: '2px 6px', borderRadius: '4px' }}>Linked</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Time: <input type="number" style={{ width: '50px', background: 'transparent', border: '1px solid var(--border-glass)', color: 'inherit', borderRadius: '4px', padding: '2px 4px', fontSize: '12px' }} value={timeLimit || ''} onChange={(e) => toggleOverride(catId, Number(e.target.value))} /> m
                      </div>
                    </div>
                    <button type="button" onClick={() => setAssessment({ ...assessment, categories: assessment.categories?.filter(id => id !== catId) })} style={{ background: 'none', border: 'none', color: 'var(--accent-magenta)', cursor: 'pointer', fontSize: '13px' }}>Remove</button>
                  </div>
                );
              })}
            </div>

            {/* Category Creation Modal */}
            {showCategoryModal && (
              <div className="modal-overlay" style={{ zIndex: 1100, background: 'rgba(0,0,0,0.8)' }}>
                <div className="modal-content" style={{ padding: '24px', maxWidth: '400px' }}>
                  <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>New Category</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input type="text" className="form-input" placeholder="Category Name (e.g. JavaScript Core)" value={newCategory.name} onChange={e => setNewCategory({...newCategory, name: e.target.value})} />
                    <textarea className="form-textarea" placeholder="Description" value={newCategory.description} onChange={e => setNewCategory({...newCategory, description: e.target.value})} />
                    <input type="number" className="form-input" placeholder="Time Limit (m)" value={newCategory.time_limit_minutes} onChange={e => setNewCategory({...newCategory, time_limit_minutes: Number(e.target.value)})} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <input type="checkbox" checked={newCategory.is_reusable} onChange={e => setNewCategory({...newCategory, is_reusable: e.target.checked})} /> Add to global library
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button type="button" onClick={addCategory} className="btn-primary" style={{ flex: 1 }}>Add</button>
                    <button type="button" onClick={() => setShowCategoryModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Step 3: Questions</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Add questions to your categories.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {(assessment.categories || []).map(catId => {
                const cat = draftCategories.find(c => c.id === catId) || globalCategories.find(c => c.id === catId);
                const isLinked = !draftCategories.find(c => c.id === catId);
                const questions = [...globalQuestions.filter(q => q.category_id === catId), ...draftQuestions.filter(q => q.category_id === catId)];

                if (!cat) return null;
                return (
                  <div key={catId} style={{ border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ fontWeight: 600, fontSize: '15px' }}>{cat.name} {isLinked && <span style={{ fontSize: '10px', color: 'var(--accent-green)' }}>(Linked - Read Only)</span>}</h4>
                      {!isLinked && <button type="button" onClick={() => setShowQuestionModal(catId)} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px' }}>+ Add Question</button>}
                    </div>

                    {questions.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No questions added yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {questions.map((q, idx) => {
                          const isDraft = !!draftQuestions.find(dq => dq.id === q.id);
                          return (
                            <div key={q.id} style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Q{idx + 1}. {q.question_text}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  <span style={{ textTransform: 'capitalize' }}>{q.type.replace('_', ' ')}</span>
                                  <span>• {q.max_score} pts</span>
                                </div>
                                {!isLinked && isDraft && (
                                  <button type="button" onClick={() => { setNewQuestion(q); setShowQuestionModal(catId); }} style={{ background: 'none', border: '1px solid var(--border-glass)', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Edit</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Question Creation Modal */}
            {showQuestionModal && (
              <div className="modal-overlay" style={{ zIndex: 1100, background: 'rgba(0,0,0,0.8)' }}>
                <div className="modal-content" style={{ padding: '24px', maxWidth: '500px' }}>
                  <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Add Question</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <select className="form-input" value={newQuestion.type} onChange={e => setNewQuestion({...newQuestion, type: e.target.value as QuestionType})}>
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="short_answer">Short Answer</option>
                      <option value="essay">Essay</option>
                      <option value="file_upload">File Upload</option>
                    </select>
                    
                    <textarea className="form-textarea" placeholder="Question Text" value={newQuestion.question_text} onChange={e => setNewQuestion({...newQuestion, question_text: e.target.value})} />
                    
                    {newQuestion.type === 'multiple_choice' && (
                      <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>Options:</div>
                        {(newQuestion.options || ['', '', '', '']).map((opt, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="radio" name="correct" checked={newQuestion.correct_answer === opt && opt !== ''} onChange={() => setNewQuestion({...newQuestion, correct_answer: opt})} />
                            <input type="text" className="form-input" style={{ flex: 1, padding: '6px' }} placeholder={`Option ${i+1}`} value={opt} onChange={e => {
                              const opts = [...(newQuestion.options || [])];
                              opts[i] = e.target.value;
                              setNewQuestion({...newQuestion, options: opts});
                            }} />
                          </div>
                        ))}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Select the radio button next to the correct answer.</div>
                      </div>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <input type="number" className="form-input" placeholder="Scoring Weight" value={newQuestion.scoring_weight} onChange={e => setNewQuestion({...newQuestion, scoring_weight: Number(e.target.value)})} />
                      <input type="number" className="form-input" placeholder="Max Score" value={newQuestion.max_score} onChange={e => setNewQuestion({...newQuestion, max_score: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button type="button" onClick={addQuestion} className="btn-primary" style={{ flex: 1 }}>Add Question</button>
                    <button type="button" onClick={() => setShowQuestionModal(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
          {step > 1 ? (
            <button type="button" className="btn-secondary" onClick={() => setStep(step - 1)}>Back</button>
          ) : <div></div>}
          
          <div style={{ display: 'flex', gap: '12px' }}>
            {step < 3 ? (
              <button type="button" className="btn-primary" onClick={handleNext}>Next Step</button>
            ) : (
              <>
                <button type="button" className="btn-secondary" onClick={() => handlePublish('draft')} disabled={saving}>Save Draft</button>
                <button type="button" className="btn-primary" onClick={() => handlePublish('published')} disabled={saving}>{saving ? 'Publishing...' : 'Publish Assessment'}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
