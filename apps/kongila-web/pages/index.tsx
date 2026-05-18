import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { GlassCard, Badge, NeonButton } from '@kongila/ui';
import { formatCurrency, formatDate, getGradeColor } from '@kongila/utils';
import { generateMatchesForRequest } from '@kongila/matching-engine';
import { generateNDATemplate, generateContractTemplate } from '@kongila/contracts';
import { 
  TalentProfile, ServiceRequest, Match, Contract, ServiceType
} from '@kongila/shared-types';

export default function KongilaWeb() {
  // DB States
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
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
    primaryRole: 'Senior Full-Stack Engineer',
    yearsExperience: 5,
    seniorityLevel: 'Senior',
    skills: 'React, Node.js, TypeScript, PostgreSQL',
    employmentPreference: 'Full Time',
    availability: 100,
    salaryExpectation: 4500,
    hourlyMonthly: 'Monthly',
    currency: 'USD',
    cvName: 'CV_Engineering_Lead.pdf',
    portfolioUrl: 'https://github.com/talent-profile',
    certifications: 'AWS Certified Developer',
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
    roleDescription: 'Senior Backend Developer to optimize Postgres microservices.',
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
    syncFromDb();
    // Poll DB every 3 seconds to get instant updates from Admin/Remotan actions
    const interval = setInterval(syncFromDb, 3000);
    return () => clearInterval(interval);
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
          message: `Your smart intake for a ${formData.serviceType} is submitted! Vetted matching scanned.`,
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
    triggerBanner('Smart Intake request submitted successfully! Sourcing vetting scans.', 'success');
  };

  // Auth Submissions
  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput || !nameInput) {
      triggerBanner('Please fill in all credentials fields.', 'error');
      return;
    }

    const newUser = {
      id: `user_${Date.now()}`,
      name: nameInput,
      email: emailInput,
      role: authRole,
      onboardingStatus: 'incomplete',
      emailVerified: false,
      companyName: authRole === 'client' ? companyInput : undefined,
      createdAt: new Date().toISOString()
    };

    setCurrentUser(newUser);
    setAuthView('verify');
    triggerBanner('Account created! Supabase email verification sent.', 'info');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      triggerBanner('Please provide your email and password.', 'error');
      return;
    }

    // Check if client or admin
    let matchedRole: 'talent' | 'client' | 'admin' = 'talent';
    let onboardingState: any = 'incomplete';
    let verifiedState = true;

    if (emailInput.toLowerCase().includes('client') || emailInput.toLowerCase().includes('alex')) {
      matchedRole = 'client';
      onboardingState = 'complete';
    } else if (emailInput.toLowerCase().includes('admin')) {
      matchedRole = 'admin';
      onboardingState = 'complete';
    } else {
      matchedRole = 'talent';
      // Look up in database if talent exists
      const foundTalent = talents.find(t => t.email.toLowerCase() === emailInput.toLowerCase());
      if (foundTalent) {
        onboardingState = foundTalent.vettingStatus === 'Vetted' || foundTalent.vettingStatus === 'Deployed' ? 'complete' : 'incomplete';
      }
    }

    const loggedInUser = {
      id: `user_${Date.now()}`,
      name: nameInput || (matchedRole === 'client' ? 'Alex Mercer' : 'Chidi Anya'),
      email: emailInput,
      role: matchedRole,
      onboardingStatus: onboardingState,
      emailVerified: verifiedState,
      companyName: matchedRole === 'client' ? 'Vanguard Corp' : undefined,
      createdAt: new Date().toISOString()
    };

    setCurrentUser(loggedInUser);
    setAuthView(null);

    if (matchedRole === 'talent') {
      setActiveTab('talent');
    } else {
      setActiveTab('client');
    }
    triggerBanner(`Logged in successfully as ${loggedInUser.name}!`, 'success');
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
          action: 'Smart Intake Completed & Authenticated',
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
    triggerBanner('Smart Intake and Client organization established! Vetting scans initialized.', 'success');
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

  // Simulate Technical Coding Assessment Sandbox
  const handleAssessmentSubmit = () => {
    if (codeAnswer.length < 50) {
      setAssessmentFeedback('Error: Optimization logic too brief. Provide structural queries or functions.');
      return;
    }

    setAssessmentFeedback('Analyzing syntax efficiency & performance footprint...');
    setTimeout(async () => {
      setAssessmentFeedback('Success: Vetting score calculated at 92/100 (Grade A+ Elite)! Optimization query verified.');
      
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
              message: 'Your Postgres technical challenge score computed at 92%! Interview booked.',
              read: false,
              createdAt: new Date().toISOString()
            }
          ],
          auditLogs: [
            {
              id: `audit_${Date.now()}`,
              actor: currentTalent.name,
              action: 'Technical Challenge Submited',
              details: 'Scored 92/100 in structural PostgreSQL optimization sandbox.',
              timestamp: new Date().toISOString()
            }
          ],
          agentLogs: [
            {
              id: `alog_v_${Date.now()}`,
              agentName: 'Vetting Agent',
              message: `Technical assessment compiled for ${currentTalent.name}: 92% efficiency. Escalated to scheduling.`,
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

  const handleSignOut = () => {
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


      {/* Floating Banners */}
      {bannerMessage && (
        <div className="floating-alert" style={{
          borderLeft: `4px solid ${bannerType === 'success' ? 'var(--accent-green)' : bannerType === 'error' ? 'var(--accent-magenta)' : 'var(--accent-cyan)'}`,
          background: 'rgba(5, 12, 20, 0.9)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
        }}>
          <div className="alert-icon" style={{
            color: bannerType === 'success' ? 'var(--accent-green)' : bannerType === 'error' ? 'var(--accent-magenta)' : 'var(--accent-cyan)'
          }}>
            {bannerType === 'success' ? '✓' : bannerType === 'error' ? '⚠' : 'ℹ'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>SYSTEM ALERT</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{bannerMessage}</div>
          </div>
        </div>
      )}

      {/* Sidebar navigation (Dashboard view only) */}
      {currentUser && !authView && !clientIntakeActive && (
        <div className="sidebar">
          <div className="sidebar-logo">
            <span style={{
              background: '#0047CC', 
              color: '#fff', 
              padding: '2px 8px', 
              borderRadius: '4px', 
              fontSize: '18px', 
              fontWeight: 800,
              marginRight: '4px'
            }}>K</span>
            <span style={{ color: '#0047CC' }}>Kongila</span>
          </div>
          <div className="sidebar-menu">
            <div 
              className={`menu-item ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <span>🏠</span> Overview Hub
            </div>

            {currentUser.role === 'talent' && (
              <div 
                className={`menu-item ${activeTab === 'talent' ? 'active' : ''}`}
                onClick={() => setActiveTab('talent')}
              >
                <span>👨‍💻</span> Talent Portal
              </div>
            )}

            {currentUser.role === 'client' && (
              <div 
                className={`menu-item ${activeTab === 'client' ? 'active' : ''}`}
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
        marginLeft: (currentUser && !authView && !clientIntakeActive) ? '240px' : '0', 
        maxWidth: (currentUser && !authView && !clientIntakeActive) ? '1200px' : '900px',
        transition: 'var(--transition-smooth)'
      }}>
        
        {/* ====================================================================== */}
        {/* MARKETING HUB & HERO (Shown if not logged in AND not inside intake/auth) */}
        {/* ====================================================================== */}
        {!currentUser && !authView && !clientIntakeActive && (
          <div>
            {/* Horizontal Header */}
            <div style={{
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '64px',
              paddingBottom: '20px',
              borderBottom: '1px solid var(--border-glass)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: '#0047CC', 
                  color: '#fff', 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  fontSize: '20px', 
                  fontWeight: 800
                }}>K</span>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>Kongila</span>
              </div>
              <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                <span style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-secondary)'}>Brand Mission</span>
                <span style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-secondary)'}>Infrastructure</span>
                <span style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-secondary)'}>Vetting Sandbox</span>
                <span style={{ cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-secondary)'}>Remotan OS</span>
              </div>
              <div>
                <NeonButton onClick={() => { setAuthView('login'); setEmailInput(''); setPasswordInput(''); }} variant="secondary">
                  Access Portal
                </NeonButton>
              </div>
            </div>

            {/* Hero Segment */}
            <div style={{ textAlign: 'center', margin: '48px 0 64px 0' }}>
              <div style={{ display: 'inline-block', marginBottom: '16px' }}>
                <Badge text="🚀 Africa's Leading EOR Infrastructure" status="Active" />
              </div>
              <h1 style={{ 
                fontSize: '52px', 
                fontWeight: 900, 
                lineHeight: 1.1, 
                marginBottom: '20px',
                fontFamily: 'var(--font-display)',
                background: 'linear-gradient(135deg, #ffffff, #88b0ff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Build Globally.<br />Hire Intelligently.
              </h1>
              <p style={{ 
                fontSize: '18px', 
                color: 'var(--text-secondary)', 
                maxWidth: '650px', 
                margin: '0 auto 40px auto',
                lineHeight: 1.6
              }}>
                "We deliver deployment-ready talent and operational excellence — so you can build globally, from Africa."
              </p>

              {/* Main Call to Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center' }}>
                
                {/* Client Intakes */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    FOR GLOBAL CLIENTS
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button 
                      onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }} 
                      style={{
                        background: '#0047CC', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '8px', 
                        height: '40px', 
                        padding: '0 24px', 
                        fontSize: '14px', 
                        fontWeight: 600, 
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0, 71, 204, 0.3)'
                      }}
                    >
                      Hire Talent
                    </button>
                    <button 
                      onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }} 
                      style={{
                        background: '#040d1a', 
                        color: '#0047CC', 
                        border: '1.5px solid #0047CC', 
                        borderRadius: '8px', 
                        height: '40px', 
                        padding: '0 24px', 
                        fontSize: '14px', 
                        fontWeight: 600, 
                        cursor: 'pointer'
                      }}
                    >
                      Build a Team
                    </button>
                    <button 
                      onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }} 
                      style={{
                        background: '#040d1a', 
                        color: '#0047CC', 
                        border: '1.5px solid #0047CC', 
                        borderRadius: '8px', 
                        height: '40px', 
                        padding: '0 24px', 
                        fontSize: '14px', 
                        fontWeight: 600, 
                        cursor: 'pointer'
                      }}
                    >
                      Start a Project
                    </button>
                  </div>
                </div>

                {/* Talent Signup */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    FOR TECH TALENTS
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button 
                      onClick={() => { setAuthView('signup'); setAuthRole('talent'); setNameInput(''); setEmailInput(''); setPasswordInput(''); }} 
                      style={{
                        background: '#040d1a', 
                        color: 'var(--accent-cyan)', 
                        border: '1.5px solid var(--accent-cyan)', 
                        borderRadius: '8px', 
                        height: '40px', 
                        padding: '0 24px', 
                        fontSize: '14px', 
                        fontWeight: 600, 
                        cursor: 'pointer'
                      }}
                    >
                      Apply as Talent
                    </button>
                    <button 
                      onClick={() => { setAuthView('signup'); setAuthRole('talent'); setNameInput(''); setEmailInput(''); setPasswordInput(''); }} 
                      style={{
                        background: '#040d1a', 
                        color: 'var(--accent-cyan)', 
                        border: '1.5px solid var(--accent-cyan)', 
                        borderRadius: '8px', 
                        height: '40px', 
                        padding: '0 24px', 
                        fontSize: '14px', 
                        fontWeight: 600, 
                        cursor: 'pointer'
                      }}
                    >
                      Join Talent Pool
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Core Pillars Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '48px' }}>
              <GlassCard>
                <h3 style={{ color: 'var(--accent-cyan)', fontSize: '20px', marginBottom: '12px' }}>Kongila Infrastructure</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                  Global remote EOR compliance backing. Structured 7-stage vetting calculating code efficiency, technical, communication, and remote setups. Profiles mapped dynamically using mathematical fit matching.
                </p>
              </GlassCard>
              <GlassCard>
                <h3 style={{ color: 'var(--accent-green)', fontSize: '20px', marginBottom: '12px' }}>Remotan Work OS</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                  The intelligence operational engine of remote teams. Active multi-agent task allocations, real-time activity timers, blockers escalation system, and automatic warnings backing continuous execution.
                </p>
              </GlassCard>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* CLIENT SMART INTAKE FLOW (Smart Intake FIRST) */}
        {/* ====================================================================== */}
        {clientIntakeActive && (
          <GlassCard style={{ maxWidth: '650px', margin: '40px auto', padding: '32px' }}>
            {/* Header step counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-cyan)' }}>💼</span>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Client Smart Intake</h2>
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
                    background: clientIntakeStep >= s ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                    boxShadow: clientIntakeStep >= s ? '0 0 8px var(--accent-cyan-glow)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>

            {/* Screen 1: Service Selection */}
            {clientIntakeStep === 1 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>What service level do you require?</h3>
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
                        border: `1.5px solid ${formData.serviceType === item.id ? 'var(--accent-cyan)' : 'var(--border-glass)'}`,
                        background: formData.serviceType === item.id ? 'rgba(0, 255, 204, 0.03)' : 'rgba(255,255,255,0.01)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>{item.title}</div>
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
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Describe your requirement details</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Provide operational description to scan matching engine profiles.</p>

                <div className="form-group">
                  <label className="form-label">Role Title & Core Focus</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.roleDescription}
                    onChange={e => setFormData({ ...formData, roleDescription: e.target.value })}
                    placeholder="e.g. Senior Node/React Engineer to optimize pooling workloads"
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
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Schedule, Commitment & Budget</h3>
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
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Secure your account to match</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Provide company credentials to generate active sourcing requests.</p>

                {/* Google Sign in shortcut */}
                <button 
                  type="button"
                  onClick={() => simulateGoogleLogin('client')}
                  style={{
                    width: '100%', 
                    height: '44px', 
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
                    gap: '10px',
                    marginBottom: '24px'
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
                    <button 
                      type="submit" 
                      style={{
                        background: '#0047CC', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '8px', 
                        height: '40px', 
                        padding: '0 24px', 
                        fontSize: '14px', 
                        fontWeight: 600, 
                        cursor: 'pointer'
                      }}
                    >
                      Complete Intake & Register
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Screen 5: Progressive Email Verification (For Client flow) */}
            {clientIntakeStep === 5 && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉</div>
                <h3 style={{ fontSize: '20px', marginBottom: '8px', color: '#fff' }}>Verify email to initialize scans</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '32px' }}>
                  We sent a secure verification link to <strong>{emailInput}</strong> via Resend. Please verify to finalize your request.
                </p>

                <GlassCard style={{ background: 'rgba(0, 255, 204, 0.02)', padding: '20px', marginBottom: '32px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>DEVELOPMENT TEST HELPER</div>
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
                    Simulate Email Verification (Resend Webhook)
                  </button>
                </GlassCard>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Didn't receive the email? <span style={{ color: 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => triggerBanner('Resent verification email successfully.', 'info')}>Click here to resend</span>
                </div>
              </div>
            )}

          </GlassCard>
        )}

        {/* ====================================================================== */}
        {/* UNIFIED AUTHENTICATION VIEWS (Sign-Up / Sign-In / Verification Modal) */}
        {/* ====================================================================== */}
        {authView && !clientIntakeActive && (
          <GlassCard style={{ maxWidth: '450px', margin: '40px auto', padding: '32px' }}>
            
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
                    style={{
                      width: '100%', 
                      background: '#0047CC', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '8px', 
                      height: '42px', 
                      fontSize: '14px', 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      marginTop: '16px'
                    }}
                  >
                    Create Account
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
                    style={{
                      width: '100%', 
                      background: '#0047CC', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '8px', 
                      height: '42px', 
                      fontSize: '14px', 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      marginTop: '16px'
                    }}
                  >
                    Sign In
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

            {/* View: Onboarding Portal (Progressive Talent Wizard) */}
            {authView === 'onboarding' && (
              <div style={{ display: 'none' }}>
                {/* Handled by full screen wizard rendering below */}
              </div>
            )}

          </GlassCard>
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
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Map your technical skill footprint and primary engineering titles.</p>

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
                  Your progressive profile, EOR documentation and hardware checks are established. Click complete to spawn your limited pendings dashboard and initiate active Technical screening.
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
        {/* LIMITED PENDING TALENT DASHBOARD (Shown if talent & un-vetted) */}
        {/* ====================================================================== */}
        {currentUser && currentUser.role === 'talent' && !authView && getCurrentTalentProfile()?.vettingStatus !== 'Vetted' && getCurrentTalentProfile()?.vettingStatus !== 'Deployed' && (
          <div>
            {/* Limited Cockpit Page Header */}
            <div className="page-header">
              <div>
                <h1 className="page-title">Onboarding Cockpit</h1>
                <p className="page-subtitle">Welcome, {currentUser.name}. Track application screening, complete technical sandbox code challenges.</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {/* Debug Button to bypass Vetting sandbox! */}
                <button 
                  onClick={handleSimulateFullVetting}
                  style={{
                    background: 'linear-gradient(135deg, var(--accent-cyan), #0047CC)', 
                    color: '#000', 
                    fontWeight: 700, 
                    fontSize: '12px', 
                    borderRadius: '8px', 
                    padding: '0 16px', 
                    height: '40px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Simulate Admin Approval (Vetted Profile)
                </button>
                <Badge text="Vetting: Pending Review" status="Blocked" />
              </div>
            </div>

            {/* Core Pipeline grid */}
            <div className="dashboard-grid">
              
              {/* Timeline Checklist */}
              <div className="vetting-pipeline">
                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Vetting Progress: 7-Stage Vetting Framework</h2>
                
                <div className="vetting-step completed">
                  <div className="step-num">1</div>
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Application Screening (Grade: Verified)</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>CV, portfolio, and location availability registered. Progressive EOR credentials locked.</p>
                  </div>
                </div>

                <div className={`vetting-step ${getCurrentTalentProfile()?.vettingStatus === 'Review' ? 'completed' : 'active'}`}>
                  <div className="step-num">2</div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Technical Assessment Code Challenge</h3>
                      {getCurrentTalentProfile()?.vettingStatus === 'Review' && (
                        <span style={{ fontSize: '12px', color: 'var(--accent-green)', fontWeight: 700 }}>Cleared (92%)</span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Complete our PostgreSQL transaction pooling challenge sandbox to accelerate matching index.</p>
                    {getCurrentTalentProfile()?.vettingStatus !== 'Review' && (
                      <button 
                        onClick={() => { setShowAssessment(true); setAssessmentStep(1); }}
                        style={{
                          background: 'rgba(0, 255, 204, 0.1)', 
                          border: '1.5px solid var(--accent-cyan)', 
                          borderRadius: '6px', 
                          color: 'var(--accent-cyan)', 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          height: '28px', 
                          padding: '0 12px', 
                          cursor: 'pointer'
                        }}
                      >
                        Enter Code Challenge Sandbox
                      </button>
                    )}
                  </div>
                </div>

                <div className={`vetting-step ${getCurrentTalentProfile()?.vettingStatus === 'Review' ? 'active' : ''}`}>
                  <div className="step-num">3</div>
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Behavioural Interview Video Call</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Screening self-organization, remote communication fluency, and billing setups.</p>
                    {getCurrentTalentProfile()?.vettingStatus === 'Review' && (
                      <div style={{ marginTop: '8px', fontSize: '11px', padding: '6px 12px', background: 'rgba(255,204,0,0.1)', color: 'var(--accent-gold)', borderRadius: '6px', display: 'inline-block' }}>
                        📅 Automated scheduling link will trigger via WhatsApp (+234...) within 2 hours.
                      </div>
                    )}
                  </div>
                </div>

                <div className="vetting-step">
                  <div className="step-num">4</div>
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Personality Style Mapping</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Myers-Briggs automated indexing matching compatibility within remote client teams.</p>
                  </div>
                </div>

                <div className="vetting-step">
                  <div className="step-num">5</div>
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Remote Readiness Backup Audits</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Fiber uptime backing, battery/inverter capability verification, and workspace validation.</p>
                  </div>
                </div>

                <div className="vetting-step">
                  <div className="step-num">6</div>
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Operational Simulation Sandbox</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Fulfilling a 1-day simulated project milestone inside our active GitHub Sandbox pipeline.</p>
                  </div>
                </div>

                <div className="vetting-step">
                  <div className="step-num">7</div>
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Vetted deployable rating</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Composite grading computed (A+, A, B). NDA, contracts and payroll channels initialized.</p>
                  </div>
                </div>

              </div>

              {/* Side Panels */}
              <div>
                <GlassCard style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Intake Application File</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div><strong>Title:</strong> {talentOnboardingData.primaryRole}</div>
                    <div><strong>Salary Targets:</strong> ${talentOnboardingData.salaryExpectation} / mo ({talentOnboardingData.currency})</div>
                    <div><strong>Location:</strong> {talentOnboardingData.city}, {talentOnboardingData.country} ({talentOnboardingData.timezone})</div>
                    <div><strong>Status:</strong> Applied (Awaiting Grade)</div>
                  </div>
                </GlassCard>

                {/* mini terminal log */}
                <div className="agent-terminal" style={{ background: '#02070c' }}>
                  <div className="terminal-header">
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>COMPLIANCE SYSTEM LOGS</span>
                    <div className="terminal-dots">
                      <div className="dot dot-red" />
                      <div className="dot dot-yellow" />
                      <div className="dot dot-green" />
                    </div>
                  </div>
                  <div className="terminal-body" style={{ height: '160px', padding: '12px', fontSize: '11px' }}>
                    <div className="log-entry">
                      <span className="log-time">[13:02]</span>
                      <span className="log-success">Profile created for {currentUser.name}.</span>
                    </div>
                    <div className="log-entry">
                      <span className="log-time">[13:03]</span>
                      <span className="log-info">[Compliance Agent] KYC EOR checks resolving...</span>
                    </div>
                    {getCurrentTalentProfile()?.vettingStatus === 'Review' && (
                      <div className="log-entry">
                        <span className="log-time">[13:10]</span>
                        <span className="log-success">[Vetting Agent] Postgres Assessment completed. Scored 92%.</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* CODING ASSESSMENT SANDBOX MODAL (For Pending Talent) */}
        {/* ====================================================================== */}
        {showAssessment && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '650px', padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>PostgreSQL Workload Optimization Sandbox</h3>
                <span style={{ fontSize: '12px', background: 'rgba(0, 255, 204, 0.1)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '4px' }}>Time Allowed: 3 Hours</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '24px' }}>
                Our database encounters lock contention on transaction write pooling. Write a clean SQL trigger, index strategy or Node optimization that reduces pg-pool latency.
              </p>

              <div className="agent-terminal" style={{ marginBottom: '20px' }}>
                <div className="terminal-header">
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>QUERY EDITOR</span>
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
                  placeholder="// Write your code or transaction query here..."
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
                    <li>✓ 7-Stage Technical Vetting Framework</li>
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
        {/* FULL PORTALS: ACTIVE TALENT WORKSPACE (Vetted & Deployed Talents only) */}
        {/* ====================================================================== */}
        {currentUser && currentUser.role === 'talent' && !authView && !clientIntakeActive && activeTab === 'talent' && (getCurrentTalentProfile()?.vettingStatus === 'Vetted' || getCurrentTalentProfile()?.vettingStatus === 'Deployed') && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Talent Workspace Console</h1>
                <p className="page-subtitle">Review vetting statuses, active contracts, and EOR payroll details.</p>
              </div>
              <div>
                <Badge text="Vetting Status: Vetted & Deployable" status="Vetted" />
              </div>
            </div>

            <div className="dashboard-grid">
              
              <div className="vetting-pipeline">
                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Vetting Progress: Verified Grade A+ Elite</h2>
                
                <div className="vetting-step completed">
                  <div className="step-num">✓</div>
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Application Screening (Cleared)</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Progressive profile info verified successfully.</p>
                  </div>
                </div>

                <div className="vetting-step completed">
                  <div className="step-num">✓</div>
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Technical Assessment (94%)</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>PostgreSQL optimization sandbox query successfully cleared.</p>
                  </div>
                </div>

                <div className="vetting-step completed">
                  <div className="step-num">✓</div>
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Behavioral Vetting (88%)</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Evaluated on self-organization, remote time tracking backups, and communication.</p>
                  </div>
                </div>

                <div className="vetting-step completed">
                  <div className="step-num">✓</div>
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Remote Uptime check (Fiber backup verified)</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>UPS and inverter backups validated under continuous loads.</p>
                  </div>
                </div>
              </div>

              <div>
                <GlassCard style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Employment Details</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div><strong>Target Role:</strong> {getCurrentTalentProfile()?.title}</div>
                    <div><strong>Salary Expectations:</strong> ${getCurrentTalentProfile()?.salaryExpectation} / month</div>
                    <div><strong>Timezone Match:</strong> {getCurrentTalentProfile()?.timezone}</div>
                    <div><strong>Availability:</strong> Full Time (100% active)</div>
                  </div>
                </GlassCard>

                <GlassCard>
                  <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Contract Status</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div><strong>NDA signed:</strong> Yes</div>
                    <div><strong>EOR Master payroll:</strong> Configured</div>
                    <div><strong>Status:</strong> {getCurrentTalentProfile()?.vettingStatus}</div>
                  </div>
                </GlassCard>
              </div>

            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* FULL PORTALS: ACTIVE CLIENT DASHBOARD (Clients only) */}
        {/* ====================================================================== */}
        {currentUser && currentUser.role === 'client' && !authView && !clientIntakeActive && activeTab === 'client' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Client Workspace Console</h1>
                <p className="page-subtitle">Track intake service requests, review matched candidate profiles and e-sign EOR contracts.</p>
              </div>
            </div>

            {/* Sub Nav */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <div 
                style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: 600, color: clientSubTab === 'requests' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
                onClick={() => setClientSubTab('requests')}
              >
                1. Service Requests ({requests.filter(r => r.clientId === currentUser.id).length})
              </div>
              <div 
                style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: 600, color: clientSubTab === 'matching' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
                onClick={() => setClientSubTab('matching')}
              >
                2. Talent Radar Matches
              </div>
              <div 
                style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}
                onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }}
              >
                + Create New Intake Request
              </div>
            </div>

            {/* Sub View: Service Requests */}
            {clientSubTab === 'requests' && (
              <div>
                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Active Workforce Service Requests</h2>
                {requests.filter(r => r.clientId === currentUser.id).length === 0 ? (
                  <GlassCard style={{ padding: '40px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>No active workforce requests found. Complete a Smart Intake to scan vetted talent.</p>
                    <NeonButton onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }}>Create Smart Intake Form</NeonButton>
                  </GlassCard>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {requests.filter(r => r.clientId === currentUser.id).map(req => (
                      <GlassCard key={req.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                              <h3 style={{ fontSize: '16px' }}>{req.serviceType} Request</h3>
                              <Badge text={req.priority + ' Priority'} status={req.priority === 'High' ? 'Blocked' : 'In Progress'} />
                              <Badge text={req.status} status={req.status} />
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>{req.roleDescription}</p>
                            
                            <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
                              <div><strong>Skills Required:</strong> {req.requiredSkills.join(', ')}</div>
                              <div><strong>Monthly Budget:</strong> {formatCurrency(req.budget)}/mo</div>
                              <div><strong>Timezone Alignment:</strong> {req.timezone}</div>
                            </div>
                          </div>
                          <div>
                            <NeonButton onClick={() => {
                              setSelectedRequest(req);
                              setClientSubTab('matching');
                            }}>
                              View Radar Shortlists
                            </NeonButton>
                          </div>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sub View: Matching Radar */}
            {clientSubTab === 'matching' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '18px' }}>Shortlisted Candidate Profiles</h2>
                  <div>
                    <label style={{ fontSize: '13px', marginRight: '8px', color: 'var(--text-muted)' }}>Active Request File:</label>
                    <select 
                      className="form-select" 
                      style={{ width: '250px', display: 'inline-block' }}
                      value={selectedRequest?.id || ''}
                      onChange={e => {
                        const r = requests.find(req => req.id === e.target.value);
                        if (r) setSelectedRequest(r);
                      }}
                    >
                      <option value="">-- Choose request file --</option>
                      {requests.filter(r => r.clientId === currentUser.id).map(req => (
                        <option key={req.id} value={req.id}>{req.serviceType} ({req.id.split('_')[1]})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!selectedRequest ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '40px' }}>
                    Select an active request from the dropdown or active list to review composite matching scores.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ padding: '16px', background: 'rgba(0, 255, 204, 0.02)', border: '1px solid rgba(0, 255, 204, 0.1)', borderRadius: '10px', fontSize: '13px' }}>
                      <strong>Active Matching Algorithm Formula:</strong> Skill Match Fit (40%) + Behaviour Fit (20%) + Personality Style (15%) + Availability Alignment (15%) + Simulation & Experience Vetting (10%).
                    </div>

                    {getMatchedTalentsForRequest().length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)' }}>No deployable candidates matching required vetting grades found. Sourcing active talent...</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                        {getMatchedTalentsForRequest().map(({ talent, match }) => (
                          <GlassCard key={talent.id} className="matching-card">
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
                              <img 
                                src={talent.avatar} 
                                alt={talent.name} 
                                style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${getGradeColor(talent.grade)}` }} 
                              />
                              <div style={{ flexGrow: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <h3 style={{ fontSize: '18px' }}>{talent.name}</h3>
                                  <span style={{ fontSize: '16px', fontWeight: 800, color: getGradeColor(talent.grade) }}>{talent.grade}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--accent-cyan)', fontWeight: 600 }}>{talent.title}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{talent.timezone} • {talent.experienceYears}y exp</div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px' }}>
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>MATCH PERCENTAGE</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-green)' }}>{match.score}% MATCH</div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', textAlign: 'right' }}>
                                <div>Skills: {match.breakdown.skillFit}%</div>
                                <div>Behaviour: {match.breakdown.behaviorFit}%</div>
                                <div>Availability: {match.breakdown.availability}%</div>
                              </div>
                            </div>

                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', height: '40px', overflow: 'hidden' }}>
                              {talent.bio}
                            </p>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px' }}>
                              {talent.tags.map(t => (
                                <Badge key={t} text={t} status={t} />
                              ))}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              {match.status === 'Shortlisted' ? (
                                <>
                                  <NeonButton variant="secondary" onClick={() => {
                                    setSelectedTalent(talent);
                                    setShowCalendar(true);
                                  }}>
                                    Schedule Interview
                                  </NeonButton>
                                  <NeonButton onClick={() => handleExtendOffer(talent)}>
                                    Hire & Deploy
                                  </NeonButton>
                                </>
                              ) : (
                                <div style={{ gridColumn: 'span 2', textAlign: 'center' }}>
                                  <Badge text={match.status} status={match.status} />
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    {match.status === 'Interview Scheduled' && `Vetting Interview booked for ${meetingDate} at ${meetingTime}`}
                                    {match.status === 'Offer Extended' && 'Offer agreement generated. Open Talent NDA to sign.'}
                                  </div>
                                </div>
                              )}
                            </div>
                          </GlassCard>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ====================================================================== */}
      {/* MOCK OVERLAYS: MODAL FOR INTERVIEW SCHEDULER & CONTRACT E-SIGNATURES */}
      {/* ====================================================================== */}
      {showCalendar && selectedTalent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px', padding: '24px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Book Video Interview</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Scheduling technical interview call with <strong>{selectedTalent.name}</strong>. Workspace timezone conversions resolved automatically.
            </p>

            <div className="form-group">
              <label className="form-label">Choose Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Time ({selectedTalent.timezone})</label>
              <input 
                type="time" 
                className="form-input" 
                value={meetingTime}
                onChange={e => setMeetingTime(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <NeonButton variant="ghost" onClick={() => setShowCalendar(false)}>Cancel</NeonButton>
              <NeonButton onClick={handleScheduleMeeting}>Schedule & Link Zoom</NeonButton>
            </div>
          </div>
        </div>
      )}

      {showSignModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>Secure Onboarding Portal</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Employer of Record (EOR) Master Employment Contracts and compliance signatures.</p>

            <div className="contract-paper">
              {activeNDA}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="signcheck" style={{ width: '18px', height: '18px', cursor: 'pointer' }} defaultChecked />
                <label htmlFor="signcheck" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  I verify my identity and sign all mutual NDA policies.
                </label>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <NeonButton variant="ghost" onClick={() => setShowSignModal(false)}>Refuse</NeonButton>
                <NeonButton onClick={handleSignContract}>Sign and Deploy Contract</NeonButton>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
