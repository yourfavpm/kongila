import { apiFetch } from '../lib/apiFetch';
import { createAccountWithEmailOtp, requestEmailOtp } from '../lib/emailOtpClient';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GlassCard, NeonButton } from '@kongila/ui';
import { KongilaWordmark } from './marketing/SiteChrome';
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
  initialServiceType?: ServiceType;
  /**
   * Every request the brief produced. A brief with three roles files three
   * requests, so this is a list; a single-role brief sends a list of one.
   */
  onComplete: (requests: ServiceRequest[]) => void;
  onCancel?: () => void;
}

const INTAKE_SERVICES = [
  {
    id: 'Hire Talent', title: 'Hire Talent', model: 'You employ and manage directly',
    desc: 'Find and screen professionals for your organisation to employ and manage directly.'
  },
  {
    id: 'Outsource Talent', title: 'Outsource Talent', model: 'You direct the day-to-day work',
    desc: 'Engage dedicated remote team members while Kongila supports the agreed outsourcing arrangements.'
  },
  {
    id: 'Managed Workforce', title: 'Managed Workforce', model: 'Kongila manages the workforce',
    desc: 'Kongila provides, supervises and manages the workforce according to your agreed engagement.'
  },
  {
    id: 'Project Execution', title: 'Project Execution', model: 'Kongila manages defined delivery',
    desc: 'Engage Kongila to staff and manage the delivery of a specific project or defined deliverable.'
  }
];

function findIntakeService(serviceType: unknown) {
  const aliases: Record<string, string> = {
    placement: 'Hire Talent', outsourcing: 'Outsource Talent',
    managed_workforce: 'Managed Workforce', project: 'Project Execution'
  };
  const normalized = typeof serviceType === 'string' ? (aliases[serviceType] || serviceType) : '';
  return INTAKE_SERVICES.find(item => item.id === normalized);
}

function getIntakeStepTitle(step: number, accountMode: string) {
  if (step === 1) return 'Choose the right engagement.';
  if (step === 2) return 'Tell us what your work needs.';
  if (step === 3) return 'Shape the engagement.';
  if (step === 4) return 'Set a working budget.';
  if (step === 5) return 'Add timing and context.';
  return accountMode === 'signup' ? 'Establish your client account.' : 'Sign in to send your request.';
}

function getIntakeSupport(step: number, serviceId: string | undefined, formData: any, authData: any) {
  if (step === 1) return {
    kicker: 'A considered first step',
    title: 'The right structure starts with your goal.',
    description: 'Choose how you want Kongila to contribute. Your selection shapes the questions and details we ask for next.'
  };
  if (step === 2) {
    const byService: Record<string, { title: string; description: string }> = {
      'Hire Talent': { title: 'Define the people you need.', description: 'Add one or more roles. Each role can be tracked as its own request, while shared details are collected once.' },
      'Outsource Talent': { title: 'Describe the team arrangement.', description: 'Share the team size and coverage model so we can understand how the professionals will fit into your operation.' },
      'Managed Workforce': { title: 'Set the workforce scope.', description: 'Outline the size and coverage you need for Kongila to manage the engagement.' },
      'Project Execution': { title: 'Make the deliverable clear.', description: 'A project name, description and target date help frame the work and expected delivery.' }
    };
    const specific = serviceId ? byService[serviceId] : undefined;
    return { kicker: 'The engagement brief', title: specific?.title || 'Describe the work ahead.', description: specific?.description || 'Share the essential requirements for this service.' };
  }
  if (step === 3) return {
    kicker: 'Working arrangement',
    title: 'A little more context helps us plan.',
    description: 'Set the commitment, duration, start date and preferred time zones that fit your organisation.'
  };
  if (step === 4) return {
    kicker: 'Budget context',
    title: 'Start with a useful range.',
    description: 'A budget range helps frame the conversation. If you are still exploring, choose “Not Sure” and discuss it with the team.'
  };
  if (step === 5) return {
    kicker: 'Timing and next steps',
    title: 'Help us understand your timing.',
    description: 'Choose the urgency that reflects your plans and add any other context that would help your team review the request.'
  };
  return {
    kicker: 'Your Kongila relationship',
    title: authData.mode === 'signup' ? 'One step closer to your workforce needs.' : 'Your request stays with your account.',
    description: authData.mode === 'signup'
      ? 'Create a company account to complete this service request. Your organisation becomes the account holder, with you as its primary contact.'
      : 'Sign in with your existing client account to associate this request with your organisation.',
  };
}

function getRequestSummary(serviceId: string, formData: any, roles: any[]) {
  if (serviceId === 'Hire Talent') {
    const titles = roles.map(role => String(role.title || '').trim()).filter(Boolean);
    if (!titles.length) return 'Roles in progress';
    return titles.length > 1 ? `${titles[0]} + ${titles.length - 1} more` : titles[0];
  }
  if (serviceId === 'Outsource Talent' || serviceId === 'Managed Workforce') {
    const detail = String(formData.teamDescription || '').trim();
    const conciseDetail = detail.length > 72 ? `${detail.slice(0, 69)}…` : detail;
    return [formData.teamSize ? `${formData.teamSize} people` : '', formData.coverageType, conciseDetail]
      .filter(Boolean).join(' · ') || 'Team details in progress';
  }
  if (serviceId === 'Project Execution') return formData.projectName || 'Project details in progress';
  return 'Details in progress';
}

function IntakeTopBar({ onCancel }: { onCancel?: () => void }) {
  return (
    <header className="intake-topbar">
      <Link href="/" className="intake-topbar-logo" aria-label="Kongila home"><KongilaWordmark height={30} /></Link>
      <div className="intake-topbar-title"><span className="intake-topbar-mark" aria-hidden="true">K</span><span>Client Service Request</span></div>
      <div className="intake-topbar-actions">
        <span className="intake-secure-label"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="8" width="12" height="9" rx="2"/><path d="M6.5 8V6a3.5 3.5 0 0 1 7 0v2"/></svg> Private intake</span>
        {onCancel ? <button type="button" onClick={onCancel}>Exit</button> : <Link href="/">Exit</Link>}
      </div>
    </header>
  );
}

function ServiceGlyph({ service }: { service: string }) {
  if (service === 'Hire Talent') return <svg viewBox="0 0 32 32" fill="none"><circle cx="13" cy="11" r="5"/><path d="M4 27c.7-5.2 3.7-8 9-8 3 0 5.2 1 6.7 2.8M23 11v10M18 16h10"/></svg>;
  if (service === 'Outsource Talent') return <svg viewBox="0 0 32 32" fill="none"><circle cx="8" cy="10" r="3"/><circle cx="24" cy="10" r="3"/><circle cx="16" cy="23" r="3"/><path d="m10 12 4 8m8-8-4 8M11 10h10"/></svg>;
  if (service === 'Managed Workforce') return <svg viewBox="0 0 32 32" fill="none"><path d="M16 4 26 8v7c0 6-4 10-10 13C10 25 6 21 6 15V8l10-4Z"/><path d="m11.5 16 3 3 6-7"/></svg>;
  return <svg viewBox="0 0 32 32" fill="none"><path d="M7 6h18v20H7zM11 11h10M11 16h6"/><path d="m19 22 2 2 4-5"/></svg>;
}

function IntakeIllustration({ service, step }: { service?: string; step: number }) {
  const accent = service === 'Project Execution' ? '#b77d37' : service === 'Managed Workforce' ? '#427766' : '#1764a8';
  const labels = service === 'Hire Talent'
    ? ['Role brief', 'Shortlist', 'Your decision']
    : service === 'Outsource Talent'
      ? ['Team', 'Employment', 'Daily direction']
      : service === 'Managed Workforce'
        ? ['Workforce', 'Operations', 'Oversight']
        : service === 'Project Execution'
          ? ['Scope', 'Milestones', 'Handover']
          : ['Talent', 'Employment', 'Operations'];
  return (
    <svg viewBox="0 0 340 214" fill="none" role="img" aria-label="Illustration of a connected workforce request">
      <path d="M45 107h250" stroke="#cad5d8" strokeWidth="2" strokeDasharray="4 6"/>
      {[62,170,278].map((x, i) => <g key={x}>
        <circle cx={x} cy="107" r="33" fill={i === 1 ? '#fff' : '#f4f6f3'} stroke={i === 1 ? accent : '#d7e0df'} strokeWidth={i === 1 ? 2 : 1}/>
        {i === 0 && <g stroke={accent} strokeWidth="2" strokeLinecap="round"><circle cx={x} cy="98" r="7"/><path d={`M${x-13} 121c1-8 5-12 13-12s12 4 13 12`}/></g>}
        {i === 1 && <g stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={`M${x-10} 95h12l8 8v17h-20z`}/><path d={`M${x+2} 95v8h8M${x-5} 110h9M${x-5} 115h9`}/></g>}
        {i === 2 && <g stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={`m${x-11} 108 8 8 15-17`}/><circle cx={x} cy="107" r="18"/></g>}
        <text x={x} y="163" textAnchor="middle" fill="#304958" fontSize="10" fontWeight="600">{labels[i]}</text>
      </g>)}
      <rect x="114" y="14" width="112" height="32" rx="5" fill="#fff" stroke="#dbe2df"/>
      <circle cx="130" cy="30" r="5" fill={accent}/><path d="M142 26h68M142 34h48" stroke="#b8c5c6" strokeWidth="2" strokeLinecap="round"/>
      <rect x="126" y="184" width="88" height="20" rx="10" fill="#e8efec"/><circle cx="139" cy="194" r="3" fill={accent}/><path d="M148 194h52" stroke="#94a9a5" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="48" cy="54" r="3" fill="#c78d43"/><circle cx="287" cy="52" r="4" fill={accent} opacity=".7"/><circle cx="292" cy="159" r="3" fill="#c78d43"/>
      {step >= 2 && <path d="M62 107h108" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 6"><animate attributeName="stroke-dashoffset" values="20;0" dur="1.8s" repeatCount="indefinite"/></path>}
    </svg>
  );
}

export default function SmartIntakeForm({ currentUser, initialServiceType, onComplete, onCancel }: SmartIntakeFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once the request is filed. While it holds a value the wizard is
  // replaced by the confirmation panel, so nobody can resubmit by pressing
  // Back and Submit again.
  const [confirmation, setConfirmation] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');
  const [signupOtpRequested, setSignupOtpRequested] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [phoneCodeSearch, setPhoneCodeSearch] = useState('');
  const [showPhoneCodeDropdown, setShowPhoneCodeDropdown] = useState(false);

  const [formData, setFormData] = useState<Partial<ServiceRequest>>({
    serviceType: (initialServiceType || '') as ServiceType,
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

  const totalSteps = currentUser ? 5 : 6;
  const progressLabels = currentUser
    ? ['Service', 'Requirement', 'Engagement', 'Budget', 'Request details']
    : ['Service', 'Requirement', 'Engagement', 'Budget', 'Request details', 'Account'];
  const selectedService = findIntakeService(formData.serviceType);
  const supportContent = getIntakeSupport(step, selectedService?.id, formData, authData);

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
          if (!authData.businessEmail.trim()) throw new Error('Enter your business email address.');
          if (authData.password.length < 8) throw new Error('Use a password with at least 8 characters.');
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

          if (!signupOtpRequested) {
            const result = await requestEmailOtp(authData.businessEmail, 'signup');
            setSignupOtpRequested(true);
            setOtpMessage(result.message || 'If eligible, a six-digit code is on its way.');
            setIsSubmitting(false);
            return;
          }

          const created = await createAccountWithEmailOtp({
            email: authData.businessEmail,
            code: signupOtp,
            password: authData.password,
            role: 'client',
            name: authData.fullName,
            companyName: authData.companyName
          });
          const { data: authRes, error: signInError } = await supabase.auth.signInWithPassword({
            email: authData.businessEmail,
            password: authData.password
          });
          if (signInError || !authRes.user) {
            setSignupOtpRequested(false);
            throw new Error('Your email is verified and account created. Sign in to continue.');
          }

          finalUserId = created.userId || authRes.user.id;
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
    <div className="intake-step-content">
      <div className="intake-section-heading">
        <p className="intake-kicker">START WITH THE ENGAGEMENT</p>
        <h2>What are you looking to accomplish?</h2>
        <p>Choose the structure that best fits how you want Kongila to support your workforce.</p>
      </div>
      <div className="intake-service-grid" role="radiogroup" aria-label="Choose a service type">
        {INTAKE_SERVICES.map(item => {
          const selected = selectedService?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`intake-service-option ${selected ? 'is-selected' : ''}`}
              onClick={() => { setErrorMsg(''); updateForm('serviceType', item.id as ServiceType); }}
            >
              <span className="intake-service-icon"><ServiceGlyph service={item.id} /></span>
              <span className="intake-service-copy">
                <strong>{item.title}</strong>
                <span className="intake-service-description">{item.desc}</span>
                <span className="intake-service-model">{item.model}</span>
              </span>
              <span className="intake-service-choice" aria-hidden="true">{selected ? '✓' : '+'}</span>
            </button>
          );
        })}
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

        <div className="intake-form-row" style={{ display: 'flex', gap: '16px' }}>
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
            <div className="intake-form-row" style={{ display: 'flex', gap: '16px' }}>
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
            <div className="intake-form-row" style={{ display: 'flex', gap: '16px' }}>
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
      <div className="intake-form-row" style={{ display: 'flex', gap: '16px' }}>
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
      <div className="intake-form-row" style={{ display: 'flex', gap: '16px' }}>
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
        {authData.mode === 'signup' ? 'Establish your client account' : 'Sign in to complete your request'}
      </h3>
      
      <div className="intake-account-switch">
        {authData.mode === 'signup' ? (
          <><span>Already have a Kongila account?</span><button type="button" onClick={() => { setAuthData({...authData, mode: 'login'}); setSignupOtpRequested(false); setSignupOtp(''); setOtpMessage(''); }}>Sign in</button></>
        ) : (
          <><span>New to Kongila?</span><button type="button" onClick={() => { setAuthData({...authData, mode: 'signup'}); setSignupOtpRequested(false); setSignupOtp(''); setOtpMessage(''); }}>Create a client account</button></>
        )}
      </div>

      {authData.mode === 'signup' && (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="intake-full-name">Full Name <span style={{color:'red'}}>*</span></label>
            <input id="intake-full-name" type="text" autoComplete="name" className="form-input" value={authData.fullName} onChange={e => setAuthData({...authData, fullName: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="intake-company-name">Company Name <span style={{color:'red'}}>*</span></label>
            <input id="intake-company-name" type="text" autoComplete="organization" className="form-input" maxLength={200} value={authData.companyName} onChange={e => setAuthData({...authData, companyName: e.target.value})} placeholder="The company this account is for" />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              The account is created for this company. You become its primary contact and administrator, and can invite colleagues once you are in.
            </div>
          </div>
          <div className="form-group">
            {/* Called "Job Title" here, which read as the role being hired
                for rather than the signer's own role. The field name and the
                column it lands in (client_profiles.position) are unchanged. */}
            <label className="form-label" htmlFor="intake-position">Position Held <span style={{color:'red'}}>*</span></label>
            <input id="intake-position" type="text" autoComplete="organization-title" className="form-input" value={authData.jobTitle} onChange={e => setAuthData({...authData, jobTitle: e.target.value})} placeholder="e.g. Head of Operations" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="intake-phone">Phone</label>
            <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
              {/* Phone code searchable dropdown */}
              <button
                type="button"
                className="form-input" 
                style={{ width: '120px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}
                onClick={() => { setShowPhoneCodeDropdown(v => !v); setPhoneCodeSearch(''); }}
                aria-label="Choose phone country code"
                aria-expanded={showPhoneCodeDropdown}
                aria-controls="intake-phone-country-options"
              >
                <span style={{ fontWeight: 600 }}>{authData.phoneCode || '+?'}</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>▼</span>
              </button>
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
                  <div id="intake-phone-country-options" role="listbox" aria-label="Phone country codes" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {COUNTRIES_AND_CODES
                      .filter(c => c.name.toLowerCase().includes(phoneCodeSearch.toLowerCase()) || c.code.includes(phoneCodeSearch))
                      .map(c => (
                        <button
                          type="button"
                          key={c.name + c.code}
                          role="option"
                          aria-selected={authData.phoneCode === c.code}
                          onClick={() => { setAuthData({ ...authData, phoneCode: c.code }); setShowPhoneCodeDropdown(false); }}
                          style={{ width: '100%', padding: '10px 14px', border: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#21394a', background: 'white', textAlign: 'left', borderBottom: '1px solid var(--border-glass, #e2e8f0)' }}
                        >
                          <span>{c.name}</span>
                          <span style={{ fontWeight: 700, color: 'var(--accent-cyan, #0ea5e9)' }}>{c.code}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
              
              <input id="intake-phone" type="tel" autoComplete="tel-national" style={{ flex: 1 }} className="form-input" value={authData.phone} onChange={e => setAuthData({...authData, phone: e.target.value})} />
            </div>
          </div>
        </>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="intake-business-email">Business Email</label>
        <input
          id="intake-business-email"
          type="email"
          autoComplete="email"
          className="form-input"
          value={authData.businessEmail}
          onChange={e => {
            setAuthData({...authData, businessEmail: e.target.value});
            setSignupOtpRequested(false);
            setSignupOtp('');
            setOtpMessage('');
          }}
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="intake-client-password">Password</label>
        <div style={{ position: 'relative' }}>
          <input 
            id="intake-client-password"
            type={showPassword ? "text" : "password"} 
            autoComplete={authData.mode === 'signup' ? 'new-password' : 'current-password'}
            className="form-input" 
            style={{ width: '100%', paddingRight: '40px' }}
            value={authData.password} 
            onChange={e => setAuthData({...authData, password: e.target.value})} 
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
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
        {authData.mode === 'signup' && <div className="intake-password-hint">Use at least 8 characters for your password.</div>}
      </div>

      {authData.mode === 'signup' && signupOtpRequested && (
        <div className="form-group">
          <label className="form-label" htmlFor="intake-email-otp">Six-digit email code</label>
          <input
            id="intake-email-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="form-input"
            value={signupOtp}
            onChange={e => setSignupOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
          />
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {otpMessage || `Enter the code sent to ${authData.businessEmail}. It expires in 10 minutes.`}
            {' '}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={async () => {
                try {
                  setIsSubmitting(true);
                  const result = await requestEmailOtp(authData.businessEmail, 'signup');
                  setOtpMessage(result.message || 'If eligible, a new code is on its way.');
                } catch (error: any) {
                  setErrorMsg(error?.message || 'Could not resend the code.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              style={{ border: 0, background: 'none', color: 'var(--kongila-blue, #2563EB)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Resend code
            </button>
          </div>
        </div>
      )}

      {authData.mode === 'signup' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '8px' }}>
          <input type="checkbox" id="tosAccepted" style={{ marginTop: '4px' }} checked={authData.tosAccepted} onChange={e => setAuthData({...authData, tosAccepted: e.target.checked})} />
          <label htmlFor="tosAccepted" style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.4' }}>
            I agree to the Terms of Service and <Link href="/legal/privacy">Privacy Policy</Link>. I understand that submitting this form will create a Kongila account.
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
      <div className="client-intake-shell client-intake-confirmed">
        <IntakeTopBar onCancel={onCancel} />
        <div className="intake-confirmation-wrap">
        <GlassCard className="intake-card intake-confirmation-card" style={{ maxWidth: '760px', width: '100%', margin: '0 auto' }}>
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
      </div>
    );
  }

  return (
    <div className="client-intake-shell">
      <IntakeTopBar onCancel={onCancel} />
      <div className="intake-progress-shell" aria-label={`Step ${step} of ${totalSteps}`}>
        <div className="intake-progress-meta"><span>CLIENT SERVICE REQUEST</span><strong>Step {step} <span>of {totalSteps}</span></strong></div>
        <div className="intake-progress-track" role="list" aria-label="Request progress">
          {progressLabels.map((label, index) => {
            const number = index + 1;
            const complete = number < step;
            const active = number === step;
            return (
              <button
                type="button"
                key={label}
                role="listitem"
                className={`intake-progress-step ${complete ? 'is-complete' : ''} ${active ? 'is-active' : ''}`}
                aria-current={active ? 'step' : undefined}
                aria-label={`${label}${complete ? ', completed. Go back to edit.' : active ? ', current step.' : ', upcoming.'}`}
                disabled={!complete}
                onClick={() => { setErrorMsg(''); setStep(number); }}
              >
                <span className="intake-progress-number">{complete ? '✓' : `0${number}`}</span>
                <span className="intake-progress-label">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="intake-main-layout">
        <section className="intake-main-column" aria-label="Request details">
          <GlassCard className={`intake-card intake-workspace intake-workspace-step-${step}`} style={{ maxWidth: 'none', width: '100%', margin: 0, transition: 'none' }}>
            <div className="intake-current-heading">
              <span className="intake-current-number">{`0${step}`}</span>
              <div><p>{selectedService?.title || 'KONGILA WORKFORCE SOLUTIONS'}</p><h1>{getIntakeStepTitle(step, authData.mode)}</h1></div>
            </div>

            {errorMsg && <div className="intake-error" role="alert"><span aria-hidden="true">!</span>{errorMsg}</div>}

            <div className="intake-step-transition" key={`intake-step-${step}`}>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
              {step === 5 && renderStep5()}
              {step === 6 && !currentUser && renderStep6()}
            </div>

            <div className="intake-navigation">
              {step > 1 ? (
                <button className="intake-back-button" type="button" onClick={() => { setErrorMsg(''); setStep(step - 1); }}><span aria-hidden="true">←</span> Back</button>
              ) : (
                <button className="intake-back-button" type="button" onClick={() => onCancel && onCancel()}><span aria-hidden="true">←</span> Exit request</button>
              )}

              {step < totalSteps ? (
                <NeonButton onClick={handleNext}>Continue <span aria-hidden="true">→</span></NeonButton>
              ) : (
                <NeonButton onClick={submitRequest} disabled={isSubmitting || (authData.mode === 'signup' && !authData.tosAccepted)}>
                  {isSubmitting
                    ? 'Submitting...'
                    : authData.mode === 'signup' && signupOtpRequested
                      ? 'Verify Email & Submit Request'
                      : authData.mode === 'signup'
                        ? 'Send Verification Code'
                        : 'Sign In & Submit Request'}
                </NeonButton>
              )}
            </div>
          </GlassCard>
        </section>

        <aside className="intake-support-column" aria-live="polite">
          <div className="intake-support-panel">
            <div className="intake-support-visual"><IntakeIllustration service={selectedService?.id} step={step} /></div>
            <p className="intake-support-kicker">{supportContent.kicker}</p>
            <h2>{supportContent.title}</h2>
            <p className="intake-support-description">{supportContent.description}</p>
            {(selectedService || step > 1) && (
              <div className="intake-summary-block">
                <span className="intake-summary-label">YOUR REQUEST SO FAR</span>
                {selectedService && <div className="intake-summary-line"><span>Engagement</span><strong>{selectedService.title}</strong></div>}
                {step >= 2 && selectedService && (
                  <div className="intake-summary-line"><span>Request type</span><strong>{getRequestSummary(selectedService.id, formData, roles)}</strong></div>
                )}
                {step >= 6 && authData.companyName && <div className="intake-summary-line"><span>Organisation</span><strong>{authData.companyName}</strong></div>}
              </div>
            )}
              <div className="intake-support-note"><span aria-hidden="true">✓</span><p>{currentUser
                ? 'This brief will be linked to your existing Kongila client account when you submit.'
                : 'After email verification, your client account and service request are completed together.'}</p></div>
          </div>
        </aside>
      </div>

      <footer className="intake-footer"><span>© {new Date().getFullYear()} Kongila</span><span>Thoughtful workforce solutions, built around your needs.</span><Link href="/">Return to kongila.com</Link></footer>
    </div>
  );
}
