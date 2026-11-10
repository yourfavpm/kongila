import { apiFetch } from '../lib/apiFetch';
import React, { useState, useEffect } from 'react';
import { GlassCard, NeonButton } from '@kongila/ui';
import { supabase } from '../lib/supabaseClient';
import {
  ServiceRequest,
  ServiceType,
  requestTitle,
  validateRequestRoles,
  MAX_ROLES_PER_REQUEST,
  MAX_COUNT_PER_ROLE
} from '@kongila/shared-types';
import { TIMEZONE_OPTIONS } from '@kongila/utils';
import { COUNTRIES_AND_CODES } from '../lib/onboarding-constants';

interface SmartIntakeFormProps {
  currentUser?: any;
  /**
   * Every request the brief produced. A brief with three roles files three
   * requests, so this is a list; a single-role brief sends a list of one.
   */
  onComplete: (requests: ServiceRequest[]) => void;
  onCancel?: () => void;
}

export default function SmartIntakeForm({ currentUser, onComplete, onCancel }: SmartIntakeFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once the request is filed. While it holds a value the wizard is
  // replaced by the confirmation panel, so nobody can resubmit by pressing
  // Back and Submit again.
  const [confirmation, setConfirmation] = useState<any>(null);
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

  // ─── Roles ──────────────────────────────────────────────────────────────────
  //
  // A client hiring across several roles used to fill this whole wizard once
  // per role, re-entering the same company, budget, timezones and urgency each
  // time, and come away with three unconnected references. The shared context
  // is answered once, below; this step collects the roles it covers.
  //
  // A client hiring one person sees one role card and no array: the controls
  // for adding and removing only appear once there is a reason for them.
  const roles: any[] = Array.isArray((formData as any).roles) && (formData as any).roles.length > 0
    ? (formData as any).roles
    : [{ id: `role-1`, title: '', count: 1, requiredSkills: [] }];

  const setRoles = (next: any[]) => setFormData(prev => ({ ...prev, roles: next } as any));

  const updateRole = (index: number, field: string, value: any) => {
    setRoles(roles.map((role, i) => (i === index ? { ...role, [field]: value } : role)));
  };

  const addRole = () => {
    if (roles.length >= MAX_ROLES_PER_REQUEST) {
      setErrorMsg(`You can add up to ${MAX_ROLES_PER_REQUEST} roles to one request. `
        + 'Submit this one and file a second for the rest, or talk to us and we will set it up for you.');
      return;
    }
    setErrorMsg('');
    setRoles([...roles, { id: `role-${roles.length + 1}`, title: '', count: 1, requiredSkills: [] }]);
  };

  const removeRole = (index: number) => {
    if (roles.length <= 1) return;
    setErrorMsg('');
    setRoles(roles.filter((_, i) => i !== index));
  };

  const totalHeadcount = roles.reduce(
    (total, role) => total + (Number(role.count) > 0 ? Math.floor(Number(role.count)) : 1),
    0
  );

  const handleNext = () => {
    // Validation Gate
    setErrorMsg('');
    if (step === 1 && !formData.serviceType) {
      setErrorMsg('Please select a service type.');
      return;
    }
    
    if (step === 2) {
      if (formData.serviceType === 'Hire Talent' || formData.serviceType === 'placement') {
        // Named, so a client with four roles open is told which one is short
        // rather than being sent back to find it.
        for (let i = 0; i < roles.length; i++) {
          const role = roles[i];
          const label = roles.length > 1 ? `Role ${i + 1}` : 'This role';
          if (!String(role.title || '').trim()) {
            setErrorMsg(`${label}: please give the role a title.`); return;
          }
          if (!role.seniorityLevel) {
            setErrorMsg(`${label} (${role.title}): please choose a seniority level.`); return;
          }
          if (!(Array.isArray(role.requiredSkills) ? role.requiredSkills.filter(Boolean).length : 0)) {
            setErrorMsg(`${label} (${role.title}): please list at least one skill.`); return;
          }
          if (!String(role.description || '').trim()) {
            setErrorMsg(`${label} (${role.title}): please describe what this person will be doing.`); return;
          }
        }
        const reason = validateRequestRoles(roles);
        if (reason) { setErrorMsg(reason); return; }
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
      if (!formData.commitmentLevel || !formData.durationType || !formData.startDate) {
        setErrorMsg('Please say whether this is full-time or part-time, how long for, and when you need them.'); return;
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
      // What provisioning tells us about the company it created, so the
      // confirmation can name it instead of saying "account created".
      let provisionedAccount: any = null;

      if (!currentUser) {
        if (!authData.tosAccepted) throw new Error('You must accept the Terms of Service.');
        
        if (authData.mode === 'signup') {
          // Checked here as well as on the server. Provisioning refuses a
          // client account with no company name rather than inventing one, and
          // a 400 arriving after the whole request has been typed out is a poor
          // way to learn that a field further up the page was left empty.
          if (!authData.fullName.trim()) throw new Error('Please enter your full name.');
          if (!authData.companyName.trim()) {
            throw new Error('Please enter your company name. The account is created for the company, not for you personally.');
          }
          if (!authData.jobTitle.trim()) throw new Error('Please enter the position you hold at the company.');

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

          // Users, organisation and client profile are created server-side in
          // one call. The browser cannot write public.users: UPDATE is revoked
          // from authenticated, so the role column is out of reach. Doing all
          // three together also means a failure partway through no longer
          // leaves an auth account with no profile and no way to retry.
          const provisionRes = await apiFetch('/api/account/provision', {
            method: 'POST',
            body: JSON.stringify({
              role: 'client',
              name: authData.fullName,
              email: authData.businessEmail,
              companyName: authData.companyName,
              position: authData.jobTitle,
              phone: authData.phone ? `${authData.phoneCode} ${authData.phone}` : null,
              contactEmail: authData.businessEmail,
              contactPhone: authData.phone ? `${authData.phoneCode} ${authData.phone}` : null
            })
          });
          const provision = await provisionRes.json();
          if (!provisionRes.ok || !provision?.ok) {
            throw new Error(provision?.error || 'Could not finish creating your account.');
          }
          provisionedAccount = provision;
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

      // Everything the form collected, then the named mappings on top.
      //
      // This used to be an explicit field list, and fifteen answers the client
      // had typed were thrown away on submit — roleTitle, seniorityLevel,
      // coverageType, teamDescription, supervisionLevel, projectName,
      // projectDeadline, partTimeHours, durationMonths, urgencyLevel and
      // additionalNotes among them. The payload column is jsonb, so there was
      // never a reason to drop them. Spreading formData keeps whatever the
      // form collected; the named mappings below settle the few fields the
      // rest of the product reads under a different name.
      // The roles go up as a list and the server files one request for each.
      //
      // They used to be folded into a single request, with the first role's
      // answers copied into the flat fields and the rest carried underneath.
      // That cannot hold: matching, interviews, offers and contracts all
      // happen per role, so one request covering three roles had a single
      // status for three separate conversations, and the second and third
      // roles were only visible by opening the first.
      //
      // The client still answers the shared context once. The split happens
      // on the server, where each role becomes a request with its own
      // reference, and a group id records that they were filed together.
      const isHirePath = formData.serviceType === 'Hire Talent' || formData.serviceType === 'placement';
      const submittedRoles = isHirePath
        ? roles
            .filter(role => String(role.title || '').trim())
            .map((role, i) => ({
              ...role,
              id: role.id || `role-${i + 1}`,
              title: String(role.title).trim(),
              count: Number(role.count) > 0 ? Math.floor(Number(role.count)) : 1,
              requiredSkills: (role.requiredSkills || []).filter(Boolean)
            }))
        : null;
      const leadRole = submittedRoles?.[0];

      const payload: ServiceRequest = {
        ...(formData as any),
        // No id or reference from here. The server mints one per request, and
        // sending one meant every request in a group shared it.
        clientId: finalUserId,
        clientName: finalClientName,
        serviceType: formData.serviceType as ServiceType,
        status: 'New Request' as any,
        createdAt: new Date().toISOString(),

        ...(submittedRoles ? { roles: submittedRoles } : {}),

        // No title here any more. On the Hire Talent path each request is
        // named after its own role, which only the server knows once it has
        // split them; on the other paths the server derives it with the same
        // function. Sending one meant every request in a group was named
        // after the first role.

        // The shared context, which every request in the group inherits.
        // Per-role answers are not set here: the server takes each role's
        // own title, skills, seniority, headcount and description.
        roleDescription: submittedRoles
          ? ''
          : (formData.roleDescription
            || (formData as any).teamDescription
            || (formData as any).projectDescription
            || (formData as any).projectName
            || formData.description
            || ''),
        requiredSkills: submittedRoles ? [] : (formData.requiredSkills || []),
        duration: formData.duration || (formData as any).durationType || 'Flexible',
        commitmentLevel: formData.commitmentLevel || (formData as any).engagementType || 'Full-Time',
        numberOfHires: submittedRoles
          ? undefined
          : (formData.numberOfHires || (formData as any).numOfTalents || (formData as any).teamSize || 1),
        timezone: (formData.preferredTimezones || []).join(', ') || 'EST',
        startDate: formData.startDate || new Date().toISOString(),
        budget: formData.budgetMinUsd || 0,
        priority: (formData.priority || 'Medium') as any,

        // The admin board's Urgent filter and ASAP sort read this. Intake
        // collected urgencyLevel and never set urgency, so the board had
        // nothing to read and readDbAsync invented a value instead.
        urgency: (formData as any).urgencyLevel || (formData as any).urgency || 'Standard',

        // Pass through remaining optional fields from formData
        currency: formData.currency,
        budgetMinUsd: formData.budgetMinUsd,
        budgetMaxUsd: formData.budgetMaxUsd,
        budgetUnknown: formData.budgetUnknown,
        preferredTimezones: formData.preferredTimezones,
        description: (formData as any).description,
      };

      // Business data is persisted by the authenticated server API. The
      // browser must not write directly to Supabase tables.
      const requestRes = await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify({ request: payload })
      });
      const requestBody = await requestRes.json().catch(() => ({}));
      if (!requestRes.ok || !requestBody?.request) {
        throw new Error(requestBody?.error || 'Could not save your request.');
      }
      const createdRequests = Array.isArray(requestBody.requests)
        ? requestBody.requests
        : [requestBody.request];
      const expectedRoleTitles = submittedRoles?.map(role => role.title) || [];
      const rolesWereSplit = expectedRoleTitles.length === 0
        ? createdRequests.length === 1
        : createdRequests.length === expectedRoleTitles.length
          && createdRequests.every((request: any, index: number) =>
            String(request.roleTitle || '').trim().toLowerCase() === expectedRoleTitles[index].trim().toLowerCase()
          );
      if (!rolesWereSplit) {
        throw new Error(
          `Your request was received, but the server returned ${createdRequests.length} separate request(s) `
          + `for ${expectedRoleTitles.length || 1} submitted role(s). Do not submit it again; contact your Kongila team `
          + 'so they can separate the saved roles without creating duplicates.'
        );
      }

      sessionStorage.removeItem('kongila_intake_draft');

      // A Kongila client account is a company, and the person filling this in
      // is its primary contact and administrator. Nothing used to say so: the
      // form closed and dropped them on the dashboard, so they never saw that
      // an organisation had been created, what it was called, or that the
      // company record was theirs to manage.
      setConfirmation({
        accountCreated: Boolean(provisionedAccount),
        organizationName:
          provisionedAccount?.organization?.name
          || authData.companyName
          || currentUser?.companyName
          || null,
        isPrimaryContact: provisionedAccount?.membership?.isPrimaryContact ?? null,
        position: provisionedAccount?.membership?.position || authData.jobTitle || null,
        permissionLevel: provisionedAccount?.membership?.permissionLevel || null,
        contactEmail: provisionedAccount?.organization?.contactEmail || authData.businessEmail || null,
        reference: requestBody.request?.referenceNumber || refNumber,
        request: requestBody.request,
        // Every request the brief produced, so a client who added three roles
        // is told they now have three requests and sees all three references.
        // They used to see one.
        requests: createdRequests
      });
      setIsSubmitting(false);

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
            {roles.length > 1 && (
              <div style={{
                fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary, #F8FAFC)',
                border: '1px solid var(--border-glass, #E2E8F0)', borderRadius: '10px', padding: '12px 14px',
                lineHeight: 1.6
              }}>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {roles.length} separate requests · {totalHeadcount} {totalHeadcount === 1 ? 'person' : 'people'}
                </strong>
                <br />
                Each role gets its own request and reference, with its own candidates, progress and hiring
                count. Your shared brief and company details are carried across all of them.
              </div>
            )}

            {roles.map((role, index) => (
              <div
                key={role.id || index}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '16px',
                  padding: roles.length > 1 ? '18px' : '0',
                  borderRadius: roles.length > 1 ? '14px' : '0',
                  border: roles.length > 1 ? '1px solid var(--border-glass, #E2E8F0)' : 'none',
                  background: roles.length > 1 ? 'var(--bg-secondary, #FFFFFF)' : 'transparent'
                }}
              >
                {roles.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                      ROLE {index + 1}{role.title ? ` · ${role.title}` : ''}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRole(index)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#B91C1C', fontSize: '12px', fontWeight: 700, padding: '4px 6px'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Role Title <span style={{color:'red'}}>*</span></label>
                  <input
                    type="text" className="form-input" maxLength={100}
                    placeholder="e.g. Senior Backend Engineer"
                    value={role.title || ''}
                    onChange={e => updateRole(index, 'title', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Skills Required (comma separated) <span style={{color:'red'}}>*</span></label>
                  <input
                    type="text" className="form-input"
                    placeholder="e.g. TypeScript, Postgres, AWS"
                    value={(role.requiredSkills || []).join(', ')}
                    onChange={e => updateRole(index, 'requiredSkills', e.target.value.split(',').map((s: string) => s.trim()))}
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Seniority Level <span style={{color:'red'}}>*</span></label>
                    <select
                      className="form-select"
                      value={role.seniorityLevel || ''}
                      onChange={e => updateRole(index, 'seniorityLevel', e.target.value)}
                    >
                      <option value="">Select...</option>
                      <option value="Junior (1-3 years)">Junior (1-3 years)</option>
                      <option value="Mid-level (3-6 years)">Mid-level (3-6 years)</option>
                      <option value="Senior (6-10 years)">Senior (6-10 years)</option>
                      <option value="Lead (8-15 years)">Lead (8-15 years)</option>
                      <option value="Executive (12+ years)">Executive (12+ years)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">
                      How many of this role <span style={{color:'red'}}>*</span>
                    </label>
                    <input
                      type="number" min={1} max={MAX_COUNT_PER_ROLE} className="form-input"
                      value={role.count ?? 1}
                      onChange={e => {
                        // An empty field gives NaN, which used to go into the
                        // payload and come back as null.
                        const n = parseInt(e.target.value, 10);
                        updateRole(index, 'count', Number.isFinite(n) && n > 0 ? n : 1);
                      }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">What will they be doing? <span style={{color:'red'}}>*</span></label>
                  <textarea
                    className="form-input" style={{ minHeight: '80px' }}
                    placeholder="What this person will own, and what a good first six months looks like."
                    value={role.description || ''}
                    onChange={e => updateRole(index, 'description', e.target.value)}
                  />
                </div>
              </div>
            ))}

            {/* Share the brief once, then file and track each role separately. */}
            <button
              type="button"
              onClick={addRole}
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: '1px dashed var(--border-glass, #CBD5E1)',
                borderRadius: '10px',
                padding: '10px 16px',
                color: 'var(--kongila-blue, #2563EB)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              ＋ Add another role
            </button>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-6px' }}>
              Add each role here — the budget, timezones and timing you give next apply to all of them.
              We will create one independently tracked request per role.
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
            {/* "Custom Hours" was a free-text box that only appeared when
                coverageType === 'Custom', and the option's stored value is
                'Custom (Specify your own hours)', so the condition was never
                true and the box never appeared. The hours now go in the team
                description, which is read. */}
            <div className="form-group">
              <label className="form-label">
                {isManaged ? 'Service Description & Outcomes' : 'Team Description'} <span style={{color:'red'}}>*</span>
                <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '2px'}}>Describe the team's goals, existing structure, and what this specific role will contribute.</div>
              </label>
              <textarea className="form-input" style={{ minHeight: '80px' }} value={formData.teamDescription || ''} onChange={e => updateForm('teamDescription', e.target.value)} />
            </div>
            
            {/* One question instead of two.
                Managed Workforce was asked for a "Supervision Level" of High,
                Standard or Light — which says nothing about who actually
                manages the person — and Outsource was asked for a "Reporting
                Structure", which does. They were never asked together, so
                this is not a duplicate being removed but two half-questions
                becoming one, stored in supervisionLevel on both paths. */}
            <div className="form-group">
              <label className="form-label">
                Who manages them day to day? <span style={{color:'red'}}>*</span>
                <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '2px'}}>
                  This decides how we set the engagement up, and who you go to when something needs changing.
                </div>
              </label>
              <select className="form-select" value={formData.supervisionLevel || ''} onChange={e => updateForm('supervisionLevel', e.target.value)}>
                <option value="">Select...</option>
                <option value="Client direct (they report to your team)">Client direct — they report to your team</option>
                <option value="Kongila supervisor (we manage their day-to-day)">Kongila supervisor — we manage their day to day</option>
                <option value="Hybrid (shared supervision)">Hybrid — shared supervision</option>
              </select>
            </div>
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
              {/* "Estimated Scope" asked Small / Medium / Large / Enterprise
                  about a project whose budget range and deadline are both
                  asked for a moment later. It was a vaguer restatement of two
                  precise answers, and nothing read it. */}
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
        {/* Stored as commitmentLevel, which is the field the rest of the
            product reads. It was collected as engagementType and mapped on
            submit, with the two sets of values differing by a hyphen and a
            capital — 'Full-time' here against 'Full-Time' everywhere else —
            so anything comparing them directly never matched. */}
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Full-time or part-time? <span style={{color:'red'}}>*</span></label>
          <select className="form-select" value={formData.commitmentLevel || ''} onChange={e => updateForm('commitmentLevel', e.target.value)}>
            <option value="">Select...</option>
            <option value="Full-Time">Full-time</option>
            <option value="Part-Time">Part-time</option>
            <option value="Either">Either — whichever suits the right person</option>
          </select>
        </div>
        {(formData.commitmentLevel === 'Part-Time' || formData.commitmentLevel === 'Either') && (
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Hours a week</label>
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
        {/* Free text before, so a client typed "EST, GMT" and nothing could
            line those up against a candidate's zone. Same shared list the
            candidate picks from, and more than one may be chosen. */}
        <label className="form-label">Preferred Timezones</label>
        <select
          className="form-select"
          multiple
          size={8}
          value={formData.preferredTimezones || []}
          onChange={e => updateForm(
            'preferredTimezones',
            Array.from(e.target.selectedOptions).map(o => o.value)
          )}
        >
          {TIMEZONE_OPTIONS.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
          Hold Ctrl (Cmd on a Mac) to choose more than one. Leave empty if any timezone works.
        </div>
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
      {/* "Role Criticality" asked how urgent this is, directly beneath a
          question asking how urgent this is. Its own help text — "how urgently
          does this role impact your core business operations?" — is the
          urgency question again in other words. Urgency is the one the board
          reads and sorts on; this was collected and never looked at. */}
      <div className="form-group">
        <label className="form-label">Anything else your team should know</label>
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
            <label className="form-label">Full Name <span style={{color:'red'}}>*</span></label>
            <input type="text" className="form-input" value={authData.fullName} onChange={e => setAuthData({...authData, fullName: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Company Name <span style={{color:'red'}}>*</span></label>
            <input type="text" className="form-input" maxLength={200} value={authData.companyName} onChange={e => setAuthData({...authData, companyName: e.target.value})} placeholder="The company this account is for" />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              The account is created for this company. You become its primary contact and administrator, and can invite colleagues once you are in.
            </div>
          </div>
          <div className="form-group">
            {/* Called "Job Title" here, which read as the role being hired
                for rather than the signer's own role. The field name and the
                column it lands in (client_profiles.position) are unchanged. */}
            <label className="form-label">Position Held <span style={{color:'red'}}>*</span></label>
            <input type="text" className="form-input" value={authData.jobTitle} onChange={e => setAuthData({...authData, jobTitle: e.target.value})} placeholder="e.g. Head of Operations" />
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

  // ── Confirmation ──────────────────────────────────────────────────────────
  //
  // Shown once the request is filed. It states the three facts the client had
  // no way of knowing before: that their organisation exists, what it is
  // called, and that they are its primary contact and administrator.
  if (confirmation) {
    const row = (label: string, value: string) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '10px 0', borderBottom: '1px solid var(--border-glass)' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
      </div>
    );

    return (
      <div style={{ padding: '24px', boxSizing: 'border-box', width: '100%' }}>
        <GlassCard className="intake-card" style={{ maxWidth: '650px', width: '100%', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '56px', lineHeight: 1, color: 'var(--accent-green)' }}>✓</div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '12px 0 6px 0' }}>
              {confirmation.accountCreated ? 'Your company account is set up' : 'Your request is in'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              {(confirmation.requests || []).length > 1
                ? `We have filed ${confirmation.requests.length} requests, one for each role you added`
                  + (confirmation.accountCreated ? ', and created your company account' : '')
                  + '. Kongila reviews new requests within one business day.'
                : confirmation.accountCreated
                  ? 'We have created the account and filed your first request. Kongila reviews new requests within one business day.'
                  : 'Kongila reviews new requests within one business day.'}
            </p>
          </div>

          <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '4px 18px 14px 18px', marginBottom: '20px' }}>
            {confirmation.organizationName && row('Organisation', confirmation.organizationName)}
            {confirmation.accountCreated && confirmation.isPrimaryContact && (
              row('Your role', `Primary contact and administrator${confirmation.position ? ` (${confirmation.position})` : ''}`)
            )}
            {confirmation.accountCreated && confirmation.isPrimaryContact === false && (
              row('Your role', confirmation.position || 'Team member')
            )}
            {confirmation.permissionLevel && row('Access level', confirmation.permissionLevel)}
            {confirmation.contactEmail && row('Account email', confirmation.contactEmail)}
            {/* One reference per role, because one brief with three roles is
                three requests. Showing a single reference for three roles
                left two of them with no reference the client could quote. */}
            {(confirmation.requests || []).length <= 1
              ? row('Request reference', confirmation.reference)
              : (
                <div style={{ padding: '12px 0', borderTop: '1px solid var(--border-glass, #E2E8F0)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {confirmation.requests.length} requests, one for each role
                  </div>
                  {confirmation.requests.map((r: any) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', gap: '12px',
                        padding: '7px 0', fontSize: '13px', flexWrap: 'wrap'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</span>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>
                        {r.referenceNumber}
                      </span>
                    </div>
                  ))}
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                    Each one is sourced and tracked on its own, so they can move at
                    different speeds. You will see all of them under My Requests.
                  </div>
                </div>
              )}
          </div>

          {confirmation.accountCreated && confirmation.isPrimaryContact && (
            <div style={{ background: 'rgba(0, 71, 204, 0.06)', border: '1px solid rgba(0, 71, 204, 0.18)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                The account belongs to {confirmation.organizationName || 'your company'}, not to you personally.
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                As primary contact you can edit the company details, invite colleagues and set what each of them can see, all from My Company in your portal.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Every request goes back, so the portal lists all of them
                rather than only the first. */}
            <NeonButton onClick={() => onComplete(confirmation.requests || [confirmation.request])}>
              Go to my portal
            </NeonButton>
          </div>
        </GlassCard>
      </div>
    );
  }

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
