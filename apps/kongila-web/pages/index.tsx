import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { GlassCard, Badge, NeonButton } from '@kongila/ui';
import { formatCurrency, formatDate, getGradeColor } from '@kongila/utils';
import { generateMatchesForRequest } from '@kongila/matching-engine';
import { generateNDATemplate, generateContractTemplate } from '@kongila/contracts';
import { 
  TalentProfile, ServiceRequest, Match, Contract, ServiceType
} from '@kongila/shared-types';
import { supabase } from '../lib/supabaseClient';
import TalentDashboard from '../components/TalentDashboard';
import ClientDashboard from '../components/ClientDashboard';

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

export default function KongilaWeb() {
  // DB States
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Identity & Unified Auth Progressive States
  const [currentUser, setCurrentUser] = useState<any>(null); // { id, name, email, role, onboardingStatus, emailVerified, organizationId }
  const [authView, setAuthView] = useState<'login' | 'signup' | 'verify' | 'onboarding' | null>(null);
  const [authRole, setAuthRole] = useState<'talent' | 'client'>('talent');
  
  // Auth Form Fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  
  // Talent Wizard Steps (1 to 6)
  const [talentWizardStep, setTalentWizardStep] = useState(1);
  const [talentOnboardingData, setTalentOnboardingData] = useState({
    fullName: '',
    phone: '',
    country: 'Nigeria',
    city: 'Lagos',
    timezone: 'GMT+1',
    primaryRole: 'Senior Operations Manager',
    yearsExperience: 5,
    seniorityLevel: 'Senior',
    skills: 'Operations Management, Logistics, Team Leadership, Process Optimization',
    employmentPreference: 'Full Time',
    availability: 100,
    salaryExpectation: 4500,
    hourlyMonthly: 'Monthly',
    currency: 'USD',
    cvName: 'CV_Operations_Lead.pdf',
    portfolioUrl: 'https://github.com/talent-profile',
    certifications: 'Certified Operations Professional',
    internetQuality: 'Fiber Optic (Primary) + LTE (Backup)',
    workSetup: 'Dedicated ergonomic workspace with battery backup',
    devices: 'MacBook Pro 16", dual 27" 4K displays',
    communicationTools: 'Slack, Teams, Zoom, Loom'
  });

  // Client Smart Intake (Smart Intake FIRST flow)
  const [clientIntakeActive, setClientIntakeActive] = useState(false);
  const [clientIntakeStep, setClientIntakeStep] = useState(1);
  const [formData, setFormData] = useState({
    serviceType: 'Managed Workforce' as ServiceType,
    roleDescription: 'Senior Operations Specialist to optimize enterprise processes.',
    requiredSkills: 'React, Node.js, TypeScript, PostgreSQL',
    duration: '6 Months',
    commitmentLevel: 'Full Time (40h/week)',
    numberOfHires: 1,
    timezone: 'GMT+1 (Lagos / London)',
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    budget: 4500,
    priority: 'High' as 'Low' | 'Medium' | 'High'
  });

  // Sandbox Challenge State
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentStep, setAssessmentStep] = useState(1);
  const [codeAnswer, setCodeAnswer] = useState('// Write code to optimize PostgreSQL transaction pooling here...\n\n');
  const [assessmentFeedback, setAssessmentFeedback] = useState('');

  // Calendar Modal State
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedTalent, setSelectedTalent] = useState<TalentProfile | null>(null);
  const [meetingTime, setMeetingTime] = useState('14:00');
  const [meetingDate, setMeetingDate] = useState(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  // E-Sign Modal State
  const [showSignModal, setShowSignModal] = useState(false);
  const [activeNDA, setActiveNDA] = useState<string>('');
  const [signingContractId, setSigningContractId] = useState<string | null>(null);

  // File uploading simulator
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mockUploading, setMockUploading] = useState(false);

  // UI Active Console View (for fully onboarded/vetted users)
  const [activeTab, setActiveTab] = useState<'home' | 'talent' | 'client'>('home');
  const [clientSubTab, setClientSubTab] = useState<'intake' | 'requests' | 'matching'>('intake');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  // Custom Notifications & Banners
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerType, setBannerType] = useState<'success' | 'info' | 'error'>('success');

  // Navigation Dropdown States
  const [signInDropdownOpen, setSignInDropdownOpen] = useState(false);
  const [getStartedDropdownOpen, setGetStartedDropdownOpen] = useState(false);

  // Trigger temporary floating notification
  const triggerBanner = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setBannerMessage(message);
    setBannerType(type);
    setTimeout(() => setBannerMessage(null), 5000);
  };

  // Sync with central filesystem DB
  const syncFromDb = async () => {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const dbData = await res.json();
        setTalents(dbData.talents || []);
        setRequests(dbData.clientRequests || []);
        setMatches(dbData.matches || []);
        setContracts(dbData.contracts || []);
        setInvoices(dbData.invoices || []);
        setMessages(dbData.messages || []);
        setNotifications(dbData.notifications || []);
      }
    } catch (e) {
      console.error('Failed to sync DB', e);
    } finally {
      setLoading(false);
    }
  };

  const saveToDb = async (updatedDb: any) => {
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDb)
      });
    } catch (e) {
      console.error('Failed to save DB', e);
    }
  };

  useEffect(() => {
    // Restore session on page load
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const authUser = session.user;
        // Fetch role from public.users table
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', authUser.email)
          .single();

        const role = dbUser?.role || authUser.user_metadata?.role || 'talent';
        const restoredUser = {
          id: dbUser?.id || authUser.id,
          name: authUser.user_metadata?.full_name || dbUser?.email || 'User',
          email: authUser.email || '',
          role,
          onboardingStatus: 'complete',
          emailVerified: true,
          companyName: authUser.user_metadata?.company_name,
          createdAt: authUser.created_at
        };
        setCurrentUser(restoredUser);
        setAuthView(null);
        if (role === 'talent') setActiveTab('talent');
        else setActiveTab('client');
      }
      await syncFromDb();
    };

    initSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setAuthView('login');
        setActiveTab('home');
      }
    });

    // Poll DB every 5 seconds for updates
    const interval = setInterval(syncFromDb, 5000);
    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);


  // Form Submit
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newReq: ServiceRequest = {
      id: `req_${Date.now()}`,
      clientId: currentUser?.id || 'user_client_1',
      clientName: currentUser ? `${currentUser.name} (${currentUser.companyName || 'Vanguard Corp'})` : 'Alex Mercer (Vanguard Corp)',
      serviceType: formData.serviceType,
      roleDescription: formData.roleDescription,
      requiredSkills: formData.requiredSkills.split(',').map(s => s.trim()),
      duration: formData.duration,
      commitmentLevel: formData.commitmentLevel,
      numberOfHires: formData.numberOfHires,
      timezone: formData.timezone,
      startDate: formData.startDate,
      budget: formData.budget,
      priority: formData.priority,
      status: 'New Request',
      createdAt: new Date().toISOString()
    };

    // Parallel save to Supabase Postgres backend
    try {
      const { error } = await supabase.from('talent_requests').insert([{
        client_id: currentUser?.id || 'anon_client',
        service_type: formData.serviceType,
        payload: newReq
      }]);
      if (error) console.error("Supabase storage error:", error);
    } catch (err) {
      console.warn("Supabase not fully configured yet, falling back to local DB", err);
    }

    // Calculate matches instantly
    const calculatedMatches = generateMatchesForRequest(newReq, talents);

    const updatedRequests = [...requests, newReq];
    const updatedMatches = [...matches, ...calculatedMatches];

    // Log action
    const updatedDb = {
      talents,
      clientRequests: updatedRequests,
      matches: updatedMatches,
      tasks: [],
      contracts,
      notifications: [
        {
          id: `notif_${Date.now()}`,
          userId: currentUser?.id || 'user_client_1',
          title: 'Intake Received',
          message: `Your talent request for a ${formData.serviceType} is submitted! Vetted matching scanned.`,
          read: false,
          createdAt: new Date().toISOString()
        }
      ],
      auditLogs: [
        {
          id: `audit_${Date.now()}`,
          actor: currentUser ? currentUser.name : 'Alex Mercer',
          action: 'Intake Submitted',
          details: `Requested ${formData.numberOfHires}x ${formData.serviceType} role. Budget: $${formData.budget}/mo`,
          timestamp: new Date().toISOString()
        }
      ],
      agentLogs: [
        {
          id: `alog_${Date.now()}`,
          agentName: 'Context Agent',
          message: `Discovered new Service Request ${newReq.id} for a ${newReq.serviceType} role. Matching active.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'success'
        },
        {
          id: `alog_m_${Date.now()}`,
          agentName: 'Matching Agent',
          message: `Calculated match profiles. ${calculatedMatches.length} matching candidates shortlisted.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'info'
        }
      ]
    };

    setRequests(updatedRequests);
    setMatches(updatedMatches);
    await saveToDb(updatedDb);

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

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: emailInput,
        password: passwordInput,
        options: {
          data: {
            full_name: nameInput,
            role: authRole,
            company_name: authRole === 'client' ? companyInput : undefined,
          }
        }
      });

      if (error) throw error;

      const authUserId = data.user?.id || `user_${Date.now()}`;

      // Write to public.users table
      await supabase.from('users').upsert({
        id: authUserId,
        email: emailInput,
        password_hash: 'auth_managed',
        role: authRole,
        status: 'active',
        email_verified: false
      });

      if (authRole === 'client') {
        // Create organization record
        const orgId = `org_${Date.now()}`;
        await supabase.from('organizations').upsert({
          id: orgId,
          name: companyInput || `${nameInput}'s Company`,
          created_by: authUserId
        });

        // Create client profile
        await supabase.from('client_profiles').upsert({
          id: `clp_${Date.now()}`,
          user_id: authUserId,
          organization_id: orgId,
          position: 'Admin'
        });
      } else {
        // Create talent profile placeholder
        await supabase.from('talent_profiles').upsert({
          id: `talent_${Date.now()}`,
          user_id: authUserId,
          full_name: nameInput,
          status: 'active',
          vetting_stage: 'Application',
          vetting_status: 'Pending'
        });
      }

      const newUser = {
        id: authUserId,
        name: nameInput,
        email: emailInput,
        role: authRole,
        onboardingStatus: 'incomplete',
        emailVerified: false,
        companyName: authRole === 'client' ? companyInput : undefined,
        createdAt: new Date().toISOString()
      };

      setCurrentUser(newUser);
      if (authRole === 'talent') {
        setAuthView('onboarding');
      } else {
        setAuthView(null);
        setActiveTab('client');
      }
      triggerBanner('Account created successfully! Welcome to Kongila.', 'success');
    } catch (error: any) {
      triggerBanner(`Sign up failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
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

      // Read the user's role from the public.users table (source of truth)
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailInput)
        .single();

      const role = dbUser?.role || data.user?.user_metadata?.role || 'talent';

      const loggedInUser = {
        id: dbUser?.id || data.user?.id || `user_${Date.now()}`,
        name: data.user?.user_metadata?.full_name || emailInput,
        email: emailInput,
        role,
        onboardingStatus: 'complete',
        emailVerified: true,
        companyName: data.user?.user_metadata?.company_name,
        createdAt: data.user?.created_at || new Date().toISOString()
      };

      setCurrentUser(loggedInUser);
      setAuthView(null);

      if (role === 'talent') {
        setActiveTab('talent');
      } else {
        setActiveTab('client');
      }
      triggerBanner(`Welcome back! Logged in successfully.`, 'success');
    } catch (error: any) {
      triggerBanner(`Login failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const simulateGoogleLogin = (role: 'talent' | 'client') => {
    const googleUser = {
      id: `google_${Date.now()}`,
      name: role === 'talent' ? 'Tariq Ibrahim' : 'Marcus Thorne',
      email: role === 'talent' ? 'tariq.ibrahim@google-auth.dev' : 'marcus@thorne-invest.com',
      role: role,
      onboardingStatus: 'incomplete',
      emailVerified: true, // Google accounts automatically verified
      companyName: role === 'client' ? 'Thorne Enterprises' : undefined,
      createdAt: new Date().toISOString()
    };

    setCurrentUser(googleUser);
    triggerBanner('Authenticated with Google OAuth!', 'success');

    if (role === 'talent') {
      setAuthView('onboarding');
      setTalentWizardStep(1);
    } else {
      // Smart intake already completed?
      if (clientIntakeActive && clientIntakeStep === 5) {
        completeClientSmartIntake(googleUser);
      } else {
        setAuthView(null);
        setActiveTab('client');
      }
    }
  };

  const simulateLinkedInLogin = () => {
    // LinkedIn is especially valuable for Talent experience import
    const linkedInUser = {
      id: `linkedin_${Date.now()}`,
      name: 'Adama Keita',
      email: 'adama.keita@linkedin-auth.dev',
      role: 'talent' as const,
      onboardingStatus: 'incomplete',
      emailVerified: true,
      createdAt: new Date().toISOString()
    };

    // Pre-populate talent profile details from LinkedIn profile import
    setTalentOnboardingData(prev => ({
      ...prev,
      fullName: 'Adama Keita',
      primaryRole: 'Lead Python Data Analyst',
      yearsExperience: 7,
      skills: 'Python, SQL, Django, Pandas, PostgreSQL, Docker',
      seniorityLevel: 'Senior',
      portfolioUrl: 'https://linkedin.com/in/adama-keita'
    }));

    setCurrentUser(linkedInUser);
    setAuthView('onboarding');
    setTalentWizardStep(1);
    triggerBanner('Imported profile details successfully from LinkedIn!', 'success');
  };

  const simulateEmailVerification = async () => {
    if (!currentUser) return;
    setLoading(true);

    const verifiedUser = { ...currentUser, emailVerified: true };
    setCurrentUser(verifiedUser);
    setLoading(false);

    triggerBanner('Email verification simulated successfully via Resend!', 'success');

    if (verifiedUser.role === 'talent') {
      setAuthView('onboarding');
      setTalentWizardStep(1);
    } else {
      if (clientIntakeActive && clientIntakeStep === 5) {
        completeClientSmartIntake(verifiedUser);
      } else {
        setAuthView(null);
        setActiveTab('client');
      }
    }
  };

  const completeClientSmartIntake = async (user: any) => {
    setLoading(true);
    const newReq: ServiceRequest = {
      id: `req_${Date.now()}`,
      clientId: user.id,
      clientName: `${user.name} (${user.companyName || 'Vanguard Corp'})`,
      serviceType: formData.serviceType,
      roleDescription: formData.roleDescription,
      requiredSkills: formData.requiredSkills.split(',').map(s => s.trim()),
      duration: formData.duration,
      commitmentLevel: formData.commitmentLevel,
      numberOfHires: formData.numberOfHires,
      timezone: formData.timezone,
      startDate: formData.startDate,
      budget: formData.budget,
      priority: formData.priority,
      status: 'New Request',
      createdAt: new Date().toISOString()
    };

    const calculatedMatches = generateMatchesForRequest(newReq, talents);
    const updatedRequests = [...requests, newReq];
    const updatedMatches = [...matches, ...calculatedMatches];

    const updatedDb = {
      talents,
      clientRequests: updatedRequests,
      matches: updatedMatches,
      tasks: [],
      contracts,
      notifications: [
        {
          id: `notif_${Date.now()}`,
          userId: user.id,
          title: 'Organization Profile Created',
          message: `Created organization matching your intake request: ${user.companyName}. Scanning vetting databases.`,
          read: false,
          createdAt: new Date().toISOString()
        }
      ],
      auditLogs: [
        {
          id: `audit_${Date.now()}`,
          actor: user.name,
          action: 'Talent Request Completed & Authenticated',
          details: `Service Request generated. Linked to organization ${user.companyName}.`,
          timestamp: new Date().toISOString()
        }
      ],
      agentLogs: [
        {
          id: `alog_client_${Date.now()}`,
          agentName: 'Context Agent',
          message: `Organization profile and EOR accounts initiated for client ${user.name} (${user.companyName}).`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'success'
        }
      ]
    };

    setRequests(updatedRequests);
    setMatches(updatedMatches);
    await saveToDb(updatedDb);

    setSelectedRequest(newReq);
    setClientIntakeActive(false);
    setAuthView(null);
    setClientSubTab('matching');
    setActiveTab('client');
    setLoading(false);
    triggerBanner('Talent Request and Client organization established! Vetting scans initialized.', 'success');
  };

  // Mock upload trigger for Talent Docs onboarding step
  const triggerMockUpload = () => {
    if (mockUploading) return;
    setMockUploading(true);
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setMockUploading(false);
          triggerBanner('CV & Work Portfolio documents securely uploaded and encrypted.', 'success');
          return 100;
        }
        return p + 25;
      });
    }, 200);
  };

  // Submit Talent Onboarding Wizard
  const handleTalentWizardSubmit = async () => {
    setLoading(true);

    // Create a new TalentProfile object inside db.json
    const newTalent: TalentProfile = {
      id: `talent_${Date.now()}`,
      name: talentOnboardingData.fullName || currentUser?.name || 'Tariq Ibrahim',
      email: currentUser?.email || 'talent@onb-pool.dev',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
      title: talentOnboardingData.primaryRole,
      skills: talentOnboardingData.skills.split(',').map(s => s.trim()),
      timezone: talentOnboardingData.timezone,
      salaryExpectation: talentOnboardingData.salaryExpectation,
      experienceYears: talentOnboardingData.yearsExperience,
      availability: talentOnboardingData.availability,
      vettingStage: 'Application Screening',
      vettingStatus: 'Applied', // progressive EOR state
      vettingScores: {
        technical: 0,
        behavioral: 0,
        personality: 0,
        remoteReadiness: 0,
        workSimulation: 0,
        communication: 0,
        experience: 0
      },
      grade: 'B', // default un-graded
      tags: ['Progressive Entry', 'Assessment Pending'],
      bio: `Highly skilled professional targeting global opportunities. Experience level: ${talentOnboardingData.seniorityLevel}. Readiness setups resolved.`
    };

    const updatedTalents = [...talents, newTalent];

    const updatedDb = {
      talents: updatedTalents,
      clientRequests: requests,
      matches: matches,
      tasks: [],
      contracts: contracts,
      notifications: [
        {
          id: `notif_${Date.now()}`,
          userId: newTalent.id,
          title: 'Application Intake Submitted',
          message: 'Your talent application screening review is running. Complete your Node/Postgres coding assessment.',
          read: false,
          createdAt: new Date().toISOString()
        }
      ],
      auditLogs: [
        {
          id: `audit_${Date.now()}`,
          actor: newTalent.name,
          action: 'Progressive Onboarding Completed',
          details: `Role expectations: ${newTalent.title}. Setup: ${talentOnboardingData.workSetup}`,
          timestamp: new Date().toISOString()
        }
      ],
      agentLogs: [
        {
          id: `alog_talent_${Date.now()}`,
          agentName: 'Compliance Agent',
          message: `Screening pipeline initiated for talent ${newTalent.name}. KYC & equipment logs verified.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'info'
        }
      ]
    };

    setTalents(updatedTalents);
    await saveToDb(updatedDb);

    if (currentUser) {
      setCurrentUser({ ...currentUser, onboardingStatus: 'complete' });
    }

    setAuthView(null);
    setActiveTab('talent');
    setLoading(false);
    triggerBanner('Progressive Onboarding Completed! Workspace deployed.', 'success');
  };

  // Simulate Specialized Assessment Sandbox
  const handleAssessmentSubmit = () => {
    if (codeAnswer.length < 50) {
      setAssessmentFeedback('Error: Optimization strategy too brief. Provide structural workflow optimization proposals.');
      return;
    }

    setAssessmentFeedback('Analyzing workflow efficiency & execution footprint...');
    setTimeout(async () => {
      setAssessmentFeedback('Success: Vetting score calculated at 92/100 (Grade A+ Elite)! Optimization strategy verified.');
      
      // Update talent vetting score in central DB
      const currentTalent = talents.find(t => t.email.toLowerCase() === currentUser?.email?.toLowerCase());
      if (currentTalent) {
        const updatedTalents = talents.map(t => 
          t.id === currentTalent.id 
            ? { 
                ...t, 
                vettingStage: 'Behavioural Interview' as const, 
                vettingStatus: 'Review' as const,
                vettingScores: { ...t.vettingScores, technical: 92 },
                grade: 'A' as const
              } 
            : t
        );
        const updatedDb = {
          talents: updatedTalents,
          clientRequests: requests,
          matches: matches,
          tasks: [],
          contracts: contracts,
          notifications: [
            {
              id: `notif_${Date.now()}`,
              userId: currentTalent.id,
              title: 'Assessment Cleared',
              message: 'Your specialized assessment challenge score computed at 92%! Interview booked.',
              read: false,
              createdAt: new Date().toISOString()
            }
          ],
          auditLogs: [
            {
              id: `audit_${Date.now()}`,
              actor: currentTalent.name,
              action: 'Specialized Challenge Submitted',
              details: 'Scored 92/100 in structural operational optimization sandbox.',
              timestamp: new Date().toISOString()
            }
          ],
          agentLogs: [
            {
              id: `alog_v_${Date.now()}`,
              agentName: 'Vetting Agent',
              message: `Specialized assessment compiled for ${currentTalent.name}: 92% efficiency. Escalated to scheduling.`,
              timestamp: new Date().toLocaleTimeString(),
              type: 'success'
            }
          ]
        };
        setTalents(updatedTalents);
        await saveToDb(updatedDb);
      }
    }, 1500);
  };

  // Trigger Mock Fully Vetted state directly for local evaluation
  const handleSimulateFullVetting = async () => {
    const currentTalent = talents.find(t => t.email.toLowerCase() === currentUser?.email?.toLowerCase());
    if (!currentTalent) return;

    setLoading(true);
    const updatedTalents = talents.map(t => 
      t.id === currentTalent.id 
        ? { 
            ...t, 
            vettingStage: 'Final Review' as const, 
            vettingStatus: 'Vetted' as const,
            vettingScores: {
              technical: 94,
              behavioral: 88,
              personality: 90,
              remoteReadiness: 95,
              workSimulation: 92,
              communication: 90,
              experience: 85
            },
            grade: 'A+' as const,
            tags: ['Vetted Professional', 'High speed Fiber', 'Independent Worker']
          } 
        : t
    );

    const updatedDb = {
      talents: updatedTalents,
      clientRequests: requests,
      matches: matches,
      tasks: [],
      contracts: contracts,
      notifications: [
        {
          id: `notif_${Date.now()}`,
          userId: currentTalent.id,
          title: 'Vetting Milestone Cleared',
          message: 'Congratulations! Your profile is verified as fully VETTED & DEPLOYABLE globally.',
          read: false,
          createdAt: new Date().toISOString()
        }
      ],
      auditLogs: [
        {
          id: `audit_${Date.now()}`,
          actor: 'Super Admin Grader',
          action: 'Verify Talent Vetting',
          details: `Set profile status of ${currentTalent.name} to Vetted (Grade: A+).`,
          timestamp: new Date().toISOString()
        }
      ],
      agentLogs: [
        {
          id: `alog_ad_${Date.now()}`,
          agentName: 'Vetting Agent',
          message: `Composite vetting computed: A+ grade for ${currentTalent.name}. Profile released to radar matches.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'success'
        }
      ]
    };

    setTalents(updatedTalents);
    await saveToDb(updatedDb);
    setLoading(false);
    triggerBanner('Profile verified as fully VETTED! Access to full portal unlocked.', 'success');
  };

  // Schedule Interview
  const handleScheduleMeeting = async () => {
    if (!selectedTalent || !selectedRequest) return;
    
    // Update match status
    const requestMatch = matches.find(m => m.requestId === selectedRequest.id && m.talentId === selectedTalent.id);
    if (!requestMatch) return;

    const updatedMatches = matches.map(m => 
      m.id === requestMatch.id ? { ...m, status: 'Interview Scheduled' as const } : m
    );

    // Add alert log
    const updatedDb = {
      talents,
      clientRequests: requests,
      matches: updatedMatches,
      tasks: [],
      contracts,
      notifications: [],
      auditLogs: [
        {
          id: `audit_${Date.now()}`,
          actor: currentUser ? currentUser.name : 'Alex Mercer',
          action: 'Schedule Interview',
          details: `Booked video interview with ${selectedTalent.name} on ${meetingDate} at ${meetingTime}`,
          timestamp: new Date().toISOString()
        }
      ],
      agentLogs: [
        {
          id: `alog_${Date.now()}`,
          agentName: 'Workflow Agent',
          message: `Transitioned Match ${requestMatch.id} status to 'Interview Scheduled'. Syncing calendars.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'info'
        },
        {
          id: `alog_sms_${Date.now()}`,
          agentName: 'Communication Agent',
          message: `WhatsApp calendar link dispatched to talent ${selectedTalent.name} (+234803929...)`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'success'
        }
      ]
    };

    setMatches(updatedMatches);
    await saveToDb(updatedDb);
    setShowCalendar(false);
    triggerBanner(`Interview booked with ${selectedTalent.name}! Workspace synced.`, 'success');
  };

  // Extend Job Offer (Generate Contract)
  const handleExtendOffer = async (talent: TalentProfile) => {
    if (!selectedRequest) return;

    // Create Contract
    const newContract: Contract = {
      id: `contract_${Date.now()}`,
      matchId: `match_${selectedRequest.id.split('_')[1]}_${talent.id.split('_')[1]}`,
      clientId: currentUser?.id || 'user_client_1',
      clientName: currentUser ? `${currentUser.name} (${currentUser.companyName || 'Vanguard Corp'})` : 'Alex Mercer (Vanguard Corp)',
      talentId: talent.id,
      talentName: talent.name,
      role: selectedRequest.roleDescription,
      salary: selectedRequest.budget,
      startDate: selectedRequest.startDate,
      status: 'Pending'
    };

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

    const ndaText = generateNDATemplate(talent.name, currentUser ? `${currentUser.name} (${currentUser.companyName})` : 'Alex Mercer (Vanguard Corp)');
    setActiveNDA(ndaText);
    setSigningContractId(newContract.id);

    const updatedDb = {
      talents,
      clientRequests: updatedRequests,
      matches: updatedMatches,
      tasks: [],
      contracts: [...contracts, newContract],
      notifications: [],
      auditLogs: [
        {
          id: `audit_${Date.now()}`,
          actor: currentUser ? currentUser.name : 'Alex Mercer',
          action: 'Extend Job Offer',
          details: `Extended EOR contract for ${talent.name} ($${selectedRequest.budget}/mo)`,
          timestamp: new Date().toISOString()
        }
      ],
      agentLogs: [
        {
          id: `alog_${Date.now()}`,
          agentName: 'Compliance Agent',
          message: `Job offer generated for ${talent.name}. Contractor compliance package initiated.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'info'
        }
      ]
    };

    setContracts([...contracts, newContract]);
    setMatches(updatedMatches);
    setRequests(updatedRequests);
    await saveToDb(updatedDb);
    setShowSignModal(true);
  };

  // Sign NDA/Contract Simulator
  const handleSignContract = async () => {
    if (!signingContractId) return;

    // Sign contract
    const updatedContracts = contracts.map(c => 
      c.id === signingContractId ? { ...c, status: 'Signed' as const, signedAt: new Date().toISOString() } : c
    );

    const currentContract = contracts.find(c => c.id === signingContractId);
    if (!currentContract) return;

    // Set talent deployed
    const updatedTalents = talents.map(t => 
      t.id === currentContract.talentId ? { ...t, vettingStatus: 'Deployed' as const } : t
    );

    // Set request onboarding
    const updatedRequests = requests.map(r => 
      r.id === selectedRequest?.id ? { ...r, status: 'Onboarding' as const } : r
    );

    // Create general onboarding task in Remotan board
    const welcomeTask = {
      id: `task_onb_${Date.now()}`,
      projectId: 'project_general',
      projectName: 'General Onboarding',
      title: 'Complete Onboarding Welcome Videos & Systems Setup',
      description: 'Read the IT security handbook, complete portal onboarding details, and watch introducing media.',
      assigneeId: currentContract.talentId,
      assigneeName: currentContract.talentName,
      status: 'In Progress',
      priority: 'High',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    const updatedDb = {
      talents: updatedTalents,
      clientRequests: updatedRequests,
      matches,
      tasks: [welcomeTask],
      contracts: updatedContracts,
      notifications: [],
      auditLogs: [
        {
          id: `audit_${Date.now()}`,
          actor: currentContract.talentName,
          action: 'E-Sign NDA & Contract',
          details: `Contract ${signingContractId} securely signed. Deploying workspace setup.`,
          timestamp: new Date().toISOString()
        }
      ],
      agentLogs: [
        {
          id: `alog_${Date.now()}`,
          agentName: 'Compliance Agent',
          message: `E-Signature verified for ${currentContract.talentName}. NDA locked and archived.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'success'
        },
        {
          id: `alog_task_${Date.now()}`,
          agentName: 'Workflow Agent',
          message: `Spawned general onboarding task board in Remotan for ${currentContract.talentName}.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'success'
        }
      ]
    };

    setContracts(updatedContracts);
    setTalents(updatedTalents);
    setRequests(updatedRequests);
    await saveToDb(updatedDb);
    setShowSignModal(false);
    triggerBanner(`Contract signed! Deployed onboarding task to Remotan Work OS.`, 'success');
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

  // Find the database talent profile matching current user email
  const getCurrentTalentProfile = () => {
    if (!currentUser) return null;
    return talents.find(t => t.email.toLowerCase() === currentUser.email.toLowerCase());
  };

  const handleUpdateProfile = async (updatedProfile: any) => {
    const updatedTalents = talents.map(t => t.id === updatedProfile.id ? updatedProfile : t);
    setTalents(updatedTalents);

    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const dbData = await res.json();
        dbData.talents = updatedTalents;
        await saveToDb(dbData);
      }
    } catch (e) {
      console.error("Failed to persist profile update", e);
    }
  };

  const handleSignOut = async () => {
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
            <KongilaLogo size={28} textColor="#0047CC" />
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
          <div style={{ backgroundColor: '#FAFAFA', minHeight: '100vh', width: '100%', overflowX: 'hidden' }}>
            
            {/* 1. STICKY NAVIGATION BAR */}
            <header style={{
              position: 'sticky',
              top: 0,
              left: 0,
              right: 0,
              height: '72px',
              backgroundColor: 'rgba(250, 250, 250, 0.85)',
              backdropFilter: 'blur(16px)',
              borderBottom: '1px solid var(--border-glass)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 max(24px, 4%)',
              transition: 'var(--transition-smooth)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setActiveTab('home')}>
                <KongilaLogo size={32} textColor="#1A2340" />
              </div>

              {/* Navigation Links */}
              <nav style={{ display: 'flex', gap: '32px' }} className="hide-mobile">
                {['Solutions', 'Talent', 'Enterprise', 'How It Works', 'Pricing', 'Resources'].map((item) => (
                  <span key={item} style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }} onMouseEnter={e => e.currentTarget.style.color = '#0047CC'}
                     onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                    {item}
                  </span>
                ))}
              </nav>

              {/* Auth Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
                {/* Sign In Dropdown Trigger */}
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => {
                      setSignInDropdownOpen(!signInDropdownOpen);
                      setGetStartedDropdownOpen(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'var(--transition-smooth)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#0047CC'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                  >
                    Sign In
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>

                  {/* Sign In Dropdown */}
                  {signInDropdownOpen && (
                    <div className="glass-panel" style={{
                      position: 'absolute',
                      top: '40px',
                      right: 0,
                      width: '200px',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      zIndex: 1010,
                      animation: 'fadeIn 0.2s ease',
                      border: '1px solid var(--border-glass)',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)'
                    }}>
                      <div 
                        onClick={() => { setAuthView('login'); setAuthRole('talent'); setSignInDropdownOpen(false); }}
                        style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, transition: 'var(--transition-smooth)' }}
                        className="menu-item"
                      >
                        👨‍💻 Talent Portal
                      </div>
                      <div 
                        onClick={() => { setAuthView('login'); setAuthRole('client'); setSignInDropdownOpen(false); }}
                        style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, transition: 'var(--transition-smooth)' }}
                        className="menu-item"
                      >
                        💼 Client Portal
                      </div>
                    </div>
                  )}
                </div>

                {/* Get Started Dropdown Trigger */}
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => {
                      setGetStartedDropdownOpen(!getStartedDropdownOpen);
                      setSignInDropdownOpen(false);
                    }}
                    className="btn-primary"
                    style={{
                      height: '40px',
                      fontSize: '14px',
                      borderRadius: '10px',
                      padding: '0 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Get Started
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>

                  {/* Get Started Dropdown */}
                  {getStartedDropdownOpen && (
                    <div className="glass-panel" style={{
                      position: 'absolute',
                      top: '48px',
                      right: 0,
                      width: '220px',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      zIndex: 1010,
                      animation: 'fadeIn 0.2s ease',
                      border: '1px solid var(--border-glass)',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)'
                    }}>
                      <div 
                        onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); setGetStartedDropdownOpen(false); }}
                        style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, transition: 'var(--transition-smooth)' }}
                        className="menu-item"
                      >
                        🛡️ Hire Talent
                      </div>
                      <div 
                        onClick={() => { setAuthView('signup'); setAuthRole('talent'); setNameInput(''); setEmailInput(''); setPasswordInput(''); setGetStartedDropdownOpen(false); }}
                        style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, transition: 'var(--transition-smooth)' }}
                        className="menu-item"
                      >
                        ⚡ Apply as Talent
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* 2. HERO SECTION */}
            <section className="hero-grid" style={{
              maxWidth: '1280px',
              margin: '0 auto',
              padding: '80px 24px 100px 24px'
            }}>
              {/* Left Side: Content */}
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(0, 71, 204, 0.08)', border: '1px solid rgba(0, 71, 204, 0.1)', padding: '6px 12px', borderRadius: '99px', marginBottom: '24px' }}>
                  <span style={{ width: '6px', height: '6px', backgroundColor: '#0047CC', borderRadius: '50%' }}></span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0047CC', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Workspace Operations Platform</span>
                </div>
                
                <h1 style={{
                  fontSize: '56px',
                  fontWeight: 600,
                  color: '#111827',
                  lineHeight: '1.12',
                  letterSpacing: '-0.03em',
                  marginBottom: '24px',
                  fontFamily: 'var(--font-display)'
                }}>
                  Build and Manage Global Teams Without Operational Complexity
                </h1>
                
                <p style={{
                  fontSize: '18px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                  marginBottom: '40px',
                  maxWidth: '560px'
                }}>
                  Kongila is the workforce infrastructure layer that connects vetted global talent with companies, managing sourcing, vetting, EOR compliance, consolidated payroll, and active task execution in one unified system.
                </p>

                {/* CTA Group */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '48px' }}>
                  <button 
                    onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }}
                    className="btn-primary"
                    style={{ height: '48px', padding: '0 28px', fontSize: '15px', borderRadius: '12px' }}
                  >
                    Hire Talent
                  </button>
                  <button 
                    onClick={() => { setAuthView('signup'); setAuthRole('talent'); setNameInput(''); setEmailInput(''); setPasswordInput(''); }}
                    className="btn-secondary"
                    style={{ height: '48px', padding: '0 28px', fontSize: '15px', borderRadius: '12px' }}
                  >
                    Join as Talent
                  </button>
                  <a 
                    onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }}
                    style={{ fontSize: '14px', fontWeight: 600, color: '#0047CC', textDecoration: 'none', cursor: 'pointer', marginLeft: '8px' }}
                  >
                    Explore Solutions ➔
                  </a>
                </div>

                {/* Trust Indicators */}
                <div style={{ display: 'flex', gap: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '24px' }}>
                  {[
                    { label: 'Sourcing & Placement', val: '7-Stage Vetting' },
                    { label: 'Risk Coverage', val: 'Fully Compliant EOR' },
                    { label: 'Ongoing Operations', val: '24/7 Global Support' }
                  ].map((ind, idx) => (
                    <div key={idx}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{ind.label}</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: '#16A34A' }}>✓</span> {ind.val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side: Soft Dashboard Preview */}
              <div className="glass-panel" style={{
                padding: '24px',
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                border: '1px solid var(--border-glass)',
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#EF4444', borderRadius: '50%' }}></span>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#F59E0B', borderRadius: '50%' }}></span>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#10B981', borderRadius: '50%' }}></span>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Kongila Matching Engine</div>
                </div>

                {/* Dashboard Profile Widget */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#0047CC', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px' }}>
                    DO
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Damilola O.</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Lead Operations Manager • Lagos, Nigeria (GMT+1)</div>
                  </div>
                  <span className="status-chip vetted" style={{ padding: '4px 8px', fontSize: '10px' }}>GRADE A+</span>
                </div>

                {/* Vetting Benchmarks */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>Vetting Evaluation Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { title: 'Operational Assessment', val: '96% Score' },
                      { title: 'Remote Work Simulation', val: '94% Efficiency' },
                      { title: 'Hardware Setup Audit', val: 'Fiber + UPS Verified' },
                      { title: 'Compliance Checks', val: 'Passed (EOR Ready)' }
                    ].map((bm, idx) => (
                      <div key={idx} style={{ padding: '8px 12px', border: '1px solid var(--border-glass)', borderRadius: '10px', backgroundColor: '#fff' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{bm.title}</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{bm.val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active Deployment Execution Tracker */}
                <div style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Transaction Pool Optimizer</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="status-chip vetted" style={{ fontSize: '9px', padding: '2px 6px' }}>DEPLOYED</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Optimize transaction connection pooling for pgBouncer</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flexGrow: 1, height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '92%', height: '100%', backgroundColor: '#0047CC', borderRadius: '3px' }}></div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>92%</span>
                  </div>
                </div>

                {/* Multi-Agent logs terminal preview */}
                <div className="agent-terminal" style={{ fontSize: '11px' }}>
                  <div className="terminal-header" style={{ padding: '8px 12px' }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Execution Logs Feed</span>
                    <span style={{ color: '#64748b' }}>Live</span>
                  </div>
                  <div className="terminal-body" style={{ padding: '10px', height: '90px' }}>
                    <div className="log-entry"><span className="log-time">[10:14]</span> <span className="log-success">COMPLETED</span> <span className="log-text">Intake profile successfully synced</span></div>
                    <div className="log-entry"><span className="log-time">[11:00]</span> <span className="log-info">INFO</span> <span className="log-text">7-stage composite score evaluated: Grade A+</span></div>
                    <div className="log-entry"><span className="log-time">[12:45]</span> <span className="log-warning">WARNING</span> <span className="log-text">Resource allocation bound to local EOR contracts</span></div>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. TRUST SECTION (SOCIAL PROOF) */}
            <section style={{ borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)', backgroundColor: '#FFFFFF', padding: '40px 24px' }}>
              <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '32px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', maxWidth: '280px' }}>
                  Trusted by scale-ups and global modern organizations
                </div>
                <div style={{ display: 'flex', gap: '48px', alignItems: 'center', flexWrap: 'wrap' }} className="grayscale-logos">
                  {['Linear', 'Stripe', 'Remote', 'Deel', 'Notion', 'Mercury'].map((logo) => (
                    <span key={logo} style={{ fontSize: '18px', fontWeight: 700, color: '#9CA3AF', letterSpacing: '-0.03em' }}>{logo}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: '#0047CC' }}>500+</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Deployed Professionals</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: '#0047CC' }}>99.8%</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SLA Compliance</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: '#0047CC' }}>$12M+</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Managed Payroll</div>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. SERVICE OVERVIEW SECTION */}
            <section style={{ maxWidth: '1280px', margin: '112px auto', padding: '0 24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                <h2 style={{ fontSize: '32px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em', marginBottom: '16px' }}>
                  Workforce Services Orchestrated for Scale
                </h2>
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto' }}>
                  We provide distinct, compliant service tiers tailored to your company's operational needs and management structure.
                </p>
              </div>

              <div className="overview-grid" style={{}}>
                {[
                  {
                    title: 'Managed Workforce',
                    icon: '🛡️',
                    desc: 'Kongila takes direct operational responsibility for team performance, providing continuous EOR protection, dedicated delivery oversight, and complete equipment setups.',
                    link: 'Explore Managed Workforce'
                  },
                  {
                    title: 'Talent Outsourcing',
                    icon: '⚡',
                    desc: 'Rapidly scale contractor capacity. Kongila acts as the Employer of Record and processes payments, while your internal leadership manages day-to-day tasks.',
                    link: 'Explore Talent Outsourcing'
                  },
                  {
                    title: 'Direct Placement',
                    icon: '🔍',
                    desc: 'Access our pre-vetted private candidate pool. We execute the complete 7-stage vetting pipeline and match top-tier global professionals directly to your team.',
                    link: 'Explore Talent Placement'
                  },
                  {
                    title: 'Project Execution',
                    icon: '📋',
                    desc: 'Deliver key operational milestones without recruitment overhead. We provide a fully staffed remote team, active project managers, and milestone compliance.',
                    link: 'Explore Project Execution'
                  }
                ].map((srv, idx) => (
                  <div key={idx} className="glass-panel" style={{
                    padding: '32px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-glass)',
                    backgroundColor: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    <span style={{ fontSize: '28px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                      {srv.icon}
                    </span>
                    <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#111827' }}>{srv.title}</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', flexGrow: 1 }}>{srv.desc}</p>
                    <a 
                      onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }}
                      style={{ fontSize: '13px', fontWeight: 600, color: '#0047CC', textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      {srv.link} ➔
                    </a>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. HOW KONGILA WORKS (WORKFLOW TIMELINE) */}
            <section style={{ borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)', backgroundColor: '#FFFFFF', padding: '100px 24px' }}>
              <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                  <h2 style={{ fontSize: '32px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em', marginBottom: '16px' }}>
                    How Kongila Works
                  </h2>
                  <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto' }}>
                    From requirement matching to automated onboarding and deployment — our operational pipeline is built to protect your velocity.
                  </p>
                </div>

                {/* Timeline Grid */}
                <div className="timeline-grid" style={{ position: 'relative' }}>
                  {[
                    { step: '01', title: 'Submit Requirements', desc: 'Define your professional needs, target timezone preferences, and service models in under 3 minutes.' },
                    { step: '02', title: 'Get Matched', desc: 'Our matching engine evaluates skill fit, timezone availability, and remote readiness to align you with top A+ talent.' },
                    { step: '03', title: 'Interview & Approve', desc: 'Review comprehensive composite grades, interview selected candidates, and authorize the placement.' },
                    { step: '04', title: 'Deploy & Scale', desc: 'Sign compliant EOR contracts and deploy talent. Kongila handles power backup guarantees, hardware, and payroll.' }
                  ].map((step, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      {/* Connector Line */}
                      {idx < 3 && (
                        <div style={{
                          position: 'absolute',
                          top: '20px',
                          left: '40px',
                          right: '-140px',
                          height: '1px',
                          borderTop: '2.5px dashed var(--border-glass)',
                          zIndex: 1
                        }} className="hidden-tablet" />
                      )}
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 2 }}>
                        <span style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0, 71, 204, 0.08)',
                          color: '#0047CC',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '14px',
                          border: '1.5px solid rgba(0, 71, 204, 0.2)'
                        }}>{step.step}</span>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>{step.title}</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 6. TALENT EXPERIENCE SECTION */}
            <section className="experience-grid-1" style={{ maxWidth: '1280px', margin: '112px auto', padding: '0 24px' }}>
              {/* Left Side: Copy */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#0047CC', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '12px' }}>Built For Global Professional Talent</span>
                <h2 style={{ fontSize: '32px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em', marginBottom: '20px', lineHeight: '1.2' }}>
                  Accelerate Your Global Professional Career
                </h2>
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
                  Join an elite network of professional talent across emerging markets. Kongila guarantees access to world-class enterprise clients, local EOR compliance backing, fully financed workspace setups, and automated monthly payouts.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
                  {[
                    { title: 'Global Salaries', desc: 'Secure competitive salaries matching global standards, paid reliably.' },
                    { title: 'Full Hardware & Infrastructure Financing', desc: 'Get backed with high-performance laptops and fiber-optic backup power matching.' },
                    { title: 'Local Labor Law Protection', desc: 'Work confidently under local contracts with automated tax compliance.' }
                  ].map((benefit, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ color: '#0047CC', fontWeight: 700 }}>✓</span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{benefit.title}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{benefit.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => { setAuthView('signup'); setAuthRole('talent'); setNameInput(''); setEmailInput(''); setPasswordInput(''); }}
                  className="btn-primary"
                  style={{ borderRadius: '12px' }}
                >
                  Apply to the Network
                </button>
              </div>

              {/* Right Side: Talent Dashboard Preview */}
              <div className="glass-panel" style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                border: '1px solid var(--border-glass)',
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Talent Console</div>
                  <span className="status-chip applied" style={{ fontSize: '10px' }}>ONBOARDING VERIFICATION</span>
                </div>

                {/* Progress Checklist */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>Onboarding Progress</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { step: 'Identity & KYC validation', checked: true },
                      { step: '7-stage specialized vetting sandbox', checked: true },
                      { step: 'Ergonomic hardware & backup power check', checked: false },
                      { step: 'Automated EOR NDA contracts execution', checked: false }
                    ].map((ch, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                        <span style={{ color: ch.checked ? '#16A34A' : '#9CA3AF' }}>{ch.checked ? '●' : '○'}</span>
                        <span style={{ color: ch.checked ? 'var(--text-primary)' : 'var(--text-muted)', textDecoration: ch.checked ? 'line-through' : 'none' }}>{ch.step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vetting Assessment Result Card */}
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vetting Outcome</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A' }}>GRADE APPROVED</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Operational Assessment: 98% Score</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Evaluated: 100% Optimal operational workflows and process optimization.</div>
                </div>

                {/* Interview Schedule calendar */}
                <div style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Upcoming Schedule</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Client Introduction Call</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#0047CC', backgroundColor: 'rgba(0, 71, 204, 0.08)', padding: '4px 10px', borderRadius: '8px' }}>
                    Tomorrow • 14:00 (GMT+1)
                  </div>
                </div>
              </div>
            </section>

            {/* 7. CLIENT EXPERIENCE SECTION */}
            <section style={{ borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)', backgroundColor: '#FFFFFF', padding: '100px 24px' }}>
              <div className="experience-grid-2" style={{ maxWidth: '1280px', margin: '0 auto' }}>
                
                {/* Left Side: Client Console Mockup */}
                <div className="glass-panel" style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '20px',
                  border: '1px solid var(--border-glass)',
                  boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Client Console</div>
                    <span className="status-chip vetted" style={{ fontSize: '10px' }}>MATCH VERIFIED</span>
                  </div>

                  {/* Smart Placement Proposal */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Active Talent Shortlist</div>
                    <div style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Damilola O.</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Senior Operations Specialist (A+)</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0047CC' }}>94% Compatibility</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Skill & Behavior index</div>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Signature box */}
                  <div style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Compliance NDA Binding</div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px', overflowY: 'auto', maxHeight: '72px', border: '1px solid var(--border-glass)' }}>
                      This workforce agreement locks Employer of Record protections, IP ownership, and NDA guarantees...
                    </div>
                    <button 
                      onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }}
                      className="btn-primary" 
                      style={{ width: '100%', height: '40px', fontSize: '12px', borderRadius: '8px', marginTop: '12px' }}
                    >
                      Authorize Matching Contract
                    </button>
                  </div>
                </div>

                {/* Right Side: Copy */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#0047CC', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '12px' }}>Designed for Organizations</span>
                  <h2 style={{ fontSize: '32px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em', marginBottom: '20px', lineHeight: '1.2' }}>
                    Deploy Fully Compliant Global Professional Teams
                  </h2>
                  <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
                    Scale your operational capacity instantly while maintaining complete control. Kongila's automated client operations sandbox provides full EOR protection, smart matching calculations, integrated task trackers, and streamlined consolidated billing.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
                    {[
                      { title: 'Zero Compliance Burden', desc: 'No local entity setup required. Fully legally-insured contracts globally.' },
                      { title: 'Talent Request Sourcing', desc: 'Our intake wizard automates team scoping, sourcing matched A+ professionals instantly.' },
                      { title: 'Streamlined Invoicing', desc: 'Unified invoice processing. Pay all your global staff via a single billing gateway.' }
                    ].map((perk, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ color: '#0047CC', fontWeight: 700 }}>✓</span>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{perk.title}</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{perk.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }}
                    className="btn-primary"
                    style={{ borderRadius: '12px' }}
                  >
                    Start Hiring Intake
                  </button>
                </div>

              </div>
            </section>

            {/* 8. OPERATIONAL EXCELLENCE / WHY KONGILA */}
            <section style={{ maxWidth: '1280px', margin: '112px auto', padding: '0 24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#0047CC', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '12px' }}>Built For Modern Operations</span>
                <h2 style={{ fontSize: '32px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em' }}>
                  Built for Modern Workforce Operations
                </h2>
              </div>

              <div className="excellence-grid" style={{}}>
                {[
                  { title: 'Regulatory Compliance', icon: '⚖️', desc: 'Full adherence to local labor laws, employment contracts, automatic taxes processing, and complete IP protection across all hiring jurisdictions.' },
                  { title: 'Consolidated Global Payroll', icon: '💳', desc: 'Support for multiple currencies. Process paychecks, benefits, bonuses, and contractor reimbursements in a single click.' },
                  { title: 'Identity & Sourcing Trust', icon: '👤', desc: 'Automated KYC checks, verification of academic and professional credentials, and structured behavioral assessments.' },
                  { title: 'Hardware & Infrastructure Matching', icon: '🔌', desc: 'Benchmark-verified remote setups. We guarantee secondary battery backups and fiber internet matching to eliminate power outages.' },
                  { title: 'Active Performance Operations', icon: '📈', desc: 'Continuous task tracking. Automated blocker escalations protect projects, notifying clients immediately of any operational issues.' },
                  { title: 'Scalable Platform Audits', icon: '📝', desc: 'Complete business audit trails. Review operational logs, active MRR calculations, and team performance metrics.' }
                ].map((wh, idx) => (
                  <div key={idx} className="glass-panel" style={{
                    padding: '24px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-glass)',
                    backgroundColor: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <span style={{ fontSize: '24px' }}>{wh.icon}</span>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>{wh.title}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{wh.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 9. PLATFORM FEATURES SECTION */}
            <section style={{ borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)', backgroundColor: '#FFFFFF', padding: '100px 24px' }}>
              <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                  <h2 style={{ fontSize: '32px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em', marginBottom: '16px' }}>
                    All-in-One Platform Features
                  </h2>
                  <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto' }}>
                    Everything you need to orchestrate global remote professional teams without leaving the Kongila system.
                  </p>
                </div>

                <div className="all-features-grid" style={{}}>
                  {[
                    { title: 'Smart Matching Engine', desc: 'Uses skill, timezone, and behavior compatibility scores out of 100.' },
                    { title: '7-Stage Vetting Sandbox', desc: 'Calculates specialized test, work simulation, and communication weights.' },
                    { title: 'Workflow Automation', desc: 'Seamlessly transition from client intake scopes to active task boards.' },
                    { title: 'NDA & Contract Management', desc: 'Automated, compliant E-signatures built directly into checkout.' },
                    { title: 'Blocker Escalation Alerts', desc: 'Flags blocked Kanban tasks instantly to client sponsors.' },
                    { title: 'PIP Performance Warnings', desc: 'Triggers platform evaluation plans if average efficiency slips.' },
                    { title: 'Consolidated Billing Gateway', desc: 'Process global payroll across 12+ countries with one unified invoice.' },
                    { title: 'Multi-Agent Auditing Feed', desc: 'Automated logging of platform events for complete operational audit transparency.' }
                  ].map((feat, idx) => (
                    <div key={idx} style={{
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-glass)',
                      backgroundColor: 'var(--bg-primary)',
                      transition: 'var(--transition-smooth)'
                    }} className="menu-item">
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>{feat.title}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{feat.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 10. WORKFLOW VISUALIZATION SECTION */}
            <section style={{ maxWidth: '1280px', margin: '112px auto', padding: '0 24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#0047CC', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '12px' }}>Operational Lifecycle</span>
                <h2 style={{ fontSize: '32px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em', marginBottom: '16px' }}>
                  Visualizing the Kongila Lifecycle
                </h2>
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto' }}>
                  A secure, audited operational loop built to guarantee deployment speed and performance reliability.
                </p>
              </div>

              {/* Architectural flow */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', border: '1px solid var(--border-glass)', padding: '24px', borderRadius: '16px', flexWrap: 'wrap', gap: '20px' }}>
                {[
                  { id: '1', title: 'Client Intake' },
                  { id: '2', title: 'Matching Engine' },
                  { id: '3', title: 'Shortlist & Interview' },
                  { id: '4', title: 'NDA Contract E-Sign' },
                  { id: '5', title: 'Onboarding & Hardware' },
                  { id: '6', title: 'Remotan Portal Boot' },
                  { id: '7', title: 'Continuous Monitoring' }
                ].map((step, idx) => (
                  <React.Fragment key={idx}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: idx === 6 ? '#16A34A' : '#0047CC',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px'
                      }}>{step.id}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>{step.title}</span>
                    </div>
                    {idx < 6 && (
                      <span style={{ fontSize: '16px', color: '#9CA3AF' }} className="hide-mobile">➔</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </section>

            {/* 11. TESTIMONIAL SECTION */}
            <section style={{ borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)', backgroundColor: '#FFFFFF', padding: '100px 24px' }}>
              <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                  <h2 style={{ fontSize: '32px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em', marginBottom: '16px' }}>
                    Trusted by Operational Leaders & Exceptional Talents
                  </h2>
                </div>

                <div className="testimonial-grid" style={{}}>
                  {/* Testimonial 1 */}
                  <div className="glass-panel" style={{
                    padding: '32px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-glass)',
                    backgroundColor: '#FAFAFA',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                  }}>
                    <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', fontStyle: 'italic' }}>
                      "Prior to partnering with Kongila, scaling our backend systems across multiple regional timezones was a regulatory and vetting headache. Their 7-stage composite vetting scores and auto-NDA frameworks reduced our onboarding times from 6 weeks to 3 days, backed by EOR protection."
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0047CC', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>DO</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>David O.</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>VP of Operations • FinTech Global</div>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial 2 */}
                  <div className="glass-panel" style={{
                    padding: '32px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-glass)',
                    backgroundColor: '#FAFAFA',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                  }}>
                    <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', fontStyle: 'italic' }}>
                      "Being a member of the Kongila professional network has completely transformed my career path. I enjoy direct access to elite international companies, compliant local labor contracts, fully financed premium workspaces, and completely synchronized monthly payouts."
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0B6E99', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>BA</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Benita A.</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Senior Operations Specialist • Kongila Network</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 12. FINAL CTA SECTION */}
            <section style={{ maxWidth: '1280px', margin: '112px auto', padding: '0 24px' }}>
              <div className="final-cta-container" style={{
                background: 'linear-gradient(135deg, rgba(0, 71, 204, 0.05) 0%, rgba(11, 110, 153, 0.05) 100%)',
                border: '1px solid rgba(0, 71, 204, 0.15)',
                borderRadius: '24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px'
              }}>
                <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 600, color: '#111827', letterSpacing: '-0.03em', maxWidth: '640px', lineHeight: '1.15' }}>
                  Build Your Global Workforce with Complete Confidence
                </h2>
                
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '540px', lineHeight: '1.6' }}>
                  Access top vetted talent, lock down labor law compliance, and coordinate remote task delivery in one system. Start your operations with Kongila today.
                </p>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
                  <button 
                    onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }}
                    className="btn-primary"
                    style={{ height: '48px', padding: '0 32px', borderRadius: '12px', fontSize: '15px' }}
                  >
                    Hire Talent
                  </button>
                  <button 
                    onClick={() => { setAuthView('signup'); setAuthRole('talent'); setNameInput(''); setEmailInput(''); setPasswordInput(''); }}
                    className="btn-secondary"
                    style={{ height: '48px', padding: '0 32px', borderRadius: '12px', fontSize: '15px' }}
                  >
                    Join as Talent
                  </button>
                </div>
              </div>
            </section>

            {/* 13. FOOTER */}
            <footer style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid var(--border-glass)', padding: '80px 24px 40px 24px' }}>
              <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                <div className="footer-grid" style={{ marginBottom: '64px' }}>
                  
                  {/* Left Column: Brand */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                      <KongilaLogo size={28} textColor="#1A2340" />
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px', maxWidth: '240px' }}>
                      Global workforce infrastructure and operational execution systems for modern enterprises.
                    </p>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      © 2026 Kongila Systems Inc. All rights reserved.
                    </div>
                  </div>

                  {/* Columns 2-5: Navigation links */}
                  {[
                    {
                      title: 'Solutions',
                      links: ['Managed Workforce', 'Talent Outsourcing', 'Direct Sourcing', 'Project Execution']
                    },
                    {
                      title: 'Talent Network',
                      links: ['Apply as Talent', 'Vetting Criteria', 'Workspace Matching', 'Resource Portal']
                    },
                    {
                      title: 'Company',
                      links: ['About Infrastructure', 'Brand Mission', 'Partner Hub', 'Careers']
                    },
                    {
                      title: 'Legal & Risk',
                      links: ['EOR Compliance', 'Privacy Policy', 'IP Ownership', 'NDA Frameworks']
                    }
                  ].map((col, idx) => (
                    <div key={idx}>
                      <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>{col.title}</h4>
                      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', padding: 0 }}>
                        {col.links.map((link) => (
                          <li key={link}>
                            <a 
                              onClick={() => {
                                if (link.includes('Hire') || link.includes('Intake') || link.includes('Solutions')) {
                                  setClientIntakeActive(true);
                                  setClientIntakeStep(1);
                                } else {
                                  setAuthView('signup');
                                  setAuthRole('talent');
                                }
                              }}
                              style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none', cursor: 'pointer', transition: 'var(--transition-smooth)' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#0047CC'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                            >
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Bottom line: Social links & Compliance statement */}
                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '720px', lineHeight: '1.6' }}>
                    Disclaimer: Kongila acts as Employer of Record (EOR) under regional partnership agreements in local hiring jurisdictions. All contractor compensation is structured through authorized local banking and payroll partners.
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {['Twitter', 'GitHub', 'LinkedIn'].map((soc) => (
                      <span key={soc} style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }} onMouseEnter={e => e.currentTarget.style.color = '#0047CC'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>{soc}</span>
                    ))}
                  </div>
                </div>
              </div>
            </footer>
          </div>
        )}

        {/* ====================================================================== */}
        {/* CLIENT SMART INTAKE FLOW (Smart Intake FIRST) */}
        {/* ====================================================================== */}
        {clientIntakeActive && (
          <div className="intake-container" style={{
            minHeight: '100vh',
            width: '100%',
            backgroundColor: 'var(--bg-primary, #F5F7FA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box'
          }}>
            <GlassCard className="intake-card" style={{ maxWidth: '650px', width: '100%' }}>
            {/* Header step counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-purple)' }}>💼</span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Talent Request</h2>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Step {clientIntakeStep} of 5</div>
            </div>

            {/* Progress lines */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
              {[1, 2, 3, 4, 5].map(s => (
                <div 
                  key={s} 
                  style={{
                    flex: 1, 
                    height: '4px', 
                    borderRadius: '2px', 
                    background: clientIntakeStep >= s ? 'var(--accent-purple)' : 'var(--border-glass)',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>

            {/* Screen 1: Service Selection */}
            {clientIntakeStep === 1 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>What service level do you require?</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Select an engagement structure scaled to your operational backing.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { id: 'Managed Workforce', title: 'Managed Workforce', icon: '🛡️', desc: 'Kongila manages performance, systems and EOR directly. High supervision.' },
                    { id: 'Outsource Talent', title: 'Outsource Talent', icon: '⚡', desc: 'Kongila pays talent; client manages execution directly. Lighter oversight.' },
                    { id: 'Hire Talent', title: 'Direct Placement', icon: '🔍', desc: 'Full sourcing and vetting engine. recommended shortlist deployable instantly.' },
                    { id: 'Project Execution', title: 'Project Execution', icon: '📋', desc: 'Client prepays project milestone scopes. Direct delivery manager assigned.' }
                  ].map(item => (
                    <div 
                      key={item.id}
                      onClick={() => setFormData({ ...formData, serviceType: item.id as ServiceType })}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        border: `1.5px solid ${formData.serviceType === item.id ? 'var(--accent-purple)' : 'var(--border-glass)'}`,
                        background: formData.serviceType === item.id ? 'var(--accent-purple-glow)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{item.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <NeonButton variant="ghost" onClick={() => setClientIntakeActive(false)}>Cancel</NeonButton>
                  <NeonButton onClick={() => setClientIntakeStep(2)}>Continue to Details</NeonButton>
                </div>
              </div>
            )}

            {/* Screen 2: Requirement Details */}
            {clientIntakeStep === 2 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>Describe your requirement details</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Provide operational description to scan matching engine profiles.</p>

                <div className="form-group">
                  <label className="form-label">Role Title & Core Focus</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.roleDescription}
                    onChange={e => setFormData({ ...formData, roleDescription: e.target.value })}
                    placeholder="e.g. Senior Operations Specialist to optimize workload pipelines"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Required Skills (Comma separated)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.requiredSkills}
                    onChange={e => setFormData({ ...formData, requiredSkills: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Example: React, Node.js, TypeScript, PostgreSQL
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <NeonButton variant="secondary" onClick={() => setClientIntakeStep(1)}>Back</NeonButton>
                  <NeonButton onClick={() => setClientIntakeStep(3)}>Continue to Schedule</NeonButton>
                </div>
              </div>
            )}

            {/* Screen 3: Schedule, Timezone & Budget */}
            {clientIntakeStep === 3 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>Schedule, Commitment & Budget</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Enter work schedule parameters and monthly USD allowance.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Timezone Alignment</label>
                    <select 
                      className="form-select"
                      value={formData.timezone}
                      onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                    >
                      <option>GMT+1 (Lagos / London)</option>
                      <option>GMT (Dakar / Accra)</option>
                      <option>EST (New York / Boston)</option>
                      <option>PST (San Francisco)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Commitment Scale</label>
                    <select 
                      className="form-select"
                      value={formData.commitmentLevel}
                      onChange={e => setFormData({ ...formData, commitmentLevel: e.target.value })}
                    >
                      <option>Full Time (40h/week)</option>
                      <option>Part Time (20h/week)</option>
                      <option>Hourly / Freelance</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Target Start Date</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={formData.startDate}
                      onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">No. of Hires</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={formData.numberOfHires}
                      onChange={e => setFormData({ ...formData, numberOfHires: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Monthly USD Budget</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={formData.budget}
                      onChange={e => setFormData({ ...formData, budget: parseInt(e.target.value) || 2000 })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Deployment Urgency</label>
                    <select 
                      className="form-select"
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <NeonButton variant="secondary" onClick={() => setClientIntakeStep(2)}>Back</NeonButton>
                  <NeonButton onClick={() => setClientIntakeStep(4)}>Continue to Account</NeonButton>
                </div>
              </div>
            )}

            {/* Screen 4: Client Account Creation (Smart Intake FIRST!) */}
            {clientIntakeStep === 4 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>Secure your account to match</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Provide company credentials to generate active sourcing requests.</p>

                {/* Google Sign in shortcut */}
                <button 
                  type="button"
                  onClick={() => simulateGoogleLogin('client')}
                  style={{
                    width: '100%', 
                    height: '44px', 
                    borderRadius: '8px', 
                    background: 'var(--bg-secondary)', 
                    color: 'var(--text-primary)', 
                    border: '1px solid var(--border-glass)', 
                    fontWeight: 600, 
                    fontSize: '13px', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    marginBottom: '24px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🔴</span> Continue with Google
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0', color: 'var(--text-muted)' }}>
                  <div style={{ flexGrow: 1, height: '1px', background: 'var(--border-glass)' }} />
                  <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>or use email credentials</span>
                  <div style={{ flexGrow: 1, height: '1px', background: 'var(--border-glass)' }} />
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!emailInput || !passwordInput || !nameInput || !companyInput) {
                    triggerBanner('Please complete all authentication fields.', 'error');
                    return;
                  }
                  const clientUser = {
                    id: `user_${Date.now()}`,
                    name: nameInput,
                    email: emailInput,
                    role: 'client' as const,
                    onboardingStatus: 'incomplete',
                    emailVerified: false,
                    companyName: companyInput,
                    createdAt: new Date().toISOString()
                  };
                  setCurrentUser(clientUser);
                  setClientIntakeStep(5);
                  triggerBanner('Verification email triggered via Resend.', 'info');
                }}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      placeholder="Alex Mercer"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={companyInput}
                      onChange={e => setCompanyInput(e.target.value)}
                      placeholder="Vanguard Tech Corp"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      placeholder="alex@vanguard.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                    <NeonButton variant="secondary" type="button" onClick={() => setClientIntakeStep(3)}>Back</NeonButton>
                    <NeonButton type="submit">Complete Intake & Register</NeonButton>
                  </div>
                </form>
              </div>
            )}

            {/* Screen 5: Progressive Email Verification (For Client flow) */}
            {clientIntakeStep === 5 && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--accent-purple)' }}>✉</div>
                <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>Verify email to initialize scans</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '32px' }}>
                  We sent a secure verification link to <strong>{emailInput}</strong> via Resend. Please verify to finalize your request.
                </p>

                <GlassCard style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)', padding: '20px', marginBottom: '32px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>DEVELOPMENT TEST HELPER</div>
                  <button 
                    onClick={simulateEmailVerification}
                    style={{
                      background: 'var(--accent-purple-glow)', 
                      color: 'var(--accent-purple)', 
                      border: '1.5px solid var(--accent-purple)', 
                      borderRadius: '8px', 
                      height: '38px', 
                      padding: '0 20px', 
                      fontSize: '12px', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      width: '100%',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    Simulate Email Verification (Resend Webhook)
                  </button>
                </GlassCard>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Didn't receive the email? <span style={{ color: 'var(--accent-purple)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => triggerBanner('Resent verification email successfully.', 'info')}>Click here to resend</span>
                </div>
              </div>
            )}

          </GlassCard>
          </div>
        )}

        {/* ====================================================================== */}
        {/* UNIFIED AUTHENTICATION VIEWS (Sign-Up / Sign-In / Verification Modal) */}
        {/* ====================================================================== */}
        {/* Auth two-panel: only login / signup / verify — NOT onboarding */}
        {(authView === 'login' || authView === 'signup' || authView === 'verify') && !clientIntakeActive && (
          <div style={{
            minHeight: '100vh',
            width: '100%',
            display: 'flex',
            backgroundColor: 'var(--bg-secondary, #FFFFFF)'
          }}>
            {/* Left Brand Panel — hidden on mobile */}
            <div className="auth-brand-panel hide-mobile" style={{
              flex: 1,
              display: 'flex',
              backgroundColor: 'var(--kongila-dark-navy)',
              color: '#FFFFFF',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '60px',
              position: 'relative',
              overflow: 'hidden'
            }}>
               <div style={{ zIndex: 2, position: 'relative' }}>
                 <KongilaLogo size={48} />
                 <h1 style={{ marginTop: '40px', fontSize: '32px', fontWeight: 800, lineHeight: 1.2 }}>
                   The premium infrastructure for global workforce operations.
                 </h1>
                 <p style={{ marginTop: '16px', fontSize: '16px', color: 'rgba(255,255,255,0.7)', maxWidth: '400px' }}>
                   Securely hire, manage, and deploy top-tier operational talent around the world, completely compliance-free.
                 </p>
               </div>
               
               <div style={{ zIndex: 2, position: 'relative' }}>
                 <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>© {new Date().getFullYear()} Kongila Global Inc.</p>
               </div>
               
               {/* Abstract background elements */}
               <div style={{
                 position: 'absolute',
                 bottom: '-10%',
                 right: '-10%',
                 width: '400px',
                 height: '400px',
                 background: 'var(--accent-purple)',
                 filter: 'blur(100px)',
                 opacity: 0.4,
                 borderRadius: '50%',
                 zIndex: 1
               }} />
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
                  Access premium remote EOR opportunities globally.
                </p>

                {/* Role Switch */}
                <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px', marginBottom: '24px' }}>
                  <button 
                    type="button"
                    onClick={() => setAuthRole('talent')}
                    style={{
                      flex: 1, 
                      height: '32px', 
                      background: authRole === 'talent' ? 'var(--accent-cyan)' : 'transparent',
                      color: authRole === 'talent' ? '#000' : 'var(--text-secondary)',
                      border: 'none', 
                      borderRadius: '6px', 
                      fontWeight: 700, 
                      fontSize: '12px', 
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Find Remote Work
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAuthRole('client')}
                    style={{
                      flex: 1, 
                      height: '32px', 
                      background: authRole === 'client' ? 'var(--accent-cyan)' : 'transparent',
                      color: authRole === 'client' ? '#000' : 'var(--text-secondary)',
                      border: 'none', 
                      borderRadius: '6px', 
                      fontWeight: 700, 
                      fontSize: '12px', 
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Hire Vetted Talent
                  </button>
                </div>

                {/* OAuth Mock buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                  <button 
                    type="button"
                    onClick={() => simulateGoogleLogin(authRole)}
                    style={{
                      height: '40px', 
                      borderRadius: '8px', 
                      background: '#fff', 
                      color: '#000', 
                      border: 'none', 
                      fontWeight: 700, 
                      fontSize: '13px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    🔴 Continue with Google
                  </button>
                  {authRole === 'talent' && (
                    <button 
                      type="button"
                      onClick={simulateLinkedInLogin}
                      style={{
                        height: '40px', 
                        borderRadius: '8px', 
                        background: '#0077b5', 
                        color: '#fff', 
                        border: 'none', 
                        fontWeight: 700, 
                        fontSize: '13px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      🔵 Continue with LinkedIn
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0', color: 'var(--text-muted)' }}>
                  <div style={{ flexGrow: 1, height: '1px', background: 'var(--border-glass)' }} />
                  <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>or credentials</span>
                  <div style={{ flexGrow: 1, height: '1px', background: 'var(--border-glass)' }} />
                </div>

                {/* Form */}
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

                  {authRole === 'client' && (
                    <div className="form-group">
                      <label className="form-label">Company Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={companyInput}
                        onChange={e => setCompanyInput(e.target.value)}
                        placeholder="e.g. Vanguard Tech Corp"
                      />
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
                    <input 
                      type="password" 
                      className="form-input" 
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                    />
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
                    <input 
                      type="password" 
                      className="form-input" 
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                    />
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
                  Don't have an account? <span style={{ color: 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setAuthView('signup')}>Sign Up</span>
                </div>
              </div>
            )}

            {/* View: Email Verification screen (Resend Simulation) */}
            {authView === 'verify' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉</div>
                <h3 style={{ fontSize: '20px', marginBottom: '8px', color: '#fff' }}>Verify email credentials</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '32px' }}>
                  We dispatched a secure authentication key to <strong>{emailInput || 'your email'}</strong> via Resend. Check your inbox to unlock onboarding.
                </p>

                <GlassCard style={{ background: 'rgba(0, 255, 204, 0.02)', padding: '20px', marginBottom: '32px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>DEVELOPMENT SANDBOX WEBHOOK</div>
                  <button 
                    onClick={simulateEmailVerification}
                    style={{
                      background: 'rgba(0, 255, 204, 0.1)', 
                      color: 'var(--accent-cyan)', 
                      border: '1.5px solid var(--accent-cyan)', 
                      borderRadius: '8px', 
                      height: '38px', 
                      padding: '0 20px', 
                      fontSize: '12px', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    Simulate Email Verification (Resend Trigger)
                  </button>
                </GlassCard>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Refuse link? <span style={{ color: 'var(--accent-magenta)', cursor: 'pointer', textDecoration: 'underline' }} onClick={handleSignOut}>Cancel</span>
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
          <GlassCard style={{ maxWidth: '700px', margin: '40px auto', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🧙‍♂️</span>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Talent Onboarding Wizard</h2>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Step {talentWizardStep} of 6</div>
            </div>

            {/* Wizard Steps Timeline */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
              {[1, 2, 3, 4, 5, 6].map(s => (
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
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>1. Basic Contact Profile</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Let's start simple. Enter your primary location and availability metrics.</p>

                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.fullName}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, fullName: e.target.value })}
                    placeholder="Chidi Anya"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Phone Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.phone}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, phone: e.target.value })}
                    placeholder="+234 803 929 1827"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Country</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={talentOnboardingData.country}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, country: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">City</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={talentOnboardingData.city}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, city: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Timezone Alignment</label>
                  <select 
                    className="form-select"
                    value={talentOnboardingData.timezone}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, timezone: e.target.value })}
                  >
                    <option>GMT+1 (Lagos / London)</option>
                    <option>GMT (Dakar / Accra)</option>
                    <option>GMT+2 (Johannesburg)</option>
                    <option>GMT+3 (Nairobi)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <NeonButton variant="ghost" onClick={handleSignOut}>Exit Onboarding</NeonButton>
                  <NeonButton onClick={() => setTalentWizardStep(2)}>Continue</NeonButton>
                </div>
              </div>
            )}

            {/* Step 2: Professional Info */}
            {talentWizardStep === 2 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>2. Professional Experience</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Map your professional skill footprint and primary career titles.</p>

                <div className="form-group">
                  <label className="form-label">Primary Professional Title</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.primaryRole}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, primaryRole: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Years of Relevant Experience</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={talentOnboardingData.yearsExperience}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, yearsExperience: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Seniority Grade</label>
                    <select 
                      className="form-select"
                      value={talentOnboardingData.seniorityLevel}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, seniorityLevel: e.target.value })}
                    >
                      <option>Junior</option>
                      <option>Mid-Level</option>
                      <option>Senior</option>
                      <option>Principal / Lead</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Skills (Comma separated)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.skills}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, skills: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Employment Pref</label>
                  <select 
                    className="form-select"
                    value={talentOnboardingData.employmentPreference}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, employmentPreference: e.target.value })}
                  >
                    <option>Full Time</option>
                    <option>Part Time</option>
                    <option>Hourly / Contract</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <NeonButton variant="secondary" onClick={() => setTalentWizardStep(1)}>Back</NeonButton>
                  <NeonButton onClick={() => setTalentWizardStep(3)}>Continue</NeonButton>
                </div>
              </div>
            )}

            {/* Step 3: Compensation */}
            {talentWizardStep === 3 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>3. Compensation Expectation</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>State your gross financial targets inside supported currencies.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }} className="form-group">
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Expectation Value</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={talentOnboardingData.salaryExpectation}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, salaryExpectation: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Currency</label>
                    <select 
                      className="form-select"
                      value={talentOnboardingData.currency}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, currency: e.target.value })}
                    >
                      <option>USD ($)</option>
                      <option>EUR (€)</option>
                      <option>GBP (£)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payout Period</label>
                  <select 
                    className="form-select"
                    value={talentOnboardingData.hourlyMonthly}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, hourlyMonthly: e.target.value })}
                  >
                    <option>Monthly Gross salary</option>
                    <option>Hourly bill rate</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <NeonButton variant="secondary" onClick={() => setTalentWizardStep(2)}>Back</NeonButton>
                  <NeonButton onClick={() => setTalentWizardStep(4)}>Continue</NeonButton>
                </div>
              </div>
            )}

            {/* Step 4: Documents (Supabase Storage upload progress) */}
            {talentWizardStep === 4 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>4. Upload Compliance Documents</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Provide encrypted EOR files (CV, Portfolio or certifications).</p>

                <div className="form-group" style={{ background: 'var(--bg-tertiary)', padding: '24px', borderRadius: '10px', textAlign: 'center', border: '1.5px dashed var(--border-glass)' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>📁</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Curriculum Vitae (PDF)</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '16px' }}>Limit: 10MB. Enrypted under ISO security standard.</div>

                  {uploadProgress > 0 && (
                    <div style={{ width: '100%', background: 'var(--bg-primary)', height: '6px', borderRadius: '3px', margin: '16px 0', overflow: 'hidden' }}>
                      <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent-cyan)', boxShadow: '0 0 10px var(--accent-cyan-glow)', transition: 'width 0.2s ease' }} />
                    </div>
                  )}

                  <button 
                    type="button"
                    onClick={triggerMockUpload}
                    disabled={mockUploading}
                    style={{
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--border-glass)', 
                      height: '36px', 
                      borderRadius: '6px', 
                      color: 'var(--accent-cyan)', 
                      fontSize: '12px', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      padding: '0 16px'
                    }}
                  >
                    {mockUploading ? `Uploading (${uploadProgress}%)` : uploadProgress === 100 ? 'Re-upload CV Document' : 'Select PDF and Upload'}
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Portfolio Link (GitHub / Dribbble)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.portfolioUrl}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, portfolioUrl: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Professional Certifications</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.certifications}
                    placeholder="AWS, Scrum Master, Google UX certs"
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, certifications: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <NeonButton variant="secondary" onClick={() => setTalentWizardStep(3)}>Back</NeonButton>
                  <NeonButton onClick={() => setTalentWizardStep(5)} disabled={uploadProgress < 100}>Continue</NeonButton>
                </div>
              </div>
            )}

            {/* Step 5: Remote Readiness */}
            {talentWizardStep === 5 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>5. Remote Readiness Check</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Verify hardware capability, fiber redundancy, and communication tool experience.</p>

                <div className="form-group">
                  <label className="form-label">Internet Infrastructure & Backup Plan</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.internetQuality}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, internetQuality: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Home Office Setup (Inverter / UPS)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.workSetup}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, workSetup: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Hardware Workstation Devices</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.devices}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, devices: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Familiar Slack / Collaboration systems</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.communicationTools}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, communicationTools: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <NeonButton variant="secondary" onClick={() => setTalentWizardStep(4)}>Back</NeonButton>
                  <NeonButton onClick={() => setTalentWizardStep(6)}>Continue to Finalization</NeonButton>
                </div>
              </div>
            )}

            {/* Step 6: Finalization */}
            {talentWizardStep === 6 && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '64px', marginBottom: '20px', color: 'var(--accent-green)' }}>✓</div>
                <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', color: '#fff' }}>Application Ready!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto 32px auto' }}>
                  Your progressive profile, EOR documentation and workspace checks are established. Click complete to spawn your dashboard and initiate active specialized screening.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                  <NeonButton variant="secondary" onClick={() => setTalentWizardStep(5)}>Review Setup</NeonButton>
                  <button 
                    type="button" 
                    onClick={handleTalentWizardSubmit}
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-green), #2db33d)', 
                      color: '#000', 
                      border: 'none', 
                      borderRadius: '8px', 
                      height: '42px', 
                      padding: '0 32px', 
                      fontSize: '14px', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(51, 255, 87, 0.2)'
                    }}
                  >
                    Complete Onboarding
                  </button>
                </div>
              </div>
            )}

          </GlassCard>
        )}


        {/* ====================================================================== */}
        {/* CODING ASSESSMENT SANDBOX MODAL (For Pending Talent) */}
        {/* ====================================================================== */}
        {showAssessment && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '650px', padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Workload Optimization Strategy Sandbox</h3>
                <span style={{ fontSize: '12px', background: 'rgba(0, 255, 204, 0.1)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '4px' }}>Time Allowed: 3 Hours</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '24px' }}>
                Our operational sandbox encounters workflow bottlenecks. Write a clean operational scaling strategy or workflow optimization plan that reduces delivery latency.
              </p>

              <div className="agent-terminal" style={{ marginBottom: '20px' }}>
                <div className="terminal-header">
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>STRATEGY EDITOR</span>
                </div>
                <textarea 
                  className="terminal-body" 
                  value={codeAnswer}
                  onChange={e => setCodeAnswer(e.target.value)}
                  style={{
                    width: '100%', 
                    height: '200px', 
                    background: '#01050a', 
                    color: '#00ffcc', 
                    fontFamily: 'monospace', 
                    fontSize: '12px',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    padding: '16px'
                  }}
                  placeholder="// Write your operational strategy or workload optimization plan here..."
                />
              </div>

              {assessmentFeedback && (
                <div style={{
                  padding: '12px', 
                  borderRadius: '6px', 
                  background: assessmentFeedback.includes('Error') ? 'rgba(255, 0, 127, 0.1)' : 'rgba(51, 255, 87, 0.1)', 
                  border: `1px solid ${assessmentFeedback.includes('Error') ? 'var(--accent-magenta)' : 'var(--accent-green)'}`,
                  color: assessmentFeedback.includes('Error') ? 'var(--accent-magenta)' : 'var(--accent-green)',
                  fontSize: '12px',
                  marginBottom: '20px',
                  lineHeight: 1.5
                }}>
                  {assessmentFeedback}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <NeonButton variant="ghost" onClick={() => setShowAssessment(false)}>Exit Challenge</NeonButton>
                <NeonButton onClick={handleAssessmentSubmit}>Submit & Grade Answer</NeonButton>
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
        {currentUser && currentUser.role === 'talent' && !authView && !clientIntakeActive && activeTab === 'talent' && (
          <TalentDashboard
            currentUser={currentUser}
            talentProfile={getCurrentTalentProfile()}
            contracts={contracts}
            matches={matches}
            onSignOut={handleSignOut}
            onUpdateProfile={handleUpdateProfile}
          />
        )}

        {/* ====================================================================== */}
        {/* FULL PORTALS: ACTIVE CLIENT DASHBOARD (Clients only) */}
        {/* ====================================================================== */}
        {currentUser && currentUser.role === 'client' && !authView && !clientIntakeActive && activeTab === 'client' && (
          <ClientDashboard
            currentUser={currentUser}
            requests={requests}
            matches={matches}
            contracts={contracts}
            talents={talents}
            invoices={invoices}
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
            setInvoices={setInvoices}
            setMessages={setMessages}
            setNotifications={setNotifications}
            onAddRequest={async (newReq) => {
              const calculatedMatches = generateMatchesForRequest(newReq, talents);
              const updatedRequests = [...requests, newReq];
              const updatedMatches = [...matches, ...calculatedMatches];
              
              setRequests(updatedRequests);
              setMatches(updatedMatches);
              setSelectedRequest(newReq);

              const updatedDb = {
                talents,
                clientRequests: updatedRequests,
                matches: updatedMatches,
                tasks: [],
                contracts,
                notifications: [
                  {
                    id: `notif_${Date.now()}`,
                    userId: currentUser.id,
                    title: 'New Service Request Created',
                    message: `Created request matching your intake: ${newReq.roleDescription || newReq.title}. Scanning vetting databases.`,
                    read: false,
                    createdAt: new Date().toISOString()
                  },
                  ...notifications
                ],
                auditLogs: [
                  {
                    id: `audit_${Date.now()}`,
                    actor: currentUser.name,
                    action: 'Service Request Intake Completed',
                    details: `Service Request generated: ${newReq.roleDescription || newReq.title}.`,
                    timestamp: new Date().toISOString()
                  }
                ],
                agentLogs: [
                  {
                    id: `alog_client_${Date.now()}`,
                    agentName: 'Context Agent',
                    message: `Talent vetting session initiated for role: ${newReq.roleDescription || newReq.title}.`,
                    timestamp: new Date().toLocaleTimeString(),
                    type: 'success'
                  }
                ]
              };
              
              await saveToDb(updatedDb);
              triggerBanner('New Service Request created! Matchmaker engine initialized.', 'success');
            }}
          />
        )}

      </div>

      {/* ====================================================================== */}
      {/* MOCK OVERLAYS: MODAL FOR INTERVIEW SCHEDULER & CONTRACT E-SIGNATURES */}
      {/* ====================================================================== */}


    </div>
  );
}
