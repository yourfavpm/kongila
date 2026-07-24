import React, { useState, useEffect } from 'react';
import { GlassCard, NeonButton } from '@kongila/ui';
import { supabase } from '../lib/supabaseClient';
import { ServiceRequest, ServiceType } from '@kongila/shared-types';
import { COUNTRIES_AND_CODES } from '../lib/onboarding-constants';

interface SmartIntakeFormProps {
  currentUser?: any;
  onComplete: (request: ServiceRequest) => void;
  onCancel?: () => void;
}

export default function SmartIntakeForm({ currentUser, onComplete, onCancel }: SmartIntakeFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneCodeSearch, setPhoneCodeSearch] = useState('');
  const [showPhoneCodeDropdown, setShowPhoneCodeDropdown] = useState(false);

  const [formData, setFormData] = useState<Partial<ServiceRequest>>({
    serviceType: '' as ServiceType,
    currency: 'USD',
    budgetMinUsd: 0,
    budgetMaxUsd: 0,
    budgetUnknown: false,
    requiredSkills: [],
    preferredTimezones: [],
  });

  // Step 6 / Auth Fields
  const [authData, setAuthData] = useState({
    fullName: '',
    companyName: '',
    jobTitle: '',
    businessEmail: '',
    phoneCode: '+1',
    phone: '',
    password: '',
    tosAccepted: false,
    mode: 'signup' // 'signup' or 'login'
  });

  // Auto-save to SessionStorage
  useEffect(() => {
    if (step > 1 && !currentUser) {
      const interval = setInterval(() => {
        sessionStorage.setItem('kongila_intake_draft', JSON.stringify({ step, formData }));
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [step, formData, currentUser]);

  useEffect(() => {
    if (!currentUser) {
      const saved = sessionStorage.getItem('kongila_intake_draft');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.formData) setFormData(parsed.formData);
          if (parsed.step) setStep(parsed.step);
        } catch (e) {}
      }
    }
  }, [currentUser]);

  const updateForm = (field: keyof ServiceRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    // Validation Gate
    setErrorMsg('');
    if (step === 1 && !formData.serviceType) {
      setErrorMsg('Please select a service type.');
      return;
    }
    
    if (step === 2) {
      if (formData.serviceType === 'Hire Talent' || formData.serviceType === 'placement') {
        if (!formData.roleTitle || !formData.seniorityLevel || !formData.numOfTalents) {
          setErrorMsg('Role Title, Seniority Level, and Number of Hires are required.'); return;
        }
      } else if (formData.serviceType === 'Outsource Talent' || formData.serviceType === 'outsourcing' || formData.serviceType === 'Managed Workforce' || formData.serviceType === 'managed_workforce') {
        if (!formData.teamSize || !formData.coverageType) {
          setErrorMsg('Team Size and Coverage Type are required.'); return;
        }
      } else if (formData.serviceType === 'Project Execution' || formData.serviceType === 'project') {
        if (!formData.projectName || !formData.projectDescription || !formData.projectDeadline) {
          setErrorMsg('Project Name, Description, and Deadline are required.'); return;
        }
      }
    }
    
    if (step === 3) {
      if (!formData.engagementType || !formData.durationType || !formData.startDate) {
        setErrorMsg('Engagement Type, Duration, and Start Date are required.'); return;
      }
    }
    
    if (step === 4) {
      if (!formData.budgetUnknown && (!formData.budgetMinUsd || formData.budgetMinUsd <= 0)) {
        setErrorMsg('Please set a budget or select "Not Sure".'); return;
      }
    }
    
    if (step === 5) {
      if (!formData.urgencyLevel) {
        setErrorMsg('Please select urgency level.'); return;
      }
      if (currentUser) {
        submitRequest();
        return;
      }
    }

    setStep(prev => prev + 1);
  };

  const submitRequest = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      let finalUserId = currentUser?.id;
      let finalClientName = currentUser ? `${currentUser.name} (${currentUser.companyName || 'Company'})` : '';

      if (!currentUser) {
        if (!authData.tosAccepted) throw new Error('You must accept the Terms of Service.');
        
        if (authData.mode === 'signup') {
          // Check free email warning
          const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
          const emailDomain = authData.businessEmail.split('@')[1];
          if (freeDomains.includes(emailDomain?.toLowerCase())) {
            // Non-blocking warning (could be UI but doing console/alert for simplicity)
            console.warn('Free email domain detected. We recommend a business email.');
          }

          const { data: authRes, error: signUpErr } = await supabase.auth.signUp({
            email: authData.businessEmail,
            password: authData.password,
            options: { data: { name: authData.fullName, role: 'client' } }
          });
          if (signUpErr) throw signUpErr;

          finalUserId = authRes.user?.id || crypto.randomUUID();
          finalClientName = `${authData.fullName} (${authData.companyName})`;

          // Create public.users
          const { error: usersErr } = await supabase.from('users').upsert({
            id: finalUserId, email: authData.businessEmail, password_hash: 'auth_managed', role: 'client', status: 'active', email_verified: false
          });
          if (usersErr) throw new Error(`Users DB Error: ${usersErr.message}`);

          // Create org
          const orgId = crypto.randomUUID();
          const { error: orgErr } = await supabase.from('organizations').upsert({
            id: orgId, 
            name: authData.companyName, 
            created_by: finalUserId,
            contact_email: authData.businessEmail,
            contact_phone: authData.phone ? `${authData.phoneCode} ${authData.phone}` : null
          });
          if (orgErr) throw new Error(`Org DB Error: ${orgErr.message}`);

          // Create client profile
          const { error: cpErr } = await supabase.from('client_profiles').upsert({
            id: crypto.randomUUID(), user_id: finalUserId, organization_id: orgId, position: authData.jobTitle, phone: authData.phone ? `${authData.phoneCode} ${authData.phone}` : null
          });
          if (cpErr) throw new Error(`Client Profile DB Error: ${cpErr.message}`);
        } else {
          // Login Flow
          const { data: loginRes, error: loginErr } = await supabase.auth.signInWithPassword({
            email: authData.businessEmail, password: authData.password
          });
          if (loginErr) throw loginErr;
          finalUserId = loginRes.user?.id;
          finalClientName = `${loginRes.user?.user_metadata?.name || 'Client'} (Company)`;
        }
      }

      // Generate Reference
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const randomChars = Math.floor(1000 + Math.random() * 9000);
      const refNumber = `KNG-REQ-${dateStr}-${randomChars}`;

      const payload: ServiceRequest = {
        id: crypto.randomUUID(),
        referenceNumber: refNumber,
        clientId: finalUserId,
        clientName: finalClientName,
        serviceType: formData.serviceType as ServiceType,
        
        // Legacy required fields mapping
        roleDescription: formData.roleDescription || formData.description || formData.projectDescription || '',
        requiredSkills: formData.requiredSkills || [],
        duration: formData.duration || formData.durationType || 'Flexible',
        commitmentLevel: formData.commitmentLevel || formData.engagementType || 'Full-Time',
        numberOfHires: formData.numberOfHires || formData.numOfTalents || formData.teamSize || 1,
        timezone: (formData.preferredTimezones || []).join(', ') || 'EST',
        startDate: formData.startDate || new Date().toISOString(),
        budget: formData.budgetMinUsd || 0,
        priority: 'Medium', // default mapping
        
        ...formData,
        id: crypto.randomUUID(),
        status: 'New Request',
        createdAt: new Date().toISOString(),
      };

      const { error: dbErr } = await supabase.from('talent_requests').insert([{
        client_id: finalUserId,
        service_type: formData.serviceType,
        payload: payload
      }]);
      
      if (dbErr) throw dbErr;

      sessionStorage.removeItem('kongila_intake_draft');
      onComplete(payload);

    } catch (err: any) {
      setErrorMsg(err.message);
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div>
      <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>What service level do you require?</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Select an engagement structure scaled to your operational backing.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {[
          { id: 'Hire Talent', title: 'Hire Talent (Placement)', desc: 'Find and screen talent for me to employ and manage directly. One-time placement fee.' },
          { id: 'Outsource Talent', title: 'Outsource Talent', desc: 'Dedicated remote team members under my direction, payroll/compliance managed by Kongila.' },
          { id: 'Managed Workforce', title: 'Managed Workforce', desc: 'Kongila provides, supervises, and manages performance end-to-end.' },
          { id: 'Project Execution', title: 'Project Execution', desc: 'I have a specific deliverable; Kongila staffs and manages delivery.' }
        ].map(item => (
          <div 
            key={item.id}
            onClick={() => updateForm('serviceType', item.id as ServiceType)}
            style={{
              padding: '16px', borderRadius: '10px',
              border: `1.5px solid ${formData.serviceType === item.id ? 'var(--accent-purple)' : 'var(--border-glass)'}`,
              background: formData.serviceType === item.id ? 'var(--accent-purple-glow)' : 'var(--bg-secondary)',
              cursor: 'pointer', display: 'flex', gap: '16px', alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{item.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => {
    const type = formData.serviceType;
    const isHire = type === 'Hire Talent' || type === 'placement';
    const isOutsource = type === 'Outsource Talent' || type === 'outsourcing';
    const isManaged = type === 'Managed Workforce' || type === 'managed_workforce';
    const isProject = type === 'Project Execution' || type === 'project';

    return (
      <div>
        <h3 style={{ fontSize: '18px', marginBottom: '24px', color: 'var(--text-primary)' }}>Describe your requirement</h3>
        
        {isHire && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Role Title <span style={{color:'red'}}>*</span></label>
              <input type="text" className="form-input" maxLength={100} value={formData.roleTitle || ''} onChange={e => updateForm('roleTitle', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Skills Required (comma separated) <span style={{color:'red'}}>*</span></label>
              <input type="text" className="form-input" value={(formData.requiredSkills || []).join(', ')} onChange={e => updateForm('requiredSkills', e.target.value.split(',').map(s=>s.trim()))} />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Seniority Level <span style={{color:'red'}}>*</span></label>
                <select className="form-select" value={formData.seniorityLevel || ''} onChange={e => updateForm('seniorityLevel', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="Junior (1-3 years)">Junior (1-3 years)</option>
                  <option value="Mid-level (3-6 years)">Mid-level (3-6 years)</option>
                  <option value="Senior (6-10 years)">Senior (6-10 years)</option>
                  <option value="Lead (8-15 years)">Lead (8-15 years)</option>
                  <option value="Executive (12+ years)">Executive (12+ years)</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Number of Hires <span style={{color:'red'}}>*</span></label>
                <input type="number" min={1} max={50} className="form-input" value={formData.numOfTalents || ''} onChange={e => updateForm('numOfTalents', Number(e.target.value))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Role Description <span style={{color:'red'}}>*</span></label>
              <textarea className="form-input" style={{ minHeight: '80px' }} value={formData.roleDescription || ''} onChange={e => updateForm('roleDescription', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Must-Have Qualifications</label>
              <textarea className="form-input" maxLength={500} value={formData.mustHaveQualifications || ''} onChange={e => updateForm('mustHaveQualifications', e.target.value)} />
            </div>
          </div>
        )}

        {(isOutsource || isManaged) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Team Size <span style={{color:'red'}}>*</span></label>
                <input type="number" min={1} max={100} className="form-input" value={formData.teamSize || ''} onChange={e => updateForm('teamSize', Number(e.target.value))} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">
                  Coverage Type <span style={{color:'red'}}>*</span>
                  <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '2px'}}>The specific working hours and days you need the talent to be available</div>
                </label>
                <select className="form-select" value={formData.coverageType || ''} onChange={e => updateForm('coverageType', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="Standard (8 hours/day, 5 days/week)">Standard (8 hours/day, 5 days/week)</option>
                  <option value="Extended (12 hours/day or weekends)">Extended (12 hours/day or weekends)</option>
                  <option value="24-7 (Round the clock coverage)">24-7 (Round the clock coverage)</option>
                  <option value="Custom (Specify your own hours)">Custom (Specify your own hours)</option>
                </select>
              </div>
            </div>
            {formData.coverageType === 'Custom' && (
              <div className="form-group">
                <label className="form-label">Custom Hours</label>
                <input type="text" className="form-input" placeholder="e.g. 10AM - 2PM EST" value={formData.customHours || ''} onChange={e => updateForm('customHours', e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">
                {isManaged ? 'Service Description & Outcomes' : 'Team Description'} <span style={{color:'red'}}>*</span>
                <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '2px'}}>Describe the team's goals, existing structure, and what this specific role will contribute.</div>
              </label>
              <textarea className="form-input" style={{ minHeight: '80px' }} value={formData.teamDescription || ''} onChange={e => updateForm('teamDescription', e.target.value)} />
            </div>
            
            {isManaged ? (
              <div className="form-group">
                <label className="form-label">Supervision Level <span style={{color:'red'}}>*</span></label>
                <select className="form-select" value={formData.supervisionLevel || ''} onChange={e => updateForm('supervisionLevel', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="High">High</option>
                  <option value="Standard">Standard</option>
                  <option value="Light">Light</option>
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">
                  Reporting Structure
                  <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '2px'}}>How will the talent be supervised and managed?</div>
                </label>
                <select className="form-select" value={formData.reportingStructure || ''} onChange={e => updateForm('reportingStructure', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="Client direct (Talent reports directly to you)">Client direct (Talent reports directly to you)</option>
                  <option value="Kongila supervisor (Kongila manages the talent's day-to-day)">Kongila supervisor (Kongila manages the talent's day-to-day)</option>
                  <option value="Hybrid (Shared supervision)">Hybrid (Shared supervision)</option>
                </select>
              </div>
            )}
          </div>
        )}

        {isProject && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Project Name <span style={{color:'red'}}>*</span></label>
              <input type="text" maxLength={150} className="form-input" value={formData.projectName || ''} onChange={e => updateForm('projectName', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Project Description <span style={{color:'red'}}>*</span></label>
              <textarea className="form-input" style={{ minHeight: '80px' }} value={formData.projectDescription || ''} onChange={e => updateForm('projectDescription', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Skills Required <span style={{color:'red'}}>*</span></label>
              <input type="text" className="form-input" placeholder="e.g. React, Node.js" value={(formData.requiredSkills || []).join(', ')} onChange={e => updateForm('requiredSkills', e.target.value.split(',').map(s=>s.trim()))} />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Estimated Scope <span style={{color:'red'}}>*</span></label>
                <select className="form-select" value={formData.estimatedScope || ''} onChange={e => updateForm('estimatedScope', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Project Deadline <span style={{color:'red'}}>*</span></label>
                <input type="date" className="form-input" value={formData.projectDeadline || ''} onChange={e => updateForm('projectDeadline', e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>Engagement Details</h3>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Engagement Type <span style={{color:'red'}}>*</span></label>
          <select className="form-select" value={formData.engagementType || ''} onChange={e => updateForm('engagementType', e.target.value)}>
            <option value="">Select...</option>
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Either">Either</option>
          </select>
        </div>
        {(formData.engagementType === 'Part-time' || formData.engagementType === 'Either') && (
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Part-Time Hours/Week</label>
            <input type="number" min={1} max={39} className="form-input" value={formData.partTimeHours || ''} onChange={e => updateForm('partTimeHours', Number(e.target.value))} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Duration <span style={{color:'red'}}>*</span></label>
          <select className="form-select" value={formData.durationType || ''} onChange={e => updateForm('durationType', e.target.value)}>
            <option value="">Select...</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Fixed Term">Fixed Term</option>
            <option value="Project-based">Project-based</option>
          </select>
        </div>
        {formData.durationType === 'Fixed Term' && (
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Fixed Term Months</label>
            <input type="number" min={1} max={36} className="form-input" value={formData.durationMonths || ''} onChange={e => updateForm('durationMonths', Number(e.target.value))} />
          </div>
        )}
      </div>
      <div className="form-group">
        <label className="form-label">Preferred Start Date <span style={{color:'red'}}>*</span></label>
        <input type="date" className="form-input" value={formData.startDate || ''} onChange={e => updateForm('startDate', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Preferred Timezone</label>
        <input type="text" className="form-input" placeholder="e.g. EST, GMT" value={(formData.preferredTimezones || []).join(', ')} onChange={e => updateForm('preferredTimezones', e.target.value.split(',').map(s=>s.trim()))} />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>Budget Options</h3>
      <div className="form-group">
        <label className="form-label">Currency</label>
        <select className="form-select" value={formData.currency || 'USD'} onChange={e => updateForm('currency', e.target.value)}>
          <option value="USD">USD</option>
          <option value="CAD">CAD</option>
          <option value="GBP">GBP</option>
          <option value="EUR">EUR</option>
          <option value="AUD">AUD</option>
        </select>
      </div>
      <div className="form-group" style={{ opacity: formData.budgetUnknown ? 0.5 : 1 }}>
        <label className="form-label">Min Budget/month ({formData.currency})</label>
        <input type="number" disabled={formData.budgetUnknown} className="form-input" value={formData.budgetMinUsd || ''} onChange={e => updateForm('budgetMinUsd', Number(e.target.value))} />
      </div>
      <div className="form-group" style={{ opacity: formData.budgetUnknown ? 0.5 : 1 }}>
        <label className="form-label">Max Budget/month ({formData.currency})</label>
        <input type="number" disabled={formData.budgetUnknown} className="form-input" value={formData.budgetMaxUsd || ''} onChange={e => updateForm('budgetMaxUsd', Number(e.target.value))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
        <input type="checkbox" id="budgetUnknown" checked={formData.budgetUnknown || false} onChange={e => updateForm('budgetUnknown', e.target.checked)} />
        <label htmlFor="budgetUnknown" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Not Sure (We will discuss on discovery call)</label>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>Priority & Additional Notes</h3>
      <div className="form-group">
        <label className="form-label">Urgency <span style={{color:'red'}}>*</span></label>
        <select className="form-select" value={formData.urgencyLevel || ''} onChange={e => updateForm('urgencyLevel', e.target.value)}>
          <option value="">Select...</option>
          <option value="asap">ASAP</option>
          <option value="within_2_weeks">Within 2 Weeks</option>
          <option value="flexible">Flexible</option>
          <option value="no_rush">No Rush</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">
          Role Criticality
          <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '2px'}}>How urgently does this role impact your core business operations?</div>
        </label>
        <select className="form-select" value={formData.roleCriticality || ''} onChange={e => updateForm('roleCriticality', e.target.value)}>
          <option value="">Select...</option>
          <option value="Nice to have (Not urgent)">Nice to have (Not urgent)</option>
          <option value="Important (Needed for upcoming goals)">Important (Needed for upcoming goals)</option>
          <option value="Business-critical (Operations are affected without this hire)">Business-critical (Operations are affected without this hire)</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Additional Notes</label>
        <textarea className="form-input" maxLength={1000} style={{ minHeight: '80px' }} value={formData.additionalNotes || ''} onChange={e => updateForm('additionalNotes', e.target.value)} />
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>
        {authData.mode === 'signup' ? 'Create Account & Submit' : 'Sign In & Submit'}
      </h3>
      
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button 
          onClick={() => setAuthData({...authData, mode: 'signup'})} 
          style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid', borderColor: authData.mode === 'signup' ? 'var(--accent-purple)' : 'transparent', background: authData.mode === 'signup' ? 'var(--accent-purple-glow)' : 'transparent', color: authData.mode === 'signup' ? 'var(--accent-purple)' : 'var(--text-secondary)', cursor: 'pointer' }}>
          Create Account
        </button>
        <button 
          onClick={() => setAuthData({...authData, mode: 'login'})} 
          style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid', borderColor: authData.mode === 'login' ? 'var(--accent-purple)' : 'transparent', background: authData.mode === 'login' ? 'var(--accent-purple-glow)' : 'transparent', color: authData.mode === 'login' ? 'var(--accent-purple)' : 'var(--text-secondary)', cursor: 'pointer' }}>
          Sign In
        </button>
      </div>

      {authData.mode === 'signup' && (
        <>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-input" value={authData.fullName} onChange={e => setAuthData({...authData, fullName: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input type="text" className="form-input" maxLength={200} value={authData.companyName} onChange={e => setAuthData({...authData, companyName: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Job Title</label>
            <input type="text" className="form-input" value={authData.jobTitle} onChange={e => setAuthData({...authData, jobTitle: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
              {/* Phone code searchable dropdown */}
              <div 
                className="form-input" 
                style={{ width: '120px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}
                onClick={() => { setShowPhoneCodeDropdown(v => !v); setPhoneCodeSearch(''); }}
              >
                <span style={{ fontWeight: 600 }}>{authData.phoneCode || '+?'}</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>▼</span>
              </div>
              {showPhoneCodeDropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: 'var(--bg-secondary, #fff)', border: '1px solid var(--border-glass, #e2e8f0)', borderRadius: '10px', marginTop: '4px', width: '260px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                  <div style={{ padding: '8px' }}>
                    <input
                      autoFocus
                      type="text"
                      className="form-input"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      placeholder="Search country…"
                      value={phoneCodeSearch}
                      onChange={e => setPhoneCodeSearch(e.target.value)}
                    />
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {COUNTRIES_AND_CODES
                      .filter(c => c.name.toLowerCase().includes(phoneCodeSearch.toLowerCase()) || c.code.includes(phoneCodeSearch))
                      .map(c => (
                        <div
                          key={c.name + c.code}
                          onMouseDown={() => { setAuthData({ ...authData, phoneCode: c.code }); setShowPhoneCodeDropdown(false); }}
                          style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-glass, #e2e8f0)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary, #f1f5f9)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span>{c.name}</span>
                          <span style={{ fontWeight: 700, color: 'var(--accent-cyan, #0ea5e9)' }}>{c.code}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              <input type="tel" style={{ flex: 1 }} className="form-input" value={authData.phone} onChange={e => setAuthData({...authData, phone: e.target.value})} />
            </div>
          </div>
        </>
      )}

      <div className="form-group">
        <label className="form-label">Business Email</label>
        <input type="email" className="form-input" value={authData.businessEmail} onChange={e => setAuthData({...authData, businessEmail: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">Password</label>
        <div style={{ position: 'relative' }}>
          <input 
            type={showPassword ? "text" : "password"} 
            className="form-input" 
            style={{ width: '100%', paddingRight: '40px' }}
            value={authData.password} 
            onChange={e => setAuthData({...authData, password: e.target.value})} 
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        </div>
      </div>

      {authData.mode === 'signup' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '8px' }}>
          <input type="checkbox" id="tosAccepted" style={{ marginTop: '4px' }} checked={authData.tosAccepted} onChange={e => setAuthData({...authData, tosAccepted: e.target.checked})} />
          <label htmlFor="tosAccepted" style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.4' }}>
            I agree to the Terms of Service and Privacy Policy. I understand that submitting this form will create a Kongila account.
          </label>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: '24px', boxSizing: 'border-box', width: '100%' }}>
      <GlassCard className="intake-card" style={{ maxWidth: step === 1 ? '650px' : '850px', width: '100%', margin: '0 auto', transition: 'max-width 0.3s ease' }}>
        {/* Header step counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--accent-purple)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>New Service Request</h2>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Step {step} of {currentUser ? 5 : 6}</div>
        </div>

        {/* Progress lines */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {Array.from({ length: currentUser ? 5 : 6 }).map((_, i) => (
            <div 
              key={i} 
              style={{
                flex: 1, 
                height: '4px', 
                borderRadius: '2px', 
                background: step >= (i + 1) ? 'var(--accent-purple)' : 'var(--border-glass)',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>

        {errorMsg && (
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', marginBottom: '24px', fontSize: '14px' }}>
            {errorMsg}
          </div>
        )}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && !currentUser && renderStep6()}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
          {step > 1 ? (
            <NeonButton variant="ghost" onClick={() => { setErrorMsg(''); setStep(step - 1); }}>Back</NeonButton>
          ) : (
            <NeonButton variant="ghost" onClick={() => onCancel && onCancel()}>Cancel</NeonButton>
          )}

          {step < (currentUser ? 5 : 6) ? (
            <NeonButton onClick={handleNext}>Continue</NeonButton>
          ) : (
            <NeonButton 
              onClick={submitRequest} 
              disabled={isSubmitting || (authData.mode === 'signup' && !authData.tosAccepted)}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </NeonButton>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
