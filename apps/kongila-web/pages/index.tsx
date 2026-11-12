import { apiFetch } from '../lib/apiFetch';
import { uploadFile } from '../lib/uploadFile';
import React, { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import Head from 'next/head';
import { GlassCard, Badge, NeonButton } from '@kongila/ui';
import { formatCurrency, formatDate, getGradeColor, viewerTimeZone, wallClockToUtc, TIMEZONE_OPTIONS } from '@kongila/utils';
import { generateNDATemplate, generateContractTemplate } from '@kongila/contracts';
import { 
  TalentProfile, ServiceRequest, Match, Contract, ServiceType, calculateTalentProfileCompletion, hasCoreTalentProfileChanges
} from '@kongila/shared-types';
import { coerceRequestStatus } from '@kongila/workflows';
import { supabase } from '../lib/supabaseClient';
import { COUNTRIES_AND_CODES, SUGGESTED_SKILLS, CURRENCIES, currencyForCountry } from '../lib/onboarding-constants';
import TalentDashboard from '../components/TalentDashboard';
import { MascotLoader } from '../components/brand/MascotFeedback';
import { SiteHeader, SiteFooter } from '../components/marketing/SiteChrome';
import HomePage from '../components/marketing/HomePage';
import ClientDashboard from '../components/ClientDashboard';
import EmailVerification from '../components/EmailVerification';
import SmartIntakeForm from '../components/SmartIntakeForm';

// Custom Reusable High-Fidelity SVG Brand Logo component
const KongilaLogo = ({ size = 32, showText = true, textColor = '#1A2340' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background Rounded Square in primary Kongila Blue */}
      <rect width="100" height="100" rx="24" fill="#0047CC" />
      {/* Left vertical block */}
      <rect x="25" y="25" width="12" height="50" rx="2.5" fill="white" />
      {/* Rotated 45-degree diamond center */}
      <path d="M47.5 50 L56.5 41 L65.5 50 L56.5 59 Z" fill="white" />
      {/* Top-right arm */}
      <path d="M57.5 39.5 L73 25 L73 34 L62 44 Z" fill="white" />
      {/* Bottom-right arm */}
      <path d="M62 56 L73 66 L73 75 L57.5 60.5 Z" fill="white" />
    </svg>
    {showText && (
      <span style={{
        fontSize: `${size * 0.58}px`,
        fontWeight: 800,
        color: textColor,
        fontFamily: 'var(--font-display)',
        letterSpacing: '-0.04em'
      }}>
        Kongila
      </span>
    )}
  </div>
);

const SECONDARY_SKILL_OPTIONS = [
  'Communication',
  'Empathy',
  'Active Listening',
  'Collaboration',
  'Teamwork',
  'Adaptability',
  'Problem Solving',
  'Critical Thinking',
  'Time Management',
  'Emotional Intelligence',
  'Conflict Resolution',
  'Stakeholder Management',
  'Presentation Skills',
  'Negotiation',
  'Customer Service',
  'Attention to Detail',
  'Leadership',
  'Accountability',
  'Resilience',
  'Creativity',
  'Initiative',
  'Organization',
  'Decision Making',
  'Coaching',
  'Mentoring',
  'Facilitation',
  'Work Ethic',
  'Self-Motivation',
  'Cross-Cultural Communication',
  'Relationship Building',
] as const;

const NOTICE_PERIOD_OPTIONS = [
  'Immediate Start',
  'Two Weeks Notice',
  'One Month Notice',
  'One Month Plus',
] as const;

/**
 * Marks a field the candidate cannot continue without.
 *
 * Every compulsory field in the wizard carries one. Before, nothing on the
 * form said which fields were compulsory: a candidate filled in what looked
 * reasonable, pressed Continue, and only then got a list of what was missing.
 */
const Required = () => (
  <span style={{ color: '#EF4444', fontWeight: 700 }} aria-hidden="true">
    {' *'}
    <span style={{ fontSize: '11px', fontWeight: 600, color: '#EF4444', marginLeft: '4px' }}>(required)</span>
  </span>
);

// Seniority levels with corresponding years-of-experience ranges.
const SENIORITY_LEVELS = [
  { label: 'Entry Level',  min: 0, max: 1 },
  { label: 'Associate',    min: 1, max: 3 },
  { label: 'Mid-level',    min: 3, max: 6 },
  { label: 'Senior',       min: 6, max: 10 },
  { label: 'Lead',         min: 8, max: 15 },
  { label: 'Expert',       min: 12, max: 99 },
] as const;

const getSeniorityRange = (level: string) =>
  SENIORITY_LEVELS.find(s => s.label === level) ?? null;

const isTalentProfileOnboardingComplete = (profileRow: any) => {
  if (!profileRow) return false;
  // Primary check: bio envelope with __kongila marker means onboarding was submitted
  if (profileRow.bio && typeof profileRow.bio === 'string') {
    try {
      const envelope = JSON.parse(profileRow.bio);
      // Any bio written by the onboarding wizard has __kongila: true — that's the signal
      if (envelope?.__kongila === true) return true;
    } catch (e) {
      // bio is not JSON — fall through to the structural check
    }
  }
  // Fallback: if the talent_profiles row has core fields populated, they completed onboarding
  // This handles accounts where the bio envelope wasn't written (e.g. older accounts)
  if (profileRow.full_name && profileRow.level && profileRow.country) {
    return true;
  }
  return false;
};

export default function KongilaWeb() {
  // DB States
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [rehireRequests, setRehireRequests] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // True once the first database load has come back, successfully or not.
  // Both dashboards used to render the instant the user was known, with
  // every list still empty, so a signed-in person's first sight of their
  // portal was an empty one that filled in a second or two later. The
  // landing page is deliberately not gated on this — it has nothing to wait
  // for and should appear at once.
  const [dataReady, setDataReady] = useState(false);

  // A loading gate must never be able to trap someone.
  //
  // dataReady flips in exactly one place: when the first load finishes. If
  // that request hangs — a cold function, a route that never answers — it
  // never flips, and the person sits on a loading screen for ever with no
  // way forward. That is what took the admin portal down: not a failure to
  // sign in, but a sign-in that succeeded into a screen that never resolved.
  //
  // The portal now gives up waiting and renders regardless. Empty lists that
  // fill in a moment later are a far smaller problem than a door that will
  // not open, and the data layer reports its own errors.
  useEffect(() => {
    if (dataReady) return;
    const giveUp = setTimeout(() => setDataReady(true), 8000);
    return () => clearTimeout(giveUp);
  }, [dataReady]);


  // Assessment state for talent-side
  const [assessments, setAssessments] = useState<any[]>([]);
  const [assessmentCategories, setAssessmentCategories] = useState<any[]>([]);
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([]);
  const [talentSkillAssessments, setTalentSkillAssessments] = useState<any[]>([]);
  const [skillAssessmentResults, setSkillAssessmentResults] = useState<any[]>([]);
  const [workSimulationTasks, setWorkSimulationTasks] = useState<any[]>([]);

  // Identity & Unified Auth Progressive States
  const [currentUser, setCurrentUser] = useState<any>(null); // { id, name, email, role, onboardingStatus, emailVerified, organizationId }
  const currentUserRef = useRef<any>(null);
  const [authView, setAuthView] = useState<'login' | 'signup' | 'verify' | 'onboarding' | null>(null);
  const [authRole, setAuthRole] = useState<'talent' | 'client'>('talent');
  
  // Auth Form Fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Talent Wizard Steps (1 to 5)
  const [talentWizardStep, setTalentWizardStep] = useState(1);
  const [wizardStepErrors, setWizardStepErrors] = useState<string[]>([]);
  const [talentOnboardingData, setTalentOnboardingData] = useState({
    fullName: '',
    phoneCode: '+1',
    phone: '',
    profilePhotoUrl: '',
    profilePhotoName: '',
    profilePhotoSize: 0,
    dateOfBirth: '',
    gender: '',
    nationality: '',
    country: '',
    city: '',
    timezone: '',
    primaryRole: '',
    primaryRoleCategory: '',
    seniorityLevel: '',
    bio: '',
    yearsExperience: '',
    skills: [] as string[],
    secondarySkills: '',
    skillLevels: {} as Record<string, 'Beginner' | 'Intermediate' | 'Expert'>,
    employmentPreference: '',
    preferredWorkHours: '',
    noticePeriod: '',
    availableStartDate: '',
    availability: '',
    salaryExpectationMin: '',
    salaryExpectationMax: '',
    hourlyMonthly: 'Monthly',
    currency: 'USD',
    // Set the moment the candidate picks a currency themselves, so the
    // country default in step 1 stops overwriting their choice.
    currencyTouched: false,
    cvName: '',
    cvUrl: '',
    cvSize: 0,
    certificationFiles: [] as Array<{ name: string; url: string; size: number; type: string }>,
    portfolioUrl: '',
    linkedInUrl: '',
    githubUrl: '',
    websiteUrl: '',
    certifications: ''
    // internetQuality, workSetup, devices and communicationTools were here,
    // collected by the Remote Readiness step. That step is gone: the four
    // answers were free text nobody vetted against and nothing matched on.
  });

  const [skillSearch, setSkillSearch] = useState('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [secondarySkillSearch, setSecondarySkillSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [phoneCodeSearch, setPhoneCodeSearch] = useState('');
  const [showPhoneCodeDropdown, setShowPhoneCodeDropdown] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const selectedSecondarySkills = String(talentOnboardingData.secondarySkills || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const toggleSecondarySkill = (skill: string) => {
    const exists = selectedSecondarySkills.includes(skill);
    const nextSkills = exists
      ? selectedSecondarySkills.filter(item => item !== skill)
      : [...selectedSecondarySkills, skill];
    setTalentOnboardingData(prev => ({
      ...prev,
      secondarySkills: nextSkills.slice(0, 10).join(', ')
    }));
  };

  // NOTE: Name pre-fill is now handled in restoreUserFromSession and handleSignUpSubmit
  // to ensure the correct user's name is always used. This effect is intentionally
  // left as a safety net only for edge cases where name is truly missing.
  useEffect(() => {
    if (authView === 'onboarding' && currentUser?.name && !talentOnboardingData.fullName) {
      // Only prefill if fullName is empty and we have a valid name (not just email)
      const name = currentUser.name;
      if (name && name !== currentUser.email) {
        setTalentOnboardingData(prev => ({
          ...prev,
          fullName: name,
        }));
      }
    }
  }, [authView, currentUser?.name, currentUser?.email, talentOnboardingData.fullName]);

  // Only redirect to onboarding when the talent has never completed it.
  // Once onboardingStatus is 'complete' we NEVER send them back — all profile
  // edits happen through the profile module inside the dashboard.
  useEffect(() => {
    if (currentUser?.role !== 'talent') return;
    if (currentUser?.onboardingStatus === 'complete') return;
    if (authView !== 'onboarding') {
      setAuthView('onboarding');
    }
  }, [currentUser?.role, currentUser?.onboardingStatus]); // intentionally omit authView

  // Client Smart Intake (Smart Intake FIRST flow)
  const [clientIntakeActive, setClientIntakeActive] = useState(false);
  const [clientIntakeStep, setClientIntakeStep] = useState(1);
  const [formData, setFormData] = useState({
    serviceType: '' as ServiceType,
    roleDescription: '',
    requiredSkills: '',
    duration: '',
    commitmentLevel: '',
    numberOfHires: 1,
    timezone: '',
    startDate: '',
    budget: '',
    priority: '' as 'Low' | 'Medium' | 'High'
  });

  // The Workload Optimization Sandbox state was here. The modal it drove was
  // unreachable: nothing ever called setShowAssessment(true). On submit it
  // announced a score of 92/100 and grade A+ after a 1.5 second timer, then
  // wrote vetting status Review and grade A into local state. Nothing was
  // sent to a server and nothing was scored, but the candidate was shown a
  // grade. Real assessments run through openAssessmentSession in
  // TalentDashboard and POST to /api/assessments/submit, which marks the
  // paper server side against the answer key.

  // Calendar Modal State
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedTalent, setSelectedTalent] = useState<TalentProfile | null>(null);
  const [meetingTime, setMeetingTime] = useState('14:00');
  const [meetingDate, setMeetingDate] = useState(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  // E-Sign Modal State
  const [showSignModal, setShowSignModal] = useState(false);
  const [activeNDA, setActiveNDA] = useState<string>('');
  const [signingContractId, setSigningContractId] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // File uploading simulator
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mockUploading, setMockUploading] = useState(false);

  // UI Active Console View (for fully onboarded/vetted users)
  const [activeTab, setActiveTab] = useState<'home' | 'talent' | 'client'>('home');
  const [clientSubTab, setClientSubTab] = useState<'intake' | 'requests' | 'matching'>('intake');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  // Custom Notifications & Banners
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerType, setBannerType] = useState<'success' | 'info' | 'error'>('success');

  // Navigation Dropdown States
  const [signInDropdownOpen, setSignInDropdownOpen] = useState(false);
  const [getStartedDropdownOpen, setGetStartedDropdownOpen] = useState(false);

  // Core Db States
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [clientProfiles, setClientProfiles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [requestActivityLogs, setRequestActivityLogs] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);

  const [activeMatch, setActiveMatch] = useState<any>(null);

  // Offers awaiting this candidate's answer. Fetched on its own rather than
  // through /api/db, which already reads around thirty tables per poll.
  const [talentOffers, setTalentOffers] = useState<any[]>([]);

  const loadTalentOffers = async () => {
    try {
      const res = await apiFetch('/api/offers/mine');
      if (!res.ok) return;
      const data = await res.json();
      setTalentOffers(data.offers || []);
    } catch (e) {
      console.warn('[offers] could not load offers', e);
    }
  };

  const handleRespondToOffer = async (offerId: string, decision: 'accept' | 'decline', reason?: string) => {
    const res = await apiFetch('/api/offers/respond', {
      method: 'POST',
      body: JSON.stringify({ offerId, decision, reason })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result?.ok) {
      triggerBanner(result?.error || 'Could not record your response.', 'error');
      return false;
    }
    if (result.warnings?.length) {
      triggerBanner(result.warnings.join(' '), 'info');
    } else {
      triggerBanner(decision === 'accept' ? 'Offer accepted. Your contract is being prepared.' : 'Offer declined.', 'success');
    }
    await loadTalentOffers();
    return true;
  };

  // Invite states
  const [inviteOrgId, setInviteOrgId] = useState<string | null>(null);
  // The company an invited colleague is joining, so the form can state it
  // rather than asking them to type a company name that provisioning ignores.
  const [inviteOrgName, setInviteOrgName] = useState<string>('');
  const [invitePermission, setInvitePermission] = useState<string | null>(null);
  const [inviteEmailLocked, setInviteEmailLocked] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  // Kept so provisioning can re-verify the signature server-side rather than
  // trusting the organisation and permission level held in client state.
  const [inviteTokenRaw, setInviteTokenRaw] = useState<string | null>(null);

  /**
   * A signup that exists in Supabase but has not been confirmed yet.
   *
   * With email confirmation on, signUp creates the account and returns no
   * session. Everything that follows — provisioning the public.users row,
   * the talent profile, the onboarding wizard — needs an authenticated
   * caller, so it is held here until the code has been entered.
   */
  const [pendingSignup, setPendingSignup] = useState<{
    role: 'talent' | 'client';
    name: string;
    email: string;
    companyName?: string;
    inviteToken?: string;
  } | null>(null);

  useEffect(() => {
    // The bridge from the public site into the portal.
    //
    // The marketing pages are real routes; the portal is this one page with
    // its view held in React state. Without this, /get-started and /join can
    // only dump someone on the homepage and hope they find the button again.
    // Each marketing entry point sets the state it means:
    //
    //   /?intake=1&model=direct-hire   open the service request, preselected
    //   /?view=signup&role=talent      open talent signup
    //   /?view=login                   open sign in
    //
    // Only values this page already understands are accepted, and the query
    // is stripped afterwards so a refresh does not reopen what the person
    // just closed.
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('invite')) return; // the invitation flow owns that case

    const view = params.get('view');
    const role = params.get('role');
    const wantsIntake = params.get('intake') === '1';
    let consumed = false;

    if (wantsIntake) {
      setClientIntakeActive(true);
      setClientIntakeStep(1);
      consumed = true;
    } else if (view === 'signup' || view === 'login') {
      setAuthView(view);
      if (role === 'talent' || role === 'client') setAuthRole(role);
      consumed = true;
    }

    if (consumed) {
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState(null, '', clean);
    }
  }, []);

  useEffect(() => {
    // Invitations arrive as one signed token. The organisation and permission
    // level used to be plain query parameters that signup trusted verbatim,
    // which let anyone join any organisation at Full Access by editing the URL.
    // They now come back from the server only after the signature checks out.
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');

    if (!token) {
      // Non-invite entry, e.g. a direct link to the signup view.
      const authV = params.get('authView');
      if (authV) {
        setAuthView(authV as any);
        const role = params.get('role');
        if (role) setAuthRole(role as any);
        window.history.replaceState({}, '', '/');
      }
      return;
    }

    // Clear the token from the address bar straight away so it does not end up
    // in browser history or a screenshot.
    window.history.replaceState({}, '', '/');

    (async () => {
      try {
        const res = await fetch('/api/company/verify-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();

        if (!res.ok || !data?.ok) {
          setInviteError(data?.error || 'This invitation link is not valid.');
          setAuthView('signup');
          return;
        }

        setAuthView('signup');
        setAuthRole('client' as any);
        setInviteTokenRaw(token);
        setEmailInput(data.email);
        setInviteEmailLocked(data.email);
        if (data.name) setNameInput(data.name);
        setInviteOrgId(data.orgId);
        setInviteOrgName(data.organizationName || '');
        setInvitePermission(data.permissionLevel);
      } catch (e) {
        setInviteError('Could not check this invitation. Try the link again.');
        setAuthView('signup');
      }
    })();
  }, []);

  // Load offers once a candidate is signed in, and again whenever the
  // poll refreshes their profile, so an offer sent while they are looking
  // at the page appears without a reload.
  useEffect(() => {
    if (currentUser?.role === 'talent') loadTalentOffers();
  }, [currentUser?.id, currentUser?.role]);

  // A client who reached the signup view without an invitation. Their account
  // is a company account and is created at the end of the intake form, so this
  // sends them there instead of through a form that builds a thinner
  // organisation. An invited colleague is joining a company that already
  // exists and keeps using the form.
  const clientNeedsIntake = authRole === 'client' && !inviteTokenRaw;

  // Trigger temporary floating notification
  const triggerBanner = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setBannerMessage(message);
    setBannerType(type);
    setTimeout(() => setBannerMessage(null), 5000);
  };

  // Surface a bad or expired invitation to the person holding the link.
  useEffect(() => {
    if (inviteError) triggerBanner(inviteError, 'error');
  }, [inviteError]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Sync with central filesystem DB
  const syncFromDb = async () => {
    // Safety timeout to prevent infinite loading if promises hang
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 30000);

    try {
      const resourceNames = [
        'organizations', 'clientProfiles', 'users', 'talents', 'clientRequests',
        'matches', 'notifications', 'rehireRequests', 'supportTickets', 'interviews',
        'documents', 'requestActivityLogs', 'assessments', 'assessmentCategories',
        'assessmentQuestions', 'talentSkillAssessments', 'skillAssessmentResults',
        'workSimulationTasks'
      ];
      // One request, not eighteen. Each /api/resources/<name> call ran a full
      // readDbAsync server side — every table read, the whole snapshot scoped
      // and signed — to return a single array. The batch route does that work
      // once for all of them.
      const resourceRes = await apiFetch(`/api/resources?names=${resourceNames.join(',')}`).catch(() => null);
      const resourceBody = resourceRes?.ok ? await resourceRes.json().catch(() => ({})) : {};
      const resourceData = Object.fromEntries(
        resourceNames.map(name => [
          name,
          Array.isArray(resourceBody?.data?.[name]) ? resourceBody.data[name] : []
        ])
      );
      const res = { ok: true, json: async () => resourceData } as Response;

      if (res && res.ok) {
        const dbData = await res.json();
        // These three used to be read straight from the tables with the
        // anon key, overriding the already-scoped resource API responses. Every
        // candidate and every client therefore received every
        // organization, every client profile and every row of `users`:
        // emails, roles and account status for the whole platform. The
        // scoped values were sitting right there as the fallback.
        setOrganizations(dbData.organizations || []);
        setClientProfiles(dbData.clientProfiles || []);
        setUsers(dbData.users || []);

        setTalents(dbData.talents || []);
        
        const activeUser = currentUserRef.current;
        // Client requests are read through the authenticated resource API.
        // The browser must not query the table directly.
        const requestResponse = activeUser?.role === 'client'
          ? await apiFetch('/api/requests')
          : null;
        const requestBody = requestResponse?.ok
          ? await requestResponse.json().catch(() => ({}))
          : {};
        const mappedRemoteRequests = (requestBody.requests || []).map((request: any) => ({
          ...request,
          status: coerceRequestStatus(request.status)
        }));
        const supportResponse = activeUser?.role === 'client' || activeUser?.role === 'talent'
          ? await apiFetch('/api/support')
          : null;
        const supportBody = supportResponse?.ok
          ? await supportResponse.json().catch(() => ({}))
          : {};
        const mappedLocalRequests = (dbData.clientRequests || []).map((request: any) => ({
          ...request,
          status: coerceRequestStatus(request.status)
        }));
        const mergedRequests = new Map<string, any>();
        for (const request of mappedLocalRequests) {
          if (request?.id) mergedRequests.set(request.id, request);
        }
        for (const request of mappedRemoteRequests) {
          if (request?.id) mergedRequests.set(request.id, { ...mergedRequests.get(request.id), ...request });
        }
        setRequests(Array.from(mergedRequests.values()));

        // Invoices, scoped to this user by the server.
        //
        // This used to query the table straight from the browser and add a
        // client_id filter only when the role string read 'client', so any
        // other session received every invoice on the platform.
        try {
          const invoiceRes = await apiFetch('/api/finance');
          if (invoiceRes.ok) {
            const body = await invoiceRes.json();
            const linesByInvoice = new Map<string, any[]>();
            for (const line of body.lineItems || []) {
              const list = linesByInvoice.get(line.invoiceId) || [];
              list.push(line);
              linesByInvoice.set(line.invoiceId, list);
            }
            setInvoices((body.invoices || []).map((inv: any) => ({
              ...inv,
              lineItems: linesByInvoice.get(inv.id) || []
            })));
          } else {
            // A candidate has no invoices, which is a 403 rather than an
            // error worth showing. Either way, show none.
            setInvoices([]);
          }
        } catch {
          setInvoices([]);
        }

        // Matches come from the scoped resource API. This used to select the
        // whole matches table with the anon key, unordered by owner, so
        // every client received every other client's shortlist.
        setMatches(dbData.matches || []);
        setNotifications(dbData.notifications || []);
        setRehireRequests(dbData.rehireRequests || []);
        setSupportTickets(supportBody.tickets || dbData.supportTickets || []);
        // Interviews come from the scoped resource API. This used to select
        // the whole interviews table with the anon key, so every caller
        // received every interview on the platform.
        setInterviews(dbData.interviews || []);

        setDocuments(dbData.documents || []);
        setRequestActivityLogs(dbData.requestActivityLogs || []);
        // Assessment data for talent side
        setAssessments(dbData.assessments || []);
        setAssessmentCategories(dbData.assessmentCategories || []);
        setAssessmentQuestions(dbData.assessmentQuestions || []);
        setTalentSkillAssessments(dbData.talentSkillAssessments || []);
        setSkillAssessmentResults(dbData.skillAssessmentResults || []);
        setWorkSimulationTasks(dbData.workSimulationTasks || []);
      }
    } catch (e) {
      console.error('Failed to sync DB', e);
    } finally {
      clearTimeout(safetyTimeout);
      setLoading(false);
      setDataReady(true);
    }
  };

  // saveToDb is gone. It posted the browser's whole in-memory copy of
  // the database to /api/db, which upserts about twenty tables from
  // it. Every write now goes to the route that owns that thing.

  // The caller's own profile, in the shape isTalentProfileOnboardingComplete
  // expects. The route returns camelCase; the check reads the column
  // names, so map rather than loosening the check.
  const loadOwnTalentProfile = async (): Promise<any | null> => {
    try {
      const response = await apiFetch('/api/profile/talent');
      if (!response.ok) return null;
      const profile = await response.json();
      if (!profile || !profile.id) return null;
      return {
        id: profile.id,
        bio: profile.bio,
        full_name: profile.fullName,
        level: profile.level,
        country: profile.country,
        vetting_status: profile.vettingStatus
      };
    } catch {
      return null;
    }
  };

  const syncAuthSignupToDb = async (user: any) => {
    // Legacy sync method disabled to fix long load times and use direct Supabase writes.
  };

  useEffect(() => {
    setShowPassword(false);
  }, [authView, clientIntakeStep, clientIntakeActive]);

  useEffect(() => {
    const restoreUserFromSession = async (session: Session) => {
      const authUser = session.user;

      // An unverified address never reaches a dashboard.
      //
      // This function routes by role and clears authView, and it runs from
      // onAuthStateChange — which fires the moment a session appears. For an
      // account that has signed up but not confirmed, that overrode the code
      // screen a beat after it rendered and dropped them into onboarding, so
      // verification could be skipped by doing nothing at all.
      //
      // Supabase's own confirmation timestamp decides. When it is absent the
      // person goes to the code screen instead, whichever way they arrived —
      // a fresh signup, or signing in later to an account they never
      // finished confirming.
      const confirmedAt =
        (authUser as any)?.email_confirmed_at || (authUser as any)?.confirmed_at || null;
      if (!confirmedAt) {
        setPendingSignup(prev => prev || {
          role: ((authUser.user_metadata?.role as any) === 'client' ? 'client' : 'talent'),
          name: authUser.user_metadata?.full_name || '',
          email: authUser.email || '',
          companyName: authUser.user_metadata?.company_name || undefined
        });
        setAuthView('verify');
        setLoading(false);
        return;
      }
      // The caller's own identity, resolved server-side. This used to
      // select from public.users in the browser, which is also what RLS
      // on that table had to permit.
      const meRes = await apiFetch('/api/session');
      const dbUser = meRes.ok ? await meRes.json() : null;

      const role = dbUser?.role || authUser.user_metadata?.role || 'talent';
      // The user is considered to have completed onboarding only when their talent_profile
      // bio contains the __kongila envelope with 100% completion. status='inactive' means
      // they are a talent that has not yet finished onboarding.
      let isOnboardingComplete = false;
      let draftOnboardingData: any = null;
      let draftWizardStep = 1;

      if (role === 'talent') {
        // Through the server. Reading talent_profiles from the browser
        // works today only because RLS is off on that table.
        const dbTalentProfile = await loadOwnTalentProfile();
        isOnboardingComplete = isTalentProfileOnboardingComplete(dbTalentProfile);

        // If not complete, try to restore draft onboarding state
        if (!isOnboardingComplete && dbTalentProfile?.bio) {
          try {
            const parsed = JSON.parse(dbTalentProfile.bio);
            if (parsed?.__kongila_draft === true) {
              draftOnboardingData = parsed.onboardingData || null;
              // Clamped to the five steps the wizard now has. A draft saved
              // before the Remote Readiness step was removed can carry step 6,
              // which would restore a candidate onto a step that no longer
              // renders and leave them looking at an empty card.
              draftWizardStep = Math.min(Math.max(Number(parsed.wizardStep) || 1, 1), 5);
            }
          } catch (e) { /* no draft */ }
        }
      }

      // Use the name stored in Supabase auth metadata for THIS user specifically
      const authName = authUser.user_metadata?.name || authUser.user_metadata?.full_name || dbUser?.email || 'User';

      const restoredUser = {
        id: dbUser?.id || authUser.id,
        name: authName,
        email: authUser.email || '',
        role,
        onboardingStatus: isOnboardingComplete ? 'complete' : 'incomplete',
        // Was hardcoded true. Signup set it false and then both login and
        // session restore overwrote it, so the flag meant nothing and the
        // 'verify' view it gates was unreachable.
        emailVerified: Boolean(authUser.email_confirmed_at || (authUser as any).confirmed_at),
        companyName: authUser.user_metadata?.company_name,
        createdAt: authUser.created_at
      };
      currentUserRef.current = restoredUser;
      setCurrentUser(restoredUser);

      if (!isOnboardingComplete && role === 'talent') {
        // Restore draft data so user continues from where they left off
        if (draftOnboardingData) {
          // A saved currency that is not the one the country would suggest was
          // chosen on purpose, so treat it as touched and leave it alone.
          const savedCurrency = String((draftOnboardingData as any).currency || '');
          const savedCountry = String((draftOnboardingData as any).country || '');
          const deliberateCurrency = Boolean(savedCurrency) && savedCurrency !== currencyForCountry(savedCountry);
          setTalentOnboardingData(prev => ({
            ...prev,
            ...draftOnboardingData,
            currencyTouched: deliberateCurrency
          }));
          setTalentWizardStep(draftWizardStep);
        } else {
          // Fresh onboarding — pre-fill name from this user's auth metadata
          setTalentOnboardingData(prev => ({ ...prev, fullName: authName !== restoredUser.email ? authName : '' }));
          setTalentWizardStep(1);
        }
        setAuthView('onboarding');
      } else {
        setAuthView(null);
        if (role === 'talent') setActiveTab('talent');
        else setActiveTab('client');
      }
    };

    // Restore session on page load
    const initSession = async (existingSession?: Session | null) => {
      const initSafetyTimeout = setTimeout(() => {
        setLoading(false);
      }, 30000);
      try {
        const session = existingSession ?? (await supabase.auth.getSession()).data.session;
        if (session?.user) {
          await restoreUserFromSession(session);
        }
      } catch (err) {
        console.error("Session init failed", err);
      } finally {
        clearTimeout(initSafetyTimeout);
        await syncFromDb();
      }
    };

    initSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        currentUserRef.current = null;
        setCurrentUser(null);
        setAuthView('login');
        setActiveTab('home');
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        // Defer async work so we don't call getSession while the auth lock is held.
        setTimeout(() => {
          void initSession(session);
        }, 0);
      }
    });

    // Polling, and why it is no longer every five seconds.
    //
    // Each poll asks for the whole database — every table read, scoped and
    // signed — so a dashboard left open hammered the server for ever, and a
    // fresh sign-in had to wait behind that traffic. The realtime channels
    // below already push what changes; this is the safety net for the rest,
    // and it runs rarely and only while the tab is actually being looked at.
    const POLL_MS = 30000;
    let interval: any = null;
    const startPolling = () => {
      if (interval === null) interval = setInterval(syncFromDb, POLL_MS);
    };
    const stopPolling = () => {
      if (interval !== null) { clearInterval(interval); interval = null; }
    };
    const onVisibilityChange = () => {
      if (document.hidden) { stopPolling(); return; }
      syncFromDb();
      startPolling();
    };
    if (typeof document !== 'undefined') {
      if (!document.hidden) startPolling();
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    
    // Realtime subscription to talent_requests
    const requestChannel = supabase
      .channel('public:talent_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'talent_requests' }, payload => {
        syncFromDb();
      })
      .subscribe();

    // Realtime subscription to invoices
    const invoicesChannel = supabase
      .channel('public:invoices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, payload => {
        syncFromDb();
      })
      .subscribe();

    // Realtime subscription to conversations
    const convosChannel = supabase
      .channel('public:conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, payload => {
        syncFromDb();
      })
      .subscribe();

    // Realtime subscription to messages
    const msgsChannel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
        syncFromDb();
      })
      .subscribe();

    return () => {
      stopPolling();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      subscription.unsubscribe();
      supabase.removeChannel(requestChannel);
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(convosChannel);
      supabase.removeChannel(msgsChannel);
    };
  }, []);


  // Form Submit
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newReq: ServiceRequest = {
      id: `req_${Date.now()}`,
      clientId: currentUser?.id || 'user_client_1',
      clientName: currentUser ? `${currentUser.name} (${currentUser.companyName || 'Unknown Company'})` : 'Guest Client',
      serviceType: formData.serviceType,
      roleDescription: formData.roleDescription,
      requiredSkills: formData.requiredSkills.split(',').map(s => s.trim()),
      duration: formData.duration,
      commitmentLevel: formData.commitmentLevel,
      numberOfHires: formData.numberOfHires,
      timezone: formData.timezone,
      startDate: formData.startDate,
      budget: Number(String(formData.budget).replace(/[^0-9.-]/g, '')) || 0,
      priority: formData.priority,
      status: 'New Request',
      createdAt: new Date().toISOString()
    };

    // Request creation is server-owned so the browser never writes the
    // talent_requests table or fabricates its audit trail.
    try {
      const response = await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify({ request: newReq })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.request) {
        throw new Error(body.error || 'Could not save the request.');
      }
      Object.assign(newReq, body.request);
    } catch (err) {
      console.error("Failed to save request", err);
      triggerBanner('Could not save your request. Please try again.', 'error');
      setLoading(false);
      return;
    }

    // Matching happens in the admin portal, not here. The client's browser
    // only ever holds the talent it is allowed to see, so matches generated
    // here were computed against a partial pool and then written to the
    // database as if they were the real shortlist.
    const updatedRequests = [...requests, newReq];
    const updatedMatches = matches;
    
    setRequests(updatedRequests);
    setMatches(updatedMatches);

    setSelectedRequest(newReq);
    setLoading(false);
    setClientIntakeActive(false);
    setClientSubTab('matching');
    setActiveTab('client');
    triggerBanner('Talent Request submitted successfully! Sourcing vetting scans.', 'success');
  };

  // Auth Submissions
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput || !nameInput) {
      triggerBanner('Please fill in all credentials fields.', 'error');
      return;
    }

    // An invitation is bound to the address it was issued to. Without this,
    // a forwarded link would attach whoever opened it to that organisation at
    // the invited permission level.
    if (
      inviteEmailLocked &&
      emailInput.trim().toLowerCase() !== inviteEmailLocked.trim().toLowerCase()
    ) {
      triggerBanner(
        `This invitation was issued to ${inviteEmailLocked}. Please sign up with that address.`,
        'error'
      );
      return;
    }

    try {
      setLoading(true);
      let { data, error } = await supabase.auth.signUp({
        email: emailInput,
        password: passwordInput,
        options: {
          // Where Supabase sends them after they click the link in the
          // verification email. Without this it falls back to the project's
          // Site URL, which is wrong in every environment but one.
          emailRedirectTo: `${window.location.origin}/?authView=verified`,
          data: {
            full_name: nameInput,
            role: authRole,
            company_name: authRole === 'client' ? companyInput : undefined,
          }
        }
      });

      if (error && /already registered|already exists/i.test(error.message)) {
        const existingAccount = await supabase.auth.signInWithPassword({
          email: emailInput,
          password: passwordInput
        });
        if (existingAccount.error) {
          throw new Error(
            'This email already has an account. Sign in with that account to finish setup.'
          );
        }
        data = existingAccount.data;
        error = null;
      }
      if (error) throw error;

      // Whether this address has actually been verified.
      //
      // The absence of a session is not the test. It is *a* symptom of an
      // unconfirmed signup, but it misses two real cases: an existing
      // unconfirmed account that the branch above just signed into, and a
      // project where confirmation was switched on after some accounts were
      // already made. Both hand back a session for an address nobody has
      // proved they own, and both skipped the code screen entirely.
      //
      // email_confirmed_at is Supabase's own answer to the question, so ask
      // that instead. It is set at signup when confirmation is off, which is
      // correct: there is no code to enter, and stranding someone on a
      // screen waiting for an email that will never arrive is worse than
      // letting them through.
      const confirmedAt =
        (data.user as any)?.email_confirmed_at || (data.user as any)?.confirmed_at || null;
      const emailConfirmed = Boolean(confirmedAt);

      if (!emailConfirmed && data.session) {
        // Signed in but unverified. Keep them out of onboarding, and make
        // sure the code screen has something to verify against.
        await supabase.auth.resend({ type: 'signup', email: emailInput }).catch(() => {});
      }

      if (emailConfirmed && data.session && process.env.NODE_ENV !== 'production') {
        // Worth saying out loud, because it looks identical to a bug: the
        // account was confirmed the instant it was created, which only
        // happens when "Confirm email" is off in the Supabase project. No
        // code was sent because none exists.
        console.warn(
          '[signup] Supabase confirmed this email immediately, so no verification code was sent. '
          + 'Turn on Authentication -> Sign In / Providers -> Email -> "Confirm email" to require one.'
        );
      }

      if (!emailConfirmed) {
        setPendingSignup({
          role: authRole,
          name: nameInput,
          email: emailInput,
          companyName: authRole === 'client' ? companyInput : undefined,
          inviteToken: inviteTokenRaw || undefined
        });
        setAuthView('verify');
        return;
      }

      await completeSignup({
        role: authRole,
        name: nameInput,
        email: emailInput,
        companyName: authRole === 'client' ? companyInput : undefined,
        inviteToken: inviteTokenRaw || undefined
      });
    } catch (error: any) {
      triggerBanner(`Sign up failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Everything that happens once the account is real and signed in.
   *
   * Called straight after signUp when confirmation is off, and after the
   * verification code when it is on. One path, so the two cannot drift.
   */
  const completeSignup = async (details: {
    role: 'talent' | 'client';
    name: string;
    email: string;
    companyName?: string;
    inviteToken?: string;
  }) => {
    const provisionRes = await apiFetch('/api/account/provision', {
      method: 'POST',
      body: JSON.stringify({
        role: details.role,
        name: details.name,
        email: details.email,
        companyName: details.companyName,
        inviteToken: details.inviteToken
      })
    });
    const provision = await provisionRes.json().catch(() => ({}));
    if (!provisionRes.ok || !provision?.ok) {
      throw new Error(provision?.error || 'Could not finish creating your account.');
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const authUserId = sessionData?.session?.user?.id || provision?.userId || crypto.randomUUID();

    const newUser = {
      id: authUserId,
      name: details.name,
      email: details.email,
      role: details.role,
      onboardingStatus: 'incomplete',
      // True by the time this runs: either confirmation is off, or the code
      // has just been accepted.
      emailVerified: true,
      companyName: details.companyName,
      createdAt: new Date().toISOString()
    };

    setCurrentUser(newUser);
    await syncAuthSignupToDb(newUser);
    setPendingSignup(null);

    if (details.role === 'talent') {
      setTalentOnboardingData(prev => ({ ...prev, fullName: details.name }));
      setTalentWizardStep(1);
      setAuthView('onboarding');
    } else {
      setAuthView(null);
      setActiveTab('client');
    }
    triggerBanner('Account created successfully! Welcome to Kongila.', 'success');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      triggerBanner('Please provide your email and password.', 'error');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
      });

      if (error) throw error;

      // The role comes from the server, which takes the id from the
      // verified token rather than matching on an email the browser sent.
      const meRes = await apiFetch('/api/session');
      const dbUser = meRes.ok ? await meRes.json() : null;

      const role = dbUser?.role || data.user?.user_metadata?.role || 'talent';
      if (role === 'client' || role === 'talent') {
        const provisionRes = await apiFetch('/api/account/provision', {
          method: 'POST',
          body: JSON.stringify({
            role,
            name: data.user?.user_metadata?.full_name || emailInput,
            companyName: data.user?.user_metadata?.company_name,
            inviteToken: inviteTokenRaw || undefined
          })
        });
        const provision = await provisionRes.json().catch(() => ({}));
        if (!provisionRes.ok || !provision.ok) {
          throw new Error(
            provision.error || 'Your account setup is incomplete. Please try signing in again.'
          );
        }
      }

      let isOnboardingComplete = Boolean(dbUser);
      if (role === 'talent') {
        // Through the server. Reading talent_profiles from the browser
        // works today only because RLS is off on that table.
        const dbTalentProfile = await loadOwnTalentProfile();
        isOnboardingComplete = isTalentProfileOnboardingComplete(dbTalentProfile);

      }

      const loggedInUser = {
        id: dbUser?.id || data.user?.id || `user_${Date.now()}`,
        name: data.user?.user_metadata?.full_name || emailInput,
        email: emailInput,
        role,
        onboardingStatus: isOnboardingComplete ? 'complete' : 'incomplete',
        emailVerified: Boolean(data.user?.email_confirmed_at || (data.user as any)?.confirmed_at),
        companyName: data.user?.user_metadata?.company_name,
        createdAt: data.user?.created_at || new Date().toISOString()
      };

      currentUserRef.current = loggedInUser;
      setCurrentUser(loggedInUser);
      
      if (!isOnboardingComplete && role === 'talent') {
        setAuthView('onboarding');
      } else {
        setAuthView(null);
        if (role === 'talent') {
          setActiveTab('talent');
        } else {
          setActiveTab('client');
        }
      }
      triggerBanner(`Welcome back! Logged in successfully.`, 'success');
    } catch (error: any) {
      triggerBanner(`Login failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };



  // Persists partial onboarding state to talent_profiles.bio as a draft envelope.
  // Called whenever the user advances a step so they can resume if they leave.
  const saveDraftOnboarding = async (step: number, data: typeof talentOnboardingData) => {
    const userId = currentUser?.id;
    if (!userId) return;
    try {
      // Through the server. The draft lives in the bio column, and the
      // same upsert used to carry the whole row, so a half-finished signup
      // could set a grade on the way past. talent_profiles has RLS off in
      // the live database, so it landed.
      // currencyTouched only exists to stop the country default overwriting a
      // deliberate choice. It is interface state, not a fact about the
      // candidate, so it does not go to the server.
      const { currencyTouched, ...draftData } = data as any;
      await apiFetch('/api/profile/talent', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'draft', step, data: draftData })
      });
    } catch (e) {
      // Non-critical — draft save failure should not block user
      console.warn('[Onboarding] Draft save failed:', e);
    }
  };

  // The salary step opens on the currency of the country chosen in step 1.
  // It stops following the country as soon as the candidate picks a currency
  // themselves, so a deliberate choice is never overwritten by going back and
  // editing the country.
  useEffect(() => {
    if (talentOnboardingData.currencyTouched) return;
    const suggested = currencyForCountry(talentOnboardingData.country);
    if (suggested === talentOnboardingData.currency) return;
    setTalentOnboardingData(prev =>
      prev.currencyTouched ? prev : { ...prev, currency: suggested }
    );
  }, [talentOnboardingData.country, talentOnboardingData.currencyTouched, talentOnboardingData.currency]);

  // Returns a list of missing/invalid field labels for each wizard step.
  const validateWizardStep = (step: number): string[] => {
    const d = talentOnboardingData;
    const errors: string[] = [];
    if (step === 1) {
      if (!d.profilePhotoUrl) errors.push('Profile Photo');
      if (!d.fullName?.trim()) errors.push('Full Name');
      if (!d.phone?.trim()) errors.push('Phone Number');
      if (!d.country?.trim()) errors.push('Country');
      if (!d.city?.trim()) errors.push('City');
      if (!d.dateOfBirth) errors.push('Date of Birth');
      if (!d.gender) errors.push('Gender');
      if (!d.timezone?.trim()) errors.push('Timezone');
    } else if (step === 2) {
      if (!d.primaryRole?.trim()) errors.push('Professional Title');
      if (!d.primaryRoleCategory) errors.push('Role Category');
      if (!d.seniorityLevel) errors.push('Seniority Level');
      if (!d.yearsExperience && d.yearsExperience !== '0') {
        errors.push('Years of Experience');
      } else {
        const yrs = Number(d.yearsExperience);
        const range = getSeniorityRange(d.seniorityLevel);
        if (range && (yrs < range.min || yrs > range.max)) {
          errors.push(`Years of Experience must be ${range.min}–${range.max === 99 ? '12+' : range.max} for ${d.seniorityLevel}`);
        }
      }
      if (!d.bio?.trim()) errors.push('Short Bio');
      if (d.skills.length === 0) errors.push('At least one Primary Skill');
      if (!d.employmentPreference) errors.push('Employment Preference');
    } else if (step === 3) {
      if (!d.hourlyMonthly) errors.push('Expected Salary Format');
      if (!d.noticePeriod) errors.push('Notice Period');
      if (!d.salaryExpectationMin) errors.push('Salary Range (minimum)');
      if (!d.salaryExpectationMax) errors.push('Salary Range (maximum)');
      if (!d.currency) errors.push('Currency');
    } else if (step === 4) {
      if (!d.cvUrl) errors.push('CV / Resume (PDF)');
      // LinkedIn is compulsory. Operations uses it to confirm the work
      // history on the CV before a candidate reaches a client.
      if (!d.linkedInUrl?.trim()) {
        errors.push('LinkedIn URL');
      } else if (!/^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(d.linkedInUrl.trim())) {
        errors.push('LinkedIn URL must be a full linkedin.com profile address');
      }
    }
    return errors;
  };

  const advanceStep = (nextStep: number) => {
    const currentStep = nextStep - 1;
    const errors = validateWizardStep(currentStep);
    if (errors.length > 0) {
      setWizardStepErrors(errors);
      return;
    }
    setWizardStepErrors([]);
    saveDraftOnboarding(nextStep, talentOnboardingData);
    setTalentWizardStep(nextStep);
    // Always scroll to the very top of the page when moving between steps
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // uploadToBucket is gone. It uploaded with the anon key to a path the
  // browser chose, with upsert on, so one person could overwrite another's
  // file by naming it. uploadFile asks the server for a signed URL and the
  // server decides the path from the session.

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      triggerBanner('Profile photo must be an image file.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      triggerBanner('Profile photo must be smaller than 2MB.', 'error');
      return;
    }
    const imageUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          if (img.width < 200 || img.height < 200) {
            triggerBanner('Profile photo must be at least 200x200px.', 'error');
            resolve(null);
            return;
          }
          resolve(String(reader.result || ''));
        };
        img.onerror = () => {
          triggerBanner('Could not read profile photo.', 'error');
          resolve(null);
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
    if (!imageUrl) return;

    setMockUploading(true);
    try {
      const uploaded = await uploadFile('talent_avatar', file);
      const publicUrl = uploaded.url;
      setTalentOnboardingData(prev => ({
        ...prev,
        profilePhotoUrl: publicUrl,
        profilePhotoName: file.name,
        profilePhotoSize: file.size
      }));
      triggerBanner('Profile photo uploaded.', 'success');
    } catch (err: any) {
      triggerBanner('Profile photo upload failed: ' + err.message, 'error');
    } finally {
      setMockUploading(false);
    }
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      triggerBanner('CV upload accepts PDF files only.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      triggerBanner('CV must be 5MB or smaller.', 'error');
      return;
    }

    setMockUploading(true);
    setUploadProgress(10);
    
    try {
      const uploaded = await uploadFile('talent_document', file);
      setUploadProgress(100);
      const publicUrl = uploaded.url;
      setTalentOnboardingData(prev => ({ ...prev, cvName: file.name, cvUrl: publicUrl, cvSize: file.size }));
      triggerBanner('CV successfully uploaded.', 'success');
    } catch (err: any) {
      triggerBanner('Upload failed: ' + err.message, 'error');
    } finally {
      setTimeout(() => {
        setMockUploading(false);
      }, 500);
    }
  };

  const handleCertificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const nextFiles: Array<{ name: string; url: string; size: number; type: string }> = [];
    setMockUploading(true);
    try {
      for (const file of files) {
        const isAllowed = file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png' || /\.(pdf|jpe?g|png)$/i.test(file.name);
        if (!isAllowed) {
          triggerBanner(`Unsupported certification format: ${file.name}`, 'error');
          continue;
        }
        const uploaded = await uploadFile('talent_document', file);
        const publicUrl = uploaded.url;
        nextFiles.push({ name: file.name, url: publicUrl, size: file.size, type: file.type });
      }
      if (nextFiles.length > 0) {
        setTalentOnboardingData(prev => ({ ...prev, certificationFiles: [...prev.certificationFiles, ...nextFiles] }));
        triggerBanner('Certification files uploaded.', 'success');
      }
    } catch (err: any) {
      triggerBanner('Certification upload failed: ' + err.message, 'error');
    } finally {
      setMockUploading(false);
    }
  };

  // Submit Talent Onboarding Wizard
  const handleTalentWizardSubmit = async () => {
    setLoading(true);

    try {
      const authUserId = currentUser?.id;
      const talentName = talentOnboardingData.fullName || currentUser?.name || 'Talent';
      const talentEmail = currentUser?.email || '';
      const primarySkills = Array.isArray(talentOnboardingData.skills)
        ? talentOnboardingData.skills.filter(Boolean).slice(0, 5)
        : [];
      const secondarySkills = String(talentOnboardingData.secondarySkills || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      const skillsList = [...primarySkills, ...secondarySkills];

      const salaryCurrency = talentOnboardingData.currency || 'USD';
      let usdRate = 1;
      if (salaryCurrency !== 'USD') {
        try {
          const rateRes = await fetch(`/api/exchange-rate?base=${encodeURIComponent(salaryCurrency)}&target=USD`);
          if (rateRes.ok) {
            const rateData = await rateRes.json();
            usdRate = Number(rateData.rate) || 1;
          }
        } catch (e) {
          usdRate = 1;
        }
      }

      const salaryMinLocal = Number(talentOnboardingData.salaryExpectationMin || 0);
      const salaryMaxLocal = Number(talentOnboardingData.salaryExpectationMax || 0);
      const resolvedSalaryLocal = salaryMaxLocal || salaryMinLocal || 0;
      const resolvedSalaryUsd = Math.round(resolvedSalaryLocal * usdRate);
      const resolvedSalaryMinUsd = salaryMinLocal > 0 ? Math.round(salaryMinLocal * usdRate) : resolvedSalaryUsd || 0;
      const resolvedSalaryMaxUsd = salaryMaxLocal > 0 ? Math.round(salaryMaxLocal * usdRate) : resolvedSalaryUsd || 0;
      const bioText = talentOnboardingData.bio || '';

      const onboardingTelemetry = {
        createdAt: new Date().toISOString(),
        fullName: talentName,
        profilePhotoUrl: talentOnboardingData.profilePhotoUrl || '',
        profilePhotoName: talentOnboardingData.profilePhotoName || '',
        profilePhotoSize: talentOnboardingData.profilePhotoSize || 0,
        phoneCode: talentOnboardingData.phoneCode || '',
        phone: talentOnboardingData.phone || '',
        country: talentOnboardingData.country || '',
        city: talentOnboardingData.city || '',
        timezone: talentOnboardingData.timezone || '',
        dateOfBirth: talentOnboardingData.dateOfBirth || '',
        gender: talentOnboardingData.gender || '',
        nationality: talentOnboardingData.nationality || '',
        title: talentOnboardingData.primaryRole || '',
        yearsExperience: Number(talentOnboardingData.yearsExperience) || 0,
        primaryRoleCategory: talentOnboardingData.primaryRoleCategory || '',
        seniorityLevel: talentOnboardingData.seniorityLevel || talentOnboardingData.primaryRoleCategory || '',
        employmentPreference: talentOnboardingData.employmentPreference || '',
        preferredWorkHours: talentOnboardingData.hourlyMonthly || talentOnboardingData.preferredWorkHours || '',
        noticePeriod: talentOnboardingData.noticePeriod || talentOnboardingData.availableStartDate || '',
        availableStartDate: talentOnboardingData.noticePeriod || talentOnboardingData.availableStartDate || '',
        currency: salaryCurrency,
        salaryExpectationUsd: resolvedSalaryUsd,
        salaryExpectationMinUsd: resolvedSalaryMinUsd,
        salaryExpectationMaxUsd: resolvedSalaryMaxUsd,
        // The band as the candidate typed it, in their own currency. Only the
        // USD conversion was sent, so operations saw a single converted figure
        // and never the range the candidate said they would accept.
        salaryExpectationMin: salaryMinLocal || 0,
        salaryExpectationMax: salaryMaxLocal || 0,
        salaryExpectationCurrency: salaryCurrency,
        portfolioUrl: talentOnboardingData.portfolioUrl || '',
        linkedIn: talentOnboardingData.linkedInUrl || '',
        linkedinUrl: talentOnboardingData.linkedInUrl || '',
        githubUrl: talentOnboardingData.githubUrl || '',
        websiteUrl: talentOnboardingData.websiteUrl || '',
        certifications: talentOnboardingData.certifications || '',
        certificationFiles: talentOnboardingData.certificationFiles || [],
        cvUrl: talentOnboardingData.cvUrl || '',
        cvName: talentOnboardingData.cvName || '',
        cvSize: talentOnboardingData.cvSize || 0,
        primarySkills,
        secondarySkills,
        skillLevels: talentOnboardingData.skillLevels || {},
        skills: skillsList,
        bio: bioText,
        workExperience: [],
        profileCompletionPercent: 0,
        requiresReReview: false,
        vettingPipeline: [],
        onboardingVideoSeenAt: null,
        onboardingVideoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4'
      };

      let packedBio = '';

      const completionCheck = calculateTalentProfileCompletion({
        name: talentName,
        email: talentEmail,
        avatar: talentOnboardingData.profilePhotoUrl || '',
        title: talentOnboardingData.primaryRole || '',
        primaryRoleCategory: talentOnboardingData.primaryRoleCategory || '',
        seniorityLevel: talentOnboardingData.seniorityLevel || talentOnboardingData.primaryRoleCategory || '',
        experienceYears: Number(talentOnboardingData.yearsExperience) || 0,
        primarySkills,
        skills: skillsList,
        preferredWorkHours: talentOnboardingData.preferredWorkHours || talentOnboardingData.hourlyMonthly || '',
        noticePeriod: talentOnboardingData.noticePeriod || talentOnboardingData.availableStartDate || '',
        availableStartDate: talentOnboardingData.noticePeriod || talentOnboardingData.availableStartDate || '',
        salaryExpectationUsd: resolvedSalaryUsd || 0,
        bio: bioText,
        phone: talentOnboardingData.phone || '',
        country: talentOnboardingData.country || '',
        city: talentOnboardingData.city || '',
        timezone: talentOnboardingData.timezone || '',
        dateOfBirth: talentOnboardingData.dateOfBirth || '',
        gender: talentOnboardingData.gender || '',
        nationality: talentOnboardingData.nationality || '',
        profilePhotoUrl: talentOnboardingData.profilePhotoUrl || '',
        cvUrl: talentOnboardingData.cvUrl || '',
        linkedIn: talentOnboardingData.linkedInUrl || '',
        documents: []
      } as any);

      if (!completionCheck.coreComplete) {
        triggerBanner(`Please fill in all required fields before finishing: ${completionCheck.coreIncomplete.join(', ')}`, 'error');
        setLoading(false);
        return;
      }

      // Warn if optional fields are missing, but allow completion
      if (completionCheck.percent < 100 && completionCheck.incomplete.length > 0) {
        console.info('[Onboarding] Optional fields not filled:', completionCheck.incomplete);
      }

      onboardingTelemetry.profileCompletionPercent = completionCheck.percent;
      packedBio = JSON.stringify({
        __kongila: true,
        tags: primarySkills,
        scores: {},
        telemetry: onboardingTelemetry,
        bio: bioText
      });

      let savedProfileId = authUserId || '';

      // ── 1. The public.users row already exists ──
      // It is created server-side by /api/account/provision during signup.
      // The browser cannot write that table: UPDATE is revoked from
      // authenticated, so this upsert would always fail. Activation happens
      // in step 3 below, through /api/account/activate.
      if (authUserId) {
        // ── 2. Save full onboarding data through the profile API ──
        // The payload used to carry vetting_stage, vetting_status and grade,
        // upserted straight from the browser with the anon key. RLS is off on
        // talent_profiles in the live database, so a candidate could post
        // themselves a grade. Those columns are refused by the route now and
        // set server side on the first write.
        const profilePatch = {
          full_name: talentName,
          phone: talentOnboardingData.phone || null,
          country: talentOnboardingData.country || null,
          gender: talentOnboardingData.gender || null,
          level: talentOnboardingData.primaryRole || null,
          availability_hours: Number(talentOnboardingData.availability) || null,
          salary_max: resolvedSalaryUsd || null,
          salary_expectation: resolvedSalaryUsd || null,
          experience_years: Number(talentOnboardingData.yearsExperience) || null,
          timezone: talentOnboardingData.timezone || null,
          bio: packedBio,
          avatar_url: talentOnboardingData.profilePhotoUrl || null
        };

        // Skills go with the profile. The route resolves each name to a row
        // in the skills table, which has a unique constraint on name, so the
        // old id-based upsert could create the same skill twice.
        const skillClaims = skillsList.map((skillName: string) => ({
          name: skillName,
          level: talentOnboardingData.skillLevels?.[skillName]
            ? String(talentOnboardingData.skillLevels[skillName]).toLowerCase()
            : 'intermediate'
        }));

        const profileRes = await apiFetch('/api/profile/talent', {
          method: 'PATCH',
          body: JSON.stringify({ patch: profilePatch, skills: skillClaims })
        });

        if (!profileRes.ok) {
          const detail = await profileRes.json().catch(() => ({}));
          console.error('[Onboarding] profile save failed:', detail?.error, detail?.problems);
          throw new Error(detail?.error || 'Your profile could not be saved.');
        }
        const savedProfile = await profileRes.json();
        savedProfileId = savedProfile.profile?.id || savedProfileId;

        // ── 3. Mark the account active ──
        // Server-side: UPDATE on public.users is revoked from authenticated,
        // so the browser cannot set status. The route activates the caller
        // only, taking the id from the verified token.
        const activateRes = await apiFetch('/api/account/activate', { method: 'POST' });
        if (!activateRes.ok) {
          const detail = await activateRes.json().catch(() => ({}));
          console.error('[Onboarding] account activation failed:', detail?.error);
          triggerBanner(
            'Your profile saved, but the account could not be activated. Contact support.',
            'error'
          );
        }

        // Update the local dashboard view from the profile just saved.
        const existingIndex = talents.findIndex((t: TalentProfile) =>
          t.id === savedProfileId || (talentEmail && t.email?.toLowerCase() === talentEmail.toLowerCase())
        );
        const baseTalent: Partial<TalentProfile> = existingIndex > -1 ? talents[existingIndex] : {};

        const updatedTalent: TalentProfile = {
          ...baseTalent,
          id: savedProfileId || baseTalent.id || `talent_${Date.now()}`,
          name: talentName,
          email: talentEmail,
          avatar: talentOnboardingData.profilePhotoUrl || baseTalent.avatar || 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
          title: talentOnboardingData.primaryRole || '',
          skills: skillsList.length > 0 ? skillsList : (baseTalent.skills || []),
          primarySkills,
          secondarySkills,
          skillLevels: talentOnboardingData.skillLevels || {},
          timezone: talentOnboardingData.timezone || '',
          salaryExpectation: resolvedSalaryUsd || 0,
          salaryExpectationUsd: resolvedSalaryUsd || 0,
          salaryExpectationMinUsd: resolvedSalaryMinUsd || 0,
          salaryExpectationMaxUsd: resolvedSalaryMaxUsd || 0,
          salaryExpectationCurrency: salaryCurrency,
          experienceYears: Number(talentOnboardingData.yearsExperience) || 0,
          seniorityLevel: talentOnboardingData.seniorityLevel || talentOnboardingData.primaryRoleCategory || '',
          availability: Number(talentOnboardingData.availability) || 0,
          vettingStage: 'Application Screening' as any,
          vettingStatus: 'Applied' as any,
          vettingScores: baseTalent.vettingScores || {
            technical: 0, behavioral: 0, personality: 0,
            remoteReadiness: 0, workSimulation: 0
          },
          grade: 'Ungraded' as any,
          tags: primarySkills,
          bio: talentOnboardingData.bio || '',
          phone: talentOnboardingData.phone || '',
          country: talentOnboardingData.country || '',
          city: talentOnboardingData.city || '',
          dateOfBirth: talentOnboardingData.dateOfBirth || '',
          gender: talentOnboardingData.gender || '',
          nationality: talentOnboardingData.nationality || '',
          primaryRoleCategory: talentOnboardingData.primaryRoleCategory || '',
          employmentPreference: talentOnboardingData.employmentPreference || '',
          preferredWorkHours: talentOnboardingData.hourlyMonthly || talentOnboardingData.preferredWorkHours || '',
          noticePeriod: talentOnboardingData.noticePeriod || talentOnboardingData.availableStartDate || '',
          availableStartDate: talentOnboardingData.noticePeriod || talentOnboardingData.availableStartDate || '',
          currency: salaryCurrency,
          hourlyMonthly: talentOnboardingData.hourlyMonthly || '',
          portfolioUrl: talentOnboardingData.portfolioUrl || '',
          linkedIn: talentOnboardingData.linkedInUrl || '',
          linkedinUrl: talentOnboardingData.linkedInUrl || '',
          githubUrl: talentOnboardingData.githubUrl || '',
          websiteUrl: talentOnboardingData.websiteUrl || '',
          certifications: talentOnboardingData.certifications || '',
          certificationFiles: talentOnboardingData.certificationFiles || [],
          profilePhotoUrl: talentOnboardingData.profilePhotoUrl || '',
          profilePhotoName: talentOnboardingData.profilePhotoName || '',
          profilePhotoSize: talentOnboardingData.profilePhotoSize || 0,
          cvUrl: talentOnboardingData.cvUrl || '',
          cvName: talentOnboardingData.cvName || '',
          cvSize: talentOnboardingData.cvSize || 0,
          createdAt: baseTalent.createdAt || new Date().toISOString(),
          onboardingVideoSeenAt: baseTalent.onboardingVideoSeenAt ?? null,
          onboardingVideoUrl: baseTalent.onboardingVideoUrl || 'https://www.w3schools.com/html/mov_bbb.mp4',
          profileCompletionPercent: completionCheck.percent,
          requiresReReview: false,
          documents: baseTalent.documents || [],
          supportTickets: baseTalent.supportTickets || []
        };

        const updatedTalents = [...talents];
        if (existingIndex > -1) updatedTalents[existingIndex] = updatedTalent;
        else updatedTalents.push(updatedTalent);
        setTalents(updatedTalents);
      }
    } catch (e) {
      console.error('[Onboarding] Failed to submit onboarding data:', e);
      triggerBanner('We could not save your onboarding profile yet. Please try again so your profile data is not lost.', 'error');
      setLoading(false);
      return;
    }

    if (currentUser) {
      setCurrentUser({ ...currentUser, onboardingStatus: 'complete' });
    }

    setAuthView(null);
    setActiveTab('talent');
    setLoading(false);
    triggerBanner('Onboarding Complete! Your profile is live. Workspace deployed.', 'success');
  };


  // Schedule Interview
  const handleScheduleMeeting = async () => {
    if (!selectedTalent || !selectedRequest || !currentUser) return;
    
    // Through the server. A browser insert could not check whether either
    // party was already booked, could not email the candidate, and wrote
    // nothing to the audit log.
    const clientZone = viewerTimeZone();
    const ivResponse = await apiFetch('/api/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: selectedRequest.id,
        talentId: selectedTalent.id,
        talentName: selectedTalent.name,
        clientName: currentUser.name,
        title: `${selectedRequest.roleTitle || selectedRequest.serviceType} - Interview with ${selectedTalent.name}`,
        date: meetingDate,
        time: meetingTime,
        timezone: clientZone,
        clientTimezone: clientZone,
        talentTimezone: (selectedTalent as any)?.timezone || null,
        durationMinutes: 60
      })
    });

    const ivPayload = await ivResponse.json().catch(() => ({}));
    if (!ivResponse.ok) {
      console.error('Failed to schedule interview', ivPayload?.error);
      // Says why. A clash or a past slot is something the client can act on,
      // and "Failed to schedule interview." told them nothing.
      triggerBanner(ivPayload?.error || 'Failed to schedule interview.', 'error');
      return;
    }
    const insertedData = ivPayload.interview;

    // Still maintain the local 'matches' array update for the dashboard visual if needed, 
    // or just rely on the new UI reading directly from Supabase.
    const requestMatch = matches.find(m => m.requestId === selectedRequest.id && m.talentId === selectedTalent.id);
    if (requestMatch) {
      const updatedMatches = matches.map(m => 
        m.id === requestMatch.id ? { ...m, status: 'Interview Scheduled' as const } : m
      );
      setMatches(updatedMatches);
    }

    // The audit and agent-log entries that used to be assembled here and
    // posted through /api/db are gone. That payload also carried matches
    // with status 'Interview Scheduled', which matches_status_check does
    // not allow, so the upsert failed while the rest of the payload still
    // overwrote talents, clientRequests and contracts from browser state.
    // /api/interviews writes the audit entry itself.
    setShowCalendar(false);
    triggerBanner(`Interview requested with ${selectedTalent.name}! Awaiting their confirmation.`, 'success');
  };

  // Extend Job Offer (Generate Contract)
  const handleExtendOffer = async (talent: TalentProfile) => {
    if (!selectedRequest || !currentUser) return;

    const contractResponse = await apiFetch('/api/contracts', {
      method: 'POST',
      body: JSON.stringify({
        talentId: talent.id,
        requestId: selectedRequest.id,
        serviceType: selectedRequest.serviceType,
        roleTitle: selectedRequest.roleDescription || selectedRequest.title || 'Role',
        startDate: selectedRequest.startDate,
        budget: selectedRequest.budget
      })
    });
    const contractBody = await contractResponse.json().catch(() => ({}));
    const insertedContract = contractBody.contract;
    if (!contractResponse.ok || !insertedContract) {
      console.error('Failed to create contract', contractBody.error);
      triggerBanner('Failed to generate contract.', 'error');
      return;
    }

    // Update match status to offer extended
    const updatedMatches = matches.map(m => 
      (m.requestId === selectedRequest.id && m.talentId === talent.id) 
        ? { ...m, status: 'Offer Extended' as const } 
        : m
    );

    // Update request status to Onboarding
    const updatedRequests = requests.map(r => 
      r.id === selectedRequest.id ? { ...r, status: 'Candidates Ready' as const } : r
    );

    const ndaText = generateNDATemplate(talent.name, currentUser ? `${currentUser.name} (${currentUser.companyName || 'Unknown Company'})` : 'Guest Client');
    setActiveNDA(ndaText);
    setSigningContractId(insertedContract.id);

    // Same again: this posted matches with status 'Offer Extended', which
    // matches_status_check does not allow, alongside the browser's copy of
    // talents, clientRequests and contracts. /api/contracts records the
    // offer and the audit entry.
    setMatches(updatedMatches);
    setRequests(updatedRequests);
    setShowSignModal(true);
  };

  /**
   * After the client has signed.
   *
   * This used to be the signing itself: it wrote the contract to "Signed"
   * from the browser with no signature of any kind, credited the candidate
   * in the audit log for the client's action, and invented an onboarding
   * task in a product Kongila is launching without. The signature is now
   * recorded by /api/signatures, which hashes the document, takes the IP and
   * user agent from the request and stamps the server's time. All that is
   * left here is reflecting the result.
   */
  const handleSignContract = async (result?: any) => {
    if (!signingContractId) return;

    const status = result?.status || 'talent_signed';
    setContracts(prev => prev.map(c =>
      c.id === signingContractId ? { ...c, status, signedAt: result?.signedAt || new Date().toISOString() } : c
    ));

    triggerBanner(
      result?.bothParties
        ? 'Contract signed by both parties.'
        : 'Your signature is recorded. The contract is waiting for the other party.',
      'success'
    );
  };

  const getMatchedTalentsForRequest = () => {
    if (!selectedRequest) return [];
    const requestMatches = matches.filter(m => m.requestId === selectedRequest.id);
    return requestMatches.map(m => {
      const talent = talents.find(t => t.id === m.talentId);
      return {
        talent,
        match: m
      };
    }).filter(item => item.talent !== undefined) as { talent: TalentProfile; match: Match }[];
  };

  // Find the database talent profile matching current user email or ID
  const getCurrentTalentProfile = () => {
    if (!currentUser) return null;
    return talents.find(t => t.id === currentUser.id || t.email.toLowerCase() === currentUser.email.toLowerCase());
  };

  const handleUpdateProfile = async (updatedProfile: any) => {
    const previousProfile = talents.find(t => t.id === updatedProfile.id);
    const requiresReReview = Boolean(
      previousProfile &&
      ['Vetted', 'Matched', 'Deployed'].includes(previousProfile.vettingStatus) &&
      hasCoreTalentProfileChanges(previousProfile, updatedProfile)
    );
    const nextProfile = requiresReReview ? { ...updatedProfile, requiresReReview: true } : updatedProfile;
    const updatedTalents = talents.map(t => t.id === nextProfile.id ? nextProfile : t);
    setTalents(updatedTalents);

    try {
      // Pack the bio envelope just like onboarding does
      const onboardingTelemetry = {
        ...nextProfile,
        primarySkills: nextProfile.primarySkills || nextProfile.skills || [],
        secondarySkills: nextProfile.secondarySkills || [],
        skillLevels: nextProfile.skillLevels || {},
        salaryExpectationUsd: nextProfile.salaryExpectationUsd || nextProfile.salaryExpectation || 0,
        phoneCode: nextProfile.phoneCode || ''
      };
      // delete non-telemetry fields
      delete onboardingTelemetry.id;
      delete onboardingTelemetry.name;
      delete onboardingTelemetry.bio;
      delete onboardingTelemetry.tags;
      delete onboardingTelemetry.vettingScores;
      
      const packedBio = JSON.stringify({
        __kongila: true,
        tags: nextProfile.primarySkills || [],
        scores: nextProfile.vettingScores || {},
        telemetry: onboardingTelemetry,
        bio: nextProfile.bio || ''
      });

      // vetting_stage, vetting_status and grade used to be sent from here
      // too, so every profile save rewrote the judgement operations had made
      // about this candidate from whatever the browser happened to be
      // holding. They are not in the patch and the route refuses them.
      const profilePatch = {
        full_name: nextProfile.name || null,
        phone: nextProfile.phone || null,
        country: nextProfile.country || null,
        gender: nextProfile.gender || null,
        level: nextProfile.title || null,
        availability_hours: Number(nextProfile.availability) || null,
        salary_max: Number(nextProfile.salaryExpectationUsd) || null,
        salary_expectation: Number(nextProfile.salaryExpectationUsd) || null,
        experience_years: Number(nextProfile.experienceYears) || null,
        timezone: nextProfile.timezone || null,
        bio: packedBio,
        avatar_url: nextProfile.profilePhotoUrl || nextProfile.avatar || null
      };

      const response = await apiFetch('/api/profile/talent', {
        method: 'PATCH',
        body: JSON.stringify({ patch: profilePatch })
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.error || 'Your profile could not be saved.');
      }
    } catch (e: any) {
      console.error("Failed to persist profile update", e);
      triggerBanner(e?.message || 'Your profile could not be saved.', 'error');
    }
  };

  const handleUpdateMatch = async (updatedMatch: any) => {
    const previous = matches;
    setMatches(matches.map(m => m.id === updatedMatch.id ? updatedMatch : m));

    // Accepting an offer used to mint a contract here, in the browser: a
    // KNG-CON id from a timestamp, a client id defaulting to 'usr_horizon',
    // a talent name defaulting to 'Chidi Anya', a salary taken from the
    // request budget, and status 'signed', which is not a value
    // contracts_status_check allows. The upsert was rejected every time and
    // the error was logged, so the screen showed a signed contract that did
    // not exist. A contract is drawn up by operations from the agreed terms
    // and signed through the signature flow.
    try {
      const response = await apiFetch('/api/matches', {
        method: 'PATCH',
        body: JSON.stringify({
          matchId: updatedMatch.id,
          status: updatedMatch.status === 'Offer Accepted' ? 'accepted' : updatedMatch.status,
          rejectionReason: updatedMatch.clientRejectionReason || updatedMatch.rejectionReason
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'That decision was not saved.');

      if (payload?.match) {
        setMatches((prev: any[]) => prev.map((m: any) => m.id === updatedMatch.id
          ? { ...m, status: payload.match.status, clientRejectionReason: payload.match.clientRejectionReason }
          : m));
      }

      if (updatedMatch.status === 'Offer Accepted') {
        triggerBanner('Offer accepted. Operations will prepare the contract.', 'success');
      }
    } catch (e: any) {
      console.error("Failed to persist match update", e);
      setMatches(previous);
      triggerBanner(e?.message || 'That decision was not saved.', 'error');
    }
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const performSignOut = async () => {
    setShowSignOutConfirm(false);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out error", e);
    }
    setCurrentUser(null);
    setAuthView(null);
    setClientIntakeActive(false);
    setActiveTab('home');
    triggerBanner('Signed out of Kongila. Authenticate to return.', 'info');
  };

  return (
    <div className="app-shell">
      <Head>
        <title>Kongila — Global Remote Talent Infrastructure</title>
        <meta name="description" content="Sourcing, vetting, and matching premium emerging market talent with clients globally." />
        <link rel="icon" href="/favicon.ico" />
      </Head>


      {/* Clean Toast Notification (replaces dark system alert) */}
      {bannerMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: '#FFFFFF',
          border: '1px solid #DDE2EC',
          borderLeft: `4px solid ${
            bannerType === 'success' ? '#0ABFBC' :
            bannerType === 'error'   ? '#E53E3E' : '#0047CC'
          }`,
          borderRadius: '10px',
          padding: '14px 20px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: '280px',
          maxWidth: '380px',
          animation: 'slideInRight 0.25s ease'
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
            background: bannerType === 'success' ? '#0ABFBC' : bannerType === 'error' ? '#E53E3E' : '#0047CC'
          }} />
          <span style={{ fontSize: '13px', color: '#1A2340', fontWeight: 500, lineHeight: 1.4 }}>
            {bannerMessage}
          </span>
        </div>
      )}

      {/* Sidebar navigation: shown only when on the master Overview Hub page */}
      {currentUser && !authView && !clientIntakeActive && activeTab === 'home' && (
        <div className="sidebar">
          <div className="sidebar-logo">
            <img src="/images/kongilalogo.png" alt="Kongila" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="sidebar-menu">
            <div 
              className="menu-item active"
              onClick={() => setActiveTab('home')}
            >
              <span>🏠</span> Overview Hub
            </div>

            {currentUser.role === 'talent' && (
              <div 
                className="menu-item"
                onClick={() => setActiveTab('talent')}
              >
                <span>👨‍💻</span> Talent Portal
              </div>
            )}

            {currentUser.role === 'client' && (
              <div 
                className="menu-item"
                onClick={() => setActiveTab('client')}
              >
                <span>💼</span> Client Portal
              </div>
            )}
          </div>
          <div className="sidebar-footer">
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AUTHORIZED USER</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginTop: '2px' }}>{currentUser.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>Role: {currentUser.role}</div>
            <div 
              onClick={handleSignOut} 
              style={{ 
                color: 'var(--accent-magenta)', 
                fontSize: '12px', 
                marginTop: '16px', 
                cursor: 'pointer', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>🚪</span> Exit Session
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="main-content" style={{ 
        marginLeft: (currentUser && !authView && !clientIntakeActive && activeTab === 'home') ? '250px' : '0px',
        marginRight: 'auto',
        maxWidth: '100%',
        width: (currentUser && !authView && !clientIntakeActive && activeTab === 'home') ? 'calc(100% - 250px)' : '100%',
        padding: (currentUser && !authView && !clientIntakeActive && activeTab === 'home') ? '40px 48px' : '0px',
        transition: 'var(--transition-smooth)'
      }}>
        
        {/* ====================================================================== */}
        {/* MARKETING HUB & HERO (Shown if not logged in AND not inside intake/auth) */}
        {/* ====================================================================== */}
        {!currentUser && !authView && !clientIntakeActive && (
          /* The public site.
           *
             The marketing pages used to live here as roughly nine hundred lines
             of inline JSX, which is why the nav, the footer and the service-model
             names drifted from the approved copy and from each other. They are
             components now, shared with the standalone routes under /solutions,
             /talent and the rest, so the homepage and every page it links to
             cannot disagree about what Kongila offers or what it is called. */
          <>
            <SiteHeader />
            <HomePage />
            <SiteFooter />
          </>
        )}

        {/* ====================================================================== */}
        {/* CLIENT SMART INTAKE FLOW (Smart Intake FIRST) */}
        {/* ====================================================================== */}
        {clientIntakeActive && (
          <div style={{
            minHeight: '100vh',
            width: '100%',
            backgroundColor: 'var(--bg-primary, #F5F7FA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box'
          }}>
            <SmartIntakeForm
              /* currentUser was missing here, and this is the instance the
                 marketing page renders. Without it the form cannot tell a
                 signed-in client from a visitor: it falls through to
                 `{step === 6 && !currentUser && renderStep6()}` and asks an
                 existing client to sign in or create a second account at the
                 end of a request they have already filled in. The copy inside
                 ClientDashboard always passed it, which is why the same wizard
                 behaved correctly from inside the portal and not from the
                 public page. */
              currentUser={currentUser}
              onComplete={async (created) => {
                // No matching here. The requests go to the admin matching
                // queue, which scores each against the whole vetted pool.
                //
                // A list, because a brief with three roles files three
                // requests. Replace rather than append: a signed-in client
                // reaching this from the marketing page already has their
                // requests loaded, so appending showed the new ones twice
                // until the next refresh.
                const filed = Array.isArray(created) ? created : [created];
                const ids = new Set(filed.map((r: any) => r.id));
                setRequests(prev => [...filed, ...prev.filter(r => !ids.has(r.id))]);

                setClientIntakeActive(false);
                setAuthView(null);
                setActiveTab('client');
                triggerBanner(
                  filed.length > 1
                    ? `${filed.length} service requests created, one for each role`
                    : 'Service Request Created Successfully',
                  'success'
                );
              }}
              onCancel={() => setClientIntakeActive(false)}
            />
          </div>
        )}

        {/* ====================================================================== */}
        {/* UNIFIED AUTHENTICATION VIEWS (Sign-Up / Sign-In / Verification Modal) */}
        {/* ====================================================================== */}
        {/* Auth two-panel: only login / signup / verify — NOT onboarding */}
        {authView === 'verify' && pendingSignup && (
          <EmailVerification
            email={pendingSignup.email}
            onVerified={async () => {
              try {
                await completeSignup(pendingSignup);
              } catch (err: any) {
                triggerBanner(err?.message || 'Could not finish creating your account.', 'error');
                setAuthView('signup');
              }
            }}
            onChangeEmail={() => { setPendingSignup(null); setAuthView('signup'); }}
          />
        )}

        {(authView === 'login' || authView === 'signup') && !clientIntakeActive && (
          <div style={{
            minHeight: '100vh',
            width: '100%',
            display: 'flex',
            backgroundColor: 'var(--bg-secondary, #FFFFFF)'
          }}>
            {/* Left Brand Panel — hidden on mobile */}
            <div className="auth-brand-panel hide-mobile" style={{
              flex: 1.1,
              display: 'flex',
              background: 'radial-gradient(circle at top left, #1E1B4B 0%, #0F0C20 40%, #080711 100%)',
              color: '#FFFFFF',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '60px',
              position: 'relative',
              overflow: 'hidden',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              {/* Subtle Grid Overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 0)',
                backgroundSize: '24px 24px',
                opacity: 0.4,
                zIndex: 1
              }} />

              {/* Glowing Ambient Orbs */}
              <div style={{
                position: 'absolute',
                top: '-10%',
                left: '-10%',
                width: '450px',
                height: '450px',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
                filter: 'blur(60px)',
                borderRadius: '50%',
                zIndex: 1
              }} />
              <div style={{
                position: 'absolute',
                bottom: '-5%',
                right: '-5%',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%)',
                filter: 'blur(80px)',
                borderRadius: '50%',
                zIndex: 1
              }} />

              {/* Logo & Header content */}
              <div style={{ zIndex: 2, position: 'relative' }}>
                <img src="/images/kongilainverted.png" alt="Kongila" style={{ height: '48px', width: 'auto', objectFit: 'contain' }} />
                <h1 style={{ 
                  marginTop: '36px', 
                  fontSize: '34px', 
                  fontWeight: 900, 
                  lineHeight: 1.25,
                  letterSpacing: '-0.03em',
                  fontFamily: 'var(--font-display)',
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 60%, #CBD5E1 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  The premium infrastructure for global workforce operations.
                </h1>
                <p style={{ marginTop: '16px', fontSize: '15px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, maxWidth: '440px' }}>
                  Securely hire, manage, and deploy top-tier operational talent around the world, completely compliance-free.
                </p>

                {/* Elegant Micro Badges (instead of colored emojis) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '32px' }}>
                  {[
                    { label: 'EOR & Global Payroll in 140+ countries' },
                    { label: '100% Automated Compliance & Document Vetting' },
                    { label: 'Integrated Smart Sourcing Vetting Engine' }
                  ].map((badge, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)'
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{badge.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Gorgeous Floating Interactive Mockup Card */}
              <div style={{
                zIndex: 2,
                position: 'relative',
                margin: '40px 0',
                padding: '24px',
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 30px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                transform: 'perspective(1000px) rotateX(4deg) rotateY(-4deg)',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10B981',
                      boxShadow: '0 0 12px #10B981',
                      animation: 'pulse 2s infinite'
                    }} />
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Compliance Shield Active</span>
                  </div>
                  <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 }}>v3.4.1</span>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>99.98%</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', fontWeight: 600 }}>Operational Match Accuracy</div>
                  </div>
                  <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '16px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#818CF8', letterSpacing: '-0.02em' }}>&lt; 24h</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', fontWeight: 600 }}>Vetting to Deployment</div>
                  </div>
                </div>

                {/* Simulated Mini Vetting List */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                  {['Verified Tax Compliance', 'NDA Executed', 'EOR Payout Cleared'].map((vet, idx) => (
                    <span key={idx} style={{
                      fontSize: '10px',
                      background: 'rgba(129, 140, 248, 0.08)',
                      color: '#A5B4FC',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(129, 140, 248, 0.15)',
                      fontWeight: 600
                    }}>
                      {vet}
                    </span>
                  ))}
                </div>
              </div>
              
              <div style={{ zIndex: 2, position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>© {new Date().getFullYear()} Kongila Global Inc.</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>Privacy Policy</span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>Terms of Service</span>
                </div>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="auth-form-panel" style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-secondary, #FFFFFF)'
            }}>
              <div style={{ maxWidth: '400px', width: '100%' }}>
            
            {/* View: Auth Role Selector or Signup */}
            {authView === 'signup' && (
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
                  Join Kongila
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                  {clientNeedsIntake
                    ? 'Kongila client accounts are company accounts, and they start with a request.'
                    : 'Access premium remote EOR opportunities globally.'}
                </p>



                {/* A client without an invitation does not sign up here. The
                    account is created for a company, and the company record is
                    built from what the intake form collects, so sending them
                    through this form produced a thinner organisation with no
                    position, no phone and sometimes no real company name. One
                    door in, one shape of organisation out. */}
                {clientNeedsIntake && (
                  <div>
                    <div style={{
                      background: 'rgba(0, 71, 204, 0.06)',
                      border: '1px solid rgba(0, 71, 204, 0.18)',
                      borderRadius: '10px',
                      padding: '16px 18px',
                      marginBottom: '20px',
                      lineHeight: 1.6
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        Tell us what you need first
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        We set the account up for your company at the end of the request, and you become its primary contact and administrator. It takes a couple of minutes, and you can invite colleagues afterwards.
                      </div>
                    </div>
                    <NeonButton
                      onClick={() => {
                        setAuthView(null);
                        setClientIntakeActive(true);
                        setClientIntakeStep(1);
                      }}
                      style={{ width: '100%' }}
                    >
                      Start a request
                    </NeonButton>
                    <div style={{ fontSize: '12px', textAlign: 'center', marginTop: '16px', color: 'var(--text-secondary)' }}>
                      Joining a company that already uses Kongila? Ask their primary contact to invite you from My Company.
                    </div>
                  </div>
                )}

                {/* Form */}
                {!clientNeedsIntake && (
                <form onSubmit={handleSignUpSubmit}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      placeholder="e.g. Tariq Ibrahim"
                    />
                  </div>

                  {/* An invited colleague is joining a company that already
                      exists. This used to be an editable Company Name field,
                      and provisioning ignored whatever they typed in favour of
                      the organisation inside the signed token, so the form
                      could show one company while creating a membership of
                      another. It states the company instead. */}
                  {authRole === 'client' && inviteTokenRaw && (
                    <div style={{
                      background: 'rgba(0, 71, 204, 0.06)',
                      border: '1px solid rgba(0, 71, 204, 0.18)',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        You are joining
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {inviteOrgName || 'your colleague’s company'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.6 }}>
                        {invitePermission
                          ? `You were invited with ${invitePermission} access. The company's primary contact can change that later.`
                          : 'Your access level was set by whoever invited you.'}
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      placeholder="e.g. tariq@gmail.com"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        className="form-input" 
                        value={passwordInput}
                        onChange={e => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        style={{ paddingRight: '60px' }}
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
                          color: 'var(--text-secondary, #6B7A99)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '4px',
                        }}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%',
                      background: loading ? '#7BA8E8' : '#0047CC',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      height: '42px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      marginTop: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {loading ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Creating Account...
                      </>
                    ) : 'Create Account'}
                  </button>
                </form>
                )}

                <div style={{ fontSize: '12px', textAlign: 'center', marginTop: '24px', color: 'var(--text-secondary)' }}>
                  Already have an account? <span style={{ color: 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setAuthView('login')}>Sign In</span>
                </div>
              </div>
            )}

            {/* View: Auth Sign In */}
            {authView === 'login' && (
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
                  Access Portal
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                  Sign in with authorization credentials to return to workspaces.
                </p>

                <form onSubmit={handleLoginSubmit}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      placeholder="e.g. client@vanguard.com or talent@kongila.dev"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        className="form-input" 
                        value={passwordInput}
                        onChange={e => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        style={{ paddingRight: '60px' }}
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
                          color: 'var(--text-secondary, #6B7A99)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '4px',
                        }}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%',
                      background: loading ? '#7BA8E8' : '#0047CC',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      height: '42px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      marginTop: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {loading ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Signing In...
                      </>
                    ) : 'Sign In'}
                  </button>
                </form>

                <div style={{ fontSize: '12px', textAlign: 'center', marginTop: '24px', color: 'var(--text-secondary)' }}>
                  Don't have an account? <span style={{ color: 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setAuthView('signup'); setAuthRole('talent'); }}>Sign Up</span>
                </div>
              </div>
            )}





              </div>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* TALENT PROGRESSIVE ONBOARDING WIZARD (Full Screen when active) */}
        {/* ====================================================================== */}
        {currentUser && authView === 'onboarding' && (
          <GlassCard style={{ maxWidth: '700px', margin: '40px auto', padding: '32px', paddingBottom: '250px', overflow: 'visible' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🧙‍♂️</span>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Talent Onboarding Wizard</h2>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Step {talentWizardStep} of 5</div>
            </div>

            {/* Wizard Steps Timeline */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
              {[1, 2, 3, 4, 5].map(s => (
                <div 
                  key={s} 
                  style={{
                    flex: 1, 
                    height: '4px', 
                    borderRadius: '2px', 
                    background: talentWizardStep >= s ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                    boxShadow: talentWizardStep >= s ? '0 0 8px var(--accent-cyan-glow)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>

            {/* Step 1: Basic Profile */}
            {talentWizardStep === 1 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>1. Personal Information</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>We use this to verify your identity and personalize your dashboard experience.</p>

                <div className="form-group">
                  <label className="form-label">Profile Photo<Required /></label>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: '#1F2937',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '22px'
                    }}>
                      {talentOnboardingData.profilePhotoUrl ? (
                        <img src={talentOnboardingData.profilePhotoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        talentOnboardingData.fullName?.[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    <label style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-glass)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '13px'
                    }}>
                      {talentOnboardingData.profilePhotoName ? 'Replace Photo' : 'Upload Photo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePhotoUpload} />
                    </label>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      JPG or PNG, at least 200x200px, under 2MB.
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name<Required /></label>
                  {talentOnboardingData.fullName ? (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-glass)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 700
                    }}>
                      {talentOnboardingData.fullName}
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      className="form-input" 
                      value={talentOnboardingData.fullName}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, fullName: e.target.value })}
                      placeholder="Chidi Anya"
                    />
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Phone Number<Required /></label>
                  <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                    {/* Phone code searchable dropdown */}
                    <div style={{ position: 'relative', width: '140px', flexShrink: 0 }}>
                      <div
                        className="form-input"
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', paddingRight: '10px' }}
                        onClick={() => { setShowPhoneCodeDropdown(v => !v); setPhoneCodeSearch(''); }}
                      >
                        <span style={{ fontWeight: 600 }}>{talentOnboardingData.phoneCode || '+?'}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                      {showPhoneCodeDropdown && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '10px', marginTop: '4px', width: '260px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
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
                                  onMouseDown={() => { setTalentOnboardingData({ ...talentOnboardingData, phoneCode: c.code }); setShowPhoneCodeDropdown(false); }}
                                  style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-glass)' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <span>{c.name}</span>
                                  <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{c.code}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={talentOnboardingData.phone}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, phone: e.target.value })}
                      placeholder="e.g. 803 929 1827"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Country<Required /></label>
                    {/* Searchable country dropdown */}
                    <div style={{ position: 'relative' }}>
                      <div
                        className="form-input"
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onClick={() => { setShowCountryDropdown(v => !v); setCountrySearch(''); }}
                      >
                        <span style={{ color: talentOnboardingData.country ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {talentOnboardingData.country || 'Select a country'}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                      {showCountryDropdown && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '10px', marginTop: '4px', width: '100%', minWidth: '240px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                          <div style={{ padding: '8px' }}>
                            <input
                              autoFocus
                              type="text"
                              className="form-input"
                              style={{ width: '100%', boxSizing: 'border-box' }}
                              placeholder="Search country…"
                              value={countrySearch}
                              onChange={e => setCountrySearch(e.target.value)}
                            />
                          </div>
                          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                            {COUNTRIES_AND_CODES
                              .filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
                              .map(c => (
                                <div
                                  key={c.name}
                                  onMouseDown={() => {
                                    setTalentOnboardingData({ ...talentOnboardingData, country: c.name, phoneCode: c.code });
                                    setShowCountryDropdown(false);
                                  }}
                                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-glass)' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  {c.name}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">City<Required /></label>
                    <input
                      type="text"
                      className="form-input"
                      value={talentOnboardingData.city}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, city: e.target.value })}
                      placeholder="e.g. Lagos"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Date of Birth<Required /></label>
                  <input type="date" className="form-input" value={talentOnboardingData.dateOfBirth} onChange={e => setTalentOnboardingData({ ...talentOnboardingData, dateOfBirth: e.target.value })} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Gender<Required /></label>
                    <select className="form-input" value={talentOnboardingData.gender} onChange={e => setTalentOnboardingData({ ...talentOnboardingData, gender: e.target.value })}>
                      <option value="">Select gender</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Non-binary</option>
                      <option>Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Nationality</label>
                    <input type="text" className="form-input" value={talentOnboardingData.nationality} onChange={e => setTalentOnboardingData({ ...talentOnboardingData, nationality: e.target.value })} placeholder="e.g. Nigerian" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Timezone Alignment<Required /></label>
                  {/* Searchable timezone dropdown.
                      The list used to be a local array of strings with the
                      offset inside the value, so what got stored was
                      "Africa/Lagos (GMT+1)" rather than "Africa/Lagos". That
                      is not a zone Intl or Postgres recognises, which is why
                      interview times could not be converted into a
                      candidate's local time. It now reads the shared list and
                      stores the IANA name, showing the readable label. */}
                  {(() => {
                    const query = timezoneSearch.trim().toLowerCase();
                    const filtered = TIMEZONE_OPTIONS.filter(tz =>
                      !query || tz.label.toLowerCase().includes(query) || tz.value.toLowerCase().includes(query)
                    );
                    const selected = TIMEZONE_OPTIONS.find(tz => tz.value === talentOnboardingData.timezone);
                    return (
                      <div style={{ position: 'relative' }}>
                        <div
                          className="form-input"
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                          onClick={() => { setShowTimezoneDropdown(v => !v); setTimezoneSearch(''); }}
                        >
                          <span style={{ color: talentOnboardingData.timezone ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {selected?.label || talentOnboardingData.timezone || 'Select your timezone'}
                          </span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                        {showTimezoneDropdown && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '10px', marginTop: '4px', width: '100%', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                            <div style={{ padding: '8px' }}>
                              <input
                                autoFocus
                                type="text"
                                className="form-input"
                                style={{ width: '100%', boxSizing: 'border-box' }}
                                placeholder="Search timezone…"
                                value={timezoneSearch}
                                onChange={e => setTimezoneSearch(e.target.value)}
                              />
                            </div>
                            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                              {filtered.map(tz => (
                                <div
                                  key={tz.value}
                                  onMouseDown={() => { setTalentOnboardingData({ ...talentOnboardingData, timezone: tz.value }); setShowTimezoneDropdown(false); }}
                                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-glass)' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div style={{ fontWeight: 600 }}>{tz.label}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tz.value}</div>
                                </div>
                              ))}
                              {filtered.length === 0 && (
                                <div style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>No results</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {wizardStepErrors.length > 0 && talentWizardStep === 1 && (
                  <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: '13px' }}>
                    <strong>Please complete the following fields before continuing:</strong>
                    <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
                      {wizardStepErrors.map(e => <li key={e}>{e}</li>)}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <NeonButton variant="ghost" onClick={handleSignOut}>Exit Onboarding</NeonButton>
                  <NeonButton onClick={() => advanceStep(2)}>Continue</NeonButton>
                </div>
              </div>
            )}

            {/* Step 2: Professional Info */}
            {talentWizardStep === 2 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>2. Professional Details</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Tell us about your current role, specialization, and seniority.</p>

                <div className="form-group">
                  <label className="form-label">Primary Professional Title<Required /></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.primaryRole}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, primaryRole: e.target.value })}
                    placeholder="e.g. Senior Operations Manager"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Primary Role Category<Required /></label>
                    <select
                      className="form-input"
                      value={talentOnboardingData.primaryRoleCategory}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, primaryRoleCategory: e.target.value })}
                    >
                      <option value="">Select category</option>
                      <option>Operations</option>
                      <option>Product</option>
                      <option>Engineering</option>
                      <option>Design</option>
                      <option>Marketing</option>
                      <option>Finance</option>
                      <option>Sales</option>
                      <option>Support</option>
                      <option>Project Management</option>
                      <option>Administration</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Seniority Level<Required /></label>
                    <select
                      className="form-input"
                      value={talentOnboardingData.seniorityLevel}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, seniorityLevel: e.target.value })}
                    >
                      <option value="">Select level</option>
                      {SENIORITY_LEVELS.map(s => (
                        <option key={s.label} value={s.label}>
                          {s.label} ({s.min}–{s.max === 99 ? '12+' : s.max} yrs)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Years of Relevant Experience<Required /></label>
                  {(() => {
                    const yrs = Number(talentOnboardingData.yearsExperience);
                    const range = getSeniorityRange(talentOnboardingData.seniorityLevel);
                    const outOfRange = range && talentOnboardingData.yearsExperience !== '' && (yrs < range.min || yrs > range.max);
                    return (
                      <>
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          value={talentOnboardingData.yearsExperience}
                          onChange={e => setTalentOnboardingData({ ...talentOnboardingData, yearsExperience: e.target.value })}
                          placeholder="e.g. 5"
                          style={{ borderColor: outOfRange ? '#EF4444' : undefined }}
                        />
                        {range && (
                          <div style={{ fontSize: '12px', marginTop: '5px', color: outOfRange ? '#EF4444' : 'var(--text-muted)' }}>
                            {outOfRange
                              ? `⚠ ${talentOnboardingData.seniorityLevel} expects ${range.min}–${range.max === 99 ? '12+' : range.max} years.`
                              : `Expected range for ${talentOnboardingData.seniorityLevel}: ${range.min}–${range.max === 99 ? '12+' : range.max} years.`}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="form-group">
                  <label className="form-label">Short Bio<Required /></label>
                  <textarea
                    className="form-input"
                    rows={4}
                    maxLength={500}
                    value={talentOnboardingData.bio}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, bio: e.target.value })}
                    placeholder="Write a short professional summary (max 500 characters)"
                  />
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {talentOnboardingData.bio.length}/500
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Skills<Required /></label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'var(--bg-tertiary)', minHeight: '42px', alignItems: 'center' }}>
                      {talentOnboardingData.skills.map(s => (
                        <span key={s} style={{ background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', padding: '6px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{s}</span>
                          <select
                            value={talentOnboardingData.skillLevels[s] || 'Intermediate'}
                            onChange={e => setTalentOnboardingData({
                              ...talentOnboardingData,
                              skillLevels: { ...talentOnboardingData.skillLevels, [s]: e.target.value as 'Beginner' | 'Intermediate' | 'Expert' }
                            })}
                            style={{ border: 'none', background: 'rgba(255,255,255,0.4)', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, color: '#0F172A' }}
                          >
                            <option>Beginner</option>
                            <option>Intermediate</option>
                            <option>Expert</option>
                          </select>
                          <button onClick={() => setTalentOnboardingData({
                            ...talentOnboardingData,
                            skills: talentOnboardingData.skills.filter(sk => sk !== s),
                            skillLevels: Object.fromEntries(Object.entries(talentOnboardingData.skillLevels).filter(([key]) => key !== s))
                          })} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: '14px', lineHeight: 1 }}>&times;</button>
                        </span>
                      ))}
                      <input 
                        type="text" 
                        value={skillSearch}
                        onChange={e => { setSkillSearch(e.target.value); setShowSkillDropdown(true); }}
                        onFocus={() => setShowSkillDropdown(true)}
                        onBlur={() => setTimeout(() => setShowSkillDropdown(false), 200)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && skillSearch.trim()) {
                            e.preventDefault();
                            if (!talentOnboardingData.skills.includes(skillSearch.trim()) && talentOnboardingData.skills.length < 5) {
                              setTalentOnboardingData({
                                ...talentOnboardingData,
                                skills: [...talentOnboardingData.skills, skillSearch.trim()],
                                skillLevels: { ...talentOnboardingData.skillLevels, [skillSearch.trim()]: 'Intermediate' }
                              });
                            }
                            setSkillSearch('');
                            setShowSkillDropdown(false);
                          }
                        }}
                        placeholder={talentOnboardingData.skills.length === 0 ? "Type and press Enter to add..." : ""}
                        style={{ flex: 1, minWidth: '150px', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }}
                      />
                    </div>
                    {showSkillDropdown && skillSearch.trim() && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '8px', marginTop: '4px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                        {SUGGESTED_SKILLS
                          .filter(s => s.toLowerCase().includes(skillSearch.toLowerCase()) && !talentOnboardingData.skills.includes(s))
                          .slice(0, 10)
                          .map(s => (
                            <div 
                              key={s} 
                              onClick={() => {
                                if (talentOnboardingData.skills.length < 5) {
                                  setTalentOnboardingData({
                                    ...talentOnboardingData,
                                    skills: [...talentOnboardingData.skills, s],
                                    skillLevels: { ...talentOnboardingData.skillLevels, [s]: 'Intermediate' }
                                  });
                                }
                                setSkillSearch('');
                                setShowSkillDropdown(false);
                              }}
                              style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-glass)', fontSize: '14px', color: 'var(--text-primary)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {s}
                            </div>
                          ))}
                          {skillSearch.trim() && !talentOnboardingData.skills.includes(skillSearch.trim()) && (
                             <div 
                                onClick={() => {
                                  if (talentOnboardingData.skills.length < 5) {
                                    setTalentOnboardingData({
                                      ...talentOnboardingData,
                                      skills: [...talentOnboardingData.skills, skillSearch.trim()],
                                      skillLevels: { ...talentOnboardingData.skillLevels, [skillSearch.trim()]: 'Intermediate' }
                                    });
                                  }
                                  setSkillSearch('');
                                  setShowSkillDropdown(false);
                                }}
                                style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '14px', color: 'var(--kongila-blue)', fontWeight: 600 }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                Add "{skillSearch.trim()}"
                              </div>
                          )}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Up to 5 primary skills. Each skill includes a proficiency level.
                  </div>
                </div>
                {talentOnboardingData.skills.length >= 5 && (
                  <div style={{ fontSize: '12px', color: '#FBBF24', marginTop: '-8px', marginBottom: '8px' }}>
                    You have reached the primary skills limit.
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Secondary Skills</label>
                  <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      {selectedSecondarySkills.map(skill => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSecondarySkill(skill)}
                          style={{
                            background: 'rgba(0, 71, 204, 0.14)',
                            color: '#fff',
                            border: '1px solid rgba(0, 71, 204, 0.35)',
                            borderRadius: '999px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {skill} ×
                        </button>
                      ))}
                      {selectedSecondarySkills.length === 0 && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Pick up to 10 soft skills.
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      value={secondarySkillSearch}
                      onChange={e => setSecondarySkillSearch(e.target.value)}
                      placeholder="Search or add a soft skill"
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                      {SECONDARY_SKILL_OPTIONS
                        .filter(skill => skill.toLowerCase().includes(secondarySkillSearch.toLowerCase()) && !selectedSecondarySkills.includes(skill))
                        .slice(0, 18)
                        .map(skill => (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => {
                              toggleSecondarySkill(skill);
                              setSecondarySkillSearch('');
                            }}
                            style={{
                              background: 'transparent',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-glass)',
                              borderRadius: '999px',
                              padding: '8px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            + {skill}
                          </button>
                        ))}
                      {secondarySkillSearch.trim() && !SECONDARY_SKILL_OPTIONS.some(skill => skill.toLowerCase() === secondarySkillSearch.trim().toLowerCase()) && !selectedSecondarySkills.includes(secondarySkillSearch.trim()) && selectedSecondarySkills.length < 10 && (
                        <button
                          type="button"
                          onClick={() => {
                            toggleSecondarySkill(secondarySkillSearch.trim());
                            setSecondarySkillSearch('');
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--accent-cyan)',
                            border: '1px solid rgba(0,255,204,0.25)',
                            borderRadius: '999px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Add "{secondarySkillSearch.trim()}"
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Select up to 10 secondary soft skills.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Employment Pref<Required /></label>
                  <select 
                    className="form-select"
                    value={talentOnboardingData.employmentPreference}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, employmentPreference: e.target.value })}
                  >
                    <option value="">Select preference...</option>
                    <option>Full Time</option>
                    <option>Part Time</option>
                    <option>Hourly / Contract</option>
                  </select>
                </div>

                {wizardStepErrors.length > 0 && talentWizardStep === 2 && (
                  <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: '13px' }}>
                    <strong>Please complete the following fields before continuing:</strong>
                    <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
                      {wizardStepErrors.map(e => <li key={e}>{e}</li>)}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <NeonButton variant="secondary" onClick={() => { setWizardStepErrors([]); setTalentWizardStep(1); window.scrollTo({ top: 0, behavior: 'instant' }); }}>Back</NeonButton>
                  <NeonButton onClick={() => advanceStep(3)}>Continue</NeonButton>
                </div>
              </div>
            )}

            {/* Step 3: Compensation */}
            {talentWizardStep === 3 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>3. Pay &amp; Availability</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>What you expect to be paid and how soon you can start. Every field here is required.</p>

                {/* Preferred Engagement Type was here. It duplicated the
                    Employment Preference question in step 2, and the matching
                    engine already reads employmentPreference. */}

                <div className="form-group">
                  <label className="form-label">Notice Period<Required /></label>
                  <select
                    className="form-select"
                    value={talentOnboardingData.noticePeriod}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, noticePeriod: e.target.value })}
                  >
                    <option value="">Select notice period</option>
                    {NOTICE_PERIOD_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                {/* Preferred Project Type was here. It was free text nothing
                    read: no screen displayed it to operations and no part of
                    matching scored on it. */}

                <div className="form-group">
                  <label className="form-label">Expected Salary Format<Required /></label>
                  <select
                    className="form-select"
                    value={talentOnboardingData.hourlyMonthly}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, hourlyMonthly: e.target.value })}
                  >
                    <option value="Hourly">Hourly (per hour)</option>
                    <option value="Monthly">Monthly (per month)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Salary Range Min<Required /></label>
                    <input
                      type="number"
                      className="form-input"
                      value={talentOnboardingData.salaryExpectationMin}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, salaryExpectationMin: e.target.value })}
                      placeholder="e.g. 3500"
                    />
                  </div>
                  <div>
                    <label className="form-label">Salary Range Max<Required /></label>
                    <input
                      type="number"
                      className="form-input"
                      value={talentOnboardingData.salaryExpectationMax}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, salaryExpectationMax: e.target.value })}
                      placeholder="e.g. 5000"
                    />
                  </div>
                  <div>
                    <label className="form-label">Currency<Required /></label>
                    <select 
                      className="form-select"
                      value={talentOnboardingData.currency}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, currency: e.target.value, currencyTouched: true })}
                    >
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {talentOnboardingData.currencyTouched
                        ? 'You chose this currency.'
                        : `Defaulted from ${talentOnboardingData.country || 'your country'}. Change it if you are paid in another currency.`}
                    </div>
                  </div>
                </div>

                {wizardStepErrors.length > 0 && talentWizardStep === 3 && (
                  <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: '13px' }}>
                    <strong>Please complete the following fields before continuing:</strong>
                    <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
                      {wizardStepErrors.map(e => <li key={e}>{e}</li>)}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <NeonButton variant="secondary" onClick={() => { setWizardStepErrors([]); setTalentWizardStep(2); window.scrollTo({ top: 0, behavior: 'instant' }); }}>Back</NeonButton>
                  <NeonButton onClick={() => advanceStep(4)}>Continue</NeonButton>
                </div>
              </div>
            )}

            {/* Step 4: Documents (Supabase Storage upload progress) */}
            {talentWizardStep === 4 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>4. Documents & Links</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Upload the mandatory CV and add any supporting certification or portfolio links.</p>

                {/* The heading here was #fff on --bg-tertiary, which reads as
                    white on near-white: the card showed an icon and an upload
                    button and never said what to upload. Both lines now use
                    the theme's own text colours. */}
                <div className="form-group" style={{ background: 'var(--bg-tertiary)', padding: '24px', borderRadius: '10px', textAlign: 'center', border: '1.5px dashed var(--border-glass)' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>📁</span>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Curriculum Vitae (CV / Résumé)<Required />
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Upload your CV as a PDF. This is what Kongila reviews first and what a client sees once you are shortlisted.
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '16px' }}>PDF only. Max 5MB.</div>

                  {uploadProgress > 0 && (
                    <div style={{ width: '100%', background: 'var(--bg-primary)', height: '6px', borderRadius: '3px', margin: '16px 0', overflow: 'hidden' }}>
                      <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent-cyan)', boxShadow: '0 0 10px var(--accent-cyan-glow)', transition: 'width 0.2s ease' }} />
                    </div>
                  )}

                  <label
                    style={{
                      display: 'inline-block',
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--border-glass)', 
                      padding: '10px 24px', 
                      borderRadius: '8px', 
                      color: 'var(--text-secondary)', 
                      fontWeight: 600, 
                      cursor: mockUploading ? 'not-allowed' : 'pointer',
                      opacity: mockUploading ? 0.5 : 1
                    }}
                  >
                    {mockUploading ? 'Uploading...' : talentOnboardingData.cvName ? 'Replace Document' : 'Select PDF to Upload'}
                    <input 
                      type="file" 
                      accept=".pdf,application/pdf" 
                      style={{ display: 'none' }} 
                      onChange={handleCvUpload} 
                      disabled={mockUploading} 
                    />
                  </label>
                  
                  {talentOnboardingData.cvName && !mockUploading && (
                    <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--accent-cyan)' }}>
                      ✓ {talentOnboardingData.cvName.split('-cv-').pop()} uploaded successfully
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Portfolio Link</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.portfolioUrl}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, portfolioUrl: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">LinkedIn URL<Required /></label>
                  <input 
                    type="url" 
                    className="form-input" 
                    value={talentOnboardingData.linkedInUrl}
                    placeholder="https://linkedin.com/in/your-profile"
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, linkedInUrl: e.target.value })}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Paste the full address of your profile, starting with https://
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">GitHub URL</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.githubUrl}
                    placeholder="https://github.com/your-handle"
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, githubUrl: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Personal Website URL</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.websiteUrl}
                    placeholder="https://yourwebsite.com"
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, websiteUrl: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Certifications Uploads</label>
                  <label style={{
                    display: 'inline-block',
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid var(--border-glass)', 
                    padding: '10px 24px', 
                    borderRadius: '8px', 
                    color: 'var(--text-secondary)', 
                    fontWeight: 600, 
                    cursor: 'pointer',
                  }}>
                    Upload Certifications
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      multiple
                      style={{ display: 'none' }} 
                      onChange={handleCertificationUpload} 
                    />
                  </label>
                  {talentOnboardingData.certificationFiles.length > 0 && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {talentOnboardingData.certificationFiles.map(file => (
                        <div key={file.url} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{file.name}</div>
                      ))}
                    </div>
                  )}
                </div>

                {wizardStepErrors.length > 0 && talentWizardStep === 4 && (
                  <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: '13px' }}>
                    <strong>Please complete the following fields before continuing:</strong>
                    <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
                      {wizardStepErrors.map(e => <li key={e}>{e}</li>)}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <NeonButton variant="secondary" onClick={() => { setWizardStepErrors([]); setTalentWizardStep(3); window.scrollTo({ top: 0, behavior: 'instant' }); }}>Back</NeonButton>
                  <NeonButton onClick={() => advanceStep(5)}>Continue to Finalization</NeonButton>
                </div>
              </div>
            )}

            {/* The Remote Readiness step was step 5. It asked four free-text
                questions about internet, power, devices and collaboration
                tools. No screen showed the answers to operations, no vetting
                stage checked them and matching never read them, so it was four
                boxes between a candidate and a finished profile. */}

            {/* Step 5: Finalization */}
            {talentWizardStep === 5 && (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: '72px', marginBottom: '24px', color: 'var(--accent-green)', textShadow: '0 0 20px rgba(51, 255, 87, 0.4)' }}>✓</div>
                <h3 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px' }}>You're All Set!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, maxWidth: '450px', margin: '0 auto 32px auto' }}>
                  Your profile and documents have been successfully securely uploaded. Click <strong>Complete Onboarding</strong> below to access your dashboard and begin your verification process.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                  <NeonButton variant="secondary" onClick={() => { setWizardStepErrors([]); setTalentWizardStep(4); window.scrollTo({ top: 0, behavior: 'instant' }); }}>Review Setup</NeonButton>
                  <button 
                    type="button" 
                    onClick={handleTalentWizardSubmit}
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-green), #2db33d)', 
                      color: '#000', 
                      border: 'none', 
                      borderRadius: '8px', 
                      height: '44px', 
                      padding: '0 32px', 
                      fontSize: '15px', 
                      fontWeight: 700, 
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.8 : 1,
                      boxShadow: '0 4px 15px rgba(51, 255, 87, 0.3)',
                      transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(51, 255, 87, 0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(51, 255, 87, 0.3)'; }}
                  >
                    {loading ? 'Completing...' : 'Complete Onboarding'}
                  </button>
                </div>
              </div>
            )}

          </GlassCard>
        )}

        {currentUser && authView === 'onboarding' && loading && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2500,
              background: 'rgba(8, 15, 36, 0.72)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '360px',
                background: 'linear-gradient(180deg, rgba(10,18,44,0.98), rgba(23,37,84,0.98))',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '28px',
                textAlign: 'center',
                boxShadow: '0 24px 80px rgba(0,0,0,0.45)'
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  margin: '0 auto 16px',
                  borderRadius: '50%',
                  border: '4px solid rgba(255,255,255,0.12)',
                  borderTopColor: 'var(--accent-cyan)',
                  animation: 'spin 0.9s linear infinite'
                }}
              />
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                Completing onboarding
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
                We’re saving your profile, syncing Supabase, and preparing your dashboard.
              </div>
            </div>
          </div>
        )}


        {/* ====================================================================== */}
        {/* FULL PORTALS: ACTIVE OVERVIEW HUB (Shown if logged in & vetted/complete) */}
        {/* ====================================================================== */}
        {currentUser && !authView && !clientIntakeActive && activeTab === 'home' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Global Remote Workforce Infrastructure</h1>
                <p className="page-subtitle">Connecting vetted African talent with operational systems globally.</p>
              </div>
            </div>

            <GlassCard style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '24px', marginBottom: '16px', background: 'linear-gradient(135deg, #fff, var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Two Ecosystems, One Master Operations Core
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '800px' }}>
                Kongila acts as your global Talent Onboarding, Vetting, Matching, and Employer of Record infrastructure.
                Once hired, talent runs under Remotan Work OS—a subscription SaaS operational engine which automates execution, schedules daily tasks, balances workloads, monitors time sheets, and assesses quality.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '20px', borderRadius: '12px' }}>
                  <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>Kongila = Acquisition</h3>
                  <ul style={{ listStyle: 'none', color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>✓ 7-Stage Specialized Vetting Framework</li>
                    <li>✓ Skill, Personality, and Work Simulation Scoring</li>
                    <li>✓ Smart Role Intakes & Radar Matching Engine</li>
                    <li>✓ Automated NDA & Contract e-Signature generation</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '20px', borderRadius: '12px' }}>
                  <h3 style={{ color: 'var(--accent-green)', marginBottom: '10px' }}>Remotan = Work Execution</h3>
                  <ul style={{ listStyle: 'none', color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>✓ Real-Time Multi-Agent Task Orchestrations</li>
                    <li>✓ Interactive Kanban Board with Blocker escalations</li>
                    <li>✓ Time Tracking timer & Screenshot Activity logs</li>
                    <li>✓ Automatic PIP Warnings for drop in performance</li>
                  </ul>
                </div>
              </div>
            </GlassCard>

            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Major Service Lines</h2>
            <div className="service-card-grid">
              <div className="service-card">
                <div className="service-icon">🛡️</div>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Managed Workforce</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Kongila fully manages performance, pays, and replaces talent. High operational supervision.</p>
              </div>
              <div className="service-card">
                <div className="service-icon">⚡</div>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Talent Outsourcing</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Kongila pays talent; client manages execution directly with lighter platform oversight.</p>
              </div>
              <div className="service-card">
                <div className="service-icon">🔍</div>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Placement / Augment</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pure recruiting infrastructure. Recommended shortlist. Client hires/pays directly.</p>
              </div>
              <div className="service-card">
                <div className="service-icon">📋</div>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Project Execution</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Direct delivery management. Client defines scopes and prepays project milestones.</p>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* FULL PORTALS: ACTIVE TALENT WORKSPACE                                  */}
        {/* ====================================================================== */}
        {currentUser && currentUser.role === 'talent' && !authView && !clientIntakeActive && activeTab === 'talent' && !dataReady && (
          <MascotLoader message="Loading your workspace" />
        )}

        {currentUser && currentUser.role === 'talent' && !authView && !clientIntakeActive && activeTab === 'talent' && dataReady && (
          <TalentDashboard
            currentUser={currentUser}
            talentProfile={getCurrentTalentProfile()}
            supportTickets={supportTickets}
            setSupportTickets={setSupportTickets}
            contracts={contracts}
            matches={matches}
            clientRequests={requests}
            allDocuments={documents}
            interviews={interviews}
            onInterviewUpdate={(interviewId, changes) => setInterviews(previous =>
              previous.map(interview => interview.id === interviewId
                ? { ...interview, ...changes }
                : interview
              )
            )}
            offers={talentOffers}
            onRespondToOffer={handleRespondToOffer}
            dashboardNotifications={notifications}
            setDashboardNotifications={setNotifications}
            assessments={assessments}
            assessmentCategories={assessmentCategories}
            assessmentQuestions={assessmentQuestions}
            talentSkillAssessments={talentSkillAssessments}
            skillAssessmentResults={skillAssessmentResults}
            workSimulationTasks={workSimulationTasks}
            onSignOut={handleSignOut}
            onUpdateProfile={handleUpdateProfile}
            onUpdateMatch={handleUpdateMatch}
            onUpdateDocument={async (updatedDoc) => {
              const updatedDocs = documents.map((d: any) => d.id === updatedDoc.id ? updatedDoc : d);
              setDocuments(updatedDocs);
              
              try {
                // Through the server, which checks the document belongs to
                // the caller. The browser upsert wrote the whole row,
                // user_id and status included, to a table with RLS off.
                const response = await apiFetch('/api/documents', {
                  method: 'PATCH',
                  body: JSON.stringify({
                    docId: updatedDoc.id,
                    updates: {
                      name: updatedDoc.name,
                      file_name: updatedDoc.fileName || updatedDoc.name || null,
                      type: updatedDoc.type || undefined,
                      file_url: updatedDoc.fileUrl || null,
                      certification_name: updatedDoc.certificationName || null,
                      issuing_body: updatedDoc.issuingBody || null,
                      issue_date: updatedDoc.issueDate || null,
                      expiry_date: updatedDoc.expiryDate || null,
                      is_hidden: updatedDoc.isHidden || false,
                      description: updatedDoc.description || null
                    }
                  })
                });

                if (!response.ok) {
                  const detail = await response.json().catch(() => ({}));
                  throw new Error(detail?.error || 'That document was not saved.');
                }
              } catch (e: any) {
                console.error("Failed to update document", e);
                triggerBanner(e?.message || "That document was not saved.", "error");
              }
            }}
            onSubmitAssessment={async (result: any) => {
              const profile = getCurrentTalentProfile();
              let exists = false;
              const updatedTSAs = talentSkillAssessments.map((tsa: any) => {
                if (tsa.id === result.talentSkillAssessmentId) {
                  exists = true;
                  return { ...tsa, status: 'submitted', score: result.autoScore, submittedAt: result.submittedAt };
                }
                return tsa;
              });
              
              if (!exists) {
                updatedTSAs.push({
                  id: result.talentSkillAssessmentId,
                  talentId: profile?.id || result.talentId,
                  talent_id: profile?.id || result.talentId,
                  assessmentId: result.assessmentId,
                  assessment_id: result.assessmentId,
                  status: 'submitted',
                  score: result.autoScore,
                  submittedAt: result.submittedAt
                });
              }
              
              setTalentSkillAssessments(updatedTSAs);

              // Update skillAssessmentResults to instantly trigger locks relying on results
              const updatedResults = [...skillAssessmentResults];
              updatedResults.push({
                id: `sar_${Date.now()}`,
                talentId: profile?.id || result.talentId,
                talent_id: profile?.id || result.talentId,
                talentSkillAssessmentId: result.talentSkillAssessmentId,
                assessmentId: result.assessmentId,
                assessment_id: result.assessmentId,
                score: result.autoScore,
                answers: result.answers || {},
                created_at: new Date().toISOString()
              });
              setSkillAssessmentResults(updatedResults);

              if (profile) {
                const pipeline = [...(profile.vettingPipeline || [])];
                const stageIdx = pipeline.findIndex((s: any) => s.assessmentId && (s.status === 'in_progress'));
                if (stageIdx >= 0) {
                  pipeline[stageIdx] = { ...pipeline[stageIdx], assessmentScore: result.autoScore, status: 'submitted' };
                }
                const updatedProfile = { ...profile, vettingPipeline: pipeline };
                await handleUpdateProfile(updatedProfile);
              }

              try {
                // Through the server. The browser marked its own paper and
                // wrote the score into talent_skill_assessments, which has
                // RLS off in the live database, so any score posted landed
                // and the assessment could be retaken until it passed. Only
                // the answers go up; the route scores them against the key
                // and refuses a second submission.
                const response = await apiFetch('/api/assessments/submit', {
                  method: 'POST',
                  body: JSON.stringify({
                    talentSkillAssessmentId: result.talentSkillAssessmentId,
                    assessmentId: result.assessmentId,
                    answers: result.answers || {}
                  })
                });

                if (!response.ok) {
                  const detail = await response.json().catch(() => ({}));
                  throw new Error(detail?.error || 'Your assessment was not submitted.');
                }

                // The stored score is the server's, not the one computed in
                // the browser, so take it back from the response.
                const saved = await response.json().catch(() => null);
                if (saved && saved.autoScore !== undefined) {
                  setTalentSkillAssessments((prev: any[]) => prev.map((tsa: any) =>
                    tsa.id === result.talentSkillAssessmentId
                      ? { ...tsa, status: 'submitted', score: saved.autoScore, submittedAt: saved.submittedAt }
                      : tsa
                  ));
                }
              } catch (e: any) {
                console.error("Failed to submit assessment", e);
                triggerBanner(e?.message || 'Your assessment was not submitted.', 'error');
              }
            }}
          />
        )}

        {/* ====================================================================== */}
        {/* FULL PORTALS: ACTIVE CLIENT DASHBOARD (Clients only) */}
        {/* ====================================================================== */}
        {currentUser && currentUser.role === 'client' && !authView && !clientIntakeActive && activeTab === 'client' && !dataReady && (
          <MascotLoader message="Loading your workspace" />
        )}

        {currentUser && currentUser.role === 'client' && !authView && !clientIntakeActive && activeTab === 'client' && dataReady && (
          <ClientDashboard
            currentUser={currentUser}
            organizations={organizations}
            clientProfiles={clientProfiles}
            users={users}
            requestActivityLogs={requestActivityLogs}
            requests={requests}
            matches={matches}
            contracts={contracts}
            talents={talents}
            invoices={invoices}
            conversations={conversations}
            messages={messages}
            notifications={notifications}
            onSignOut={handleSignOut}
            setActiveTab={setActiveTab}
            setClientIntakeActive={setClientIntakeActive}
            setClientIntakeStep={setClientIntakeStep}
            onScheduleMeeting={handleScheduleMeeting}
            onExtendOffer={handleExtendOffer}
            onSignContract={handleSignContract}
            showCalendar={showCalendar}
            setShowCalendar={setShowCalendar}
            selectedTalent={selectedTalent}
            setSelectedTalent={setSelectedTalent}
            meetingTime={meetingTime}
            setMeetingTime={setMeetingTime}
            meetingDate={meetingDate}
            setMeetingDate={setMeetingDate}
            showSignModal={showSignModal}
            setShowSignModal={setShowSignModal}
            activeNDA={activeNDA}
            signingContractId={signingContractId}
            selectedRequest={selectedRequest}
            setSelectedRequest={setSelectedRequest}
            setRequests={setRequests}
            setInvoices={setInvoices}
            setConversations={setConversations}
            setMessages={setMessages}
            setNotifications={setNotifications}
            setMatches={setMatches}
            rehireRequests={rehireRequests}
            setRehireRequests={setRehireRequests}
             supportTickets={supportTickets}
             setSupportTickets={setSupportTickets}
            onAddRequest={async (newReq) => {
              // Matching is an admin step. See the note at the other intake.
              // SmartIntakeForm has already received the server-confirmed row.
              // Do not post a stale whole-database snapshot from the browser.
              setRequests(prev => [newReq, ...prev.filter(r => r.id !== newReq.id)]);
              setSelectedRequest(newReq);
              triggerBanner('New Service Request created! Matchmaker engine initialized.', 'success');
            }}
            onRequestUpdated={(updated) => {
              // Replace in place and keep the order. An edited request that
              // jumped to the top of the list looked like a new one.
              setRequests(prev => prev.map(r => (r.id === updated.id ? { ...r, ...updated } : r)));
              setSelectedRequest(prev => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
            }}
            />
        )}

      </div>

      {/* ====================================================================== */}
      {/* MOCK OVERLAYS: MODAL FOR INTERVIEW SCHEDULER & CONTRACT E-SIGNATURES */}
      {/* ====================================================================== */}

      {/* ── Sign Out Confirmation Modal ── */}
      {showSignOutConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
            border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px',
            padding: '36px', maxWidth: '440px', width: '100%',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚪</div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>
              Confirm Sign Out
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 28px 0' }}>
              Are you sure you want to end your session? You will be signed out securely from the system backend.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowSignOutConfirm(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px', padding: '12px 24px', color: '#E2E8F0',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer', flex: 1,
                  transition: 'background 0.2s'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={performSignOut}
                style={{
                  background: 'linear-gradient(135deg, #EF4444, #DC2626)', border: 'none',
                  borderRadius: '12px', padding: '12px 24px', color: '#FFFFFF',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer', flex: 1,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                  transition: 'background 0.2s'
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
