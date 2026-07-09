import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { GlassCard, Badge, NeonButton } from '@kongila/ui';
import { formatCurrency, formatDate, getGradeColor } from '@kongila/utils';
import { generateMatchesForRequest } from '@kongila/matching-engine';
import { generateNDATemplate, generateContractTemplate } from '@kongila/contracts';
import { 
  TalentProfile, ServiceRequest, Match, Contract, ServiceType, calculateTalentProfileCompletion, hasCoreTalentProfileChanges
} from '@kongila/shared-types';
import { supabase } from '../lib/supabaseClient';
import { COUNTRIES_AND_CODES, SUGGESTED_SKILLS, CURRENCIES } from '../lib/onboarding-constants';
import TalentDashboard from '../components/TalentDashboard';
import ClientDashboard from '../components/ClientDashboard';
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

const isTalentProfileOnboardingComplete = (profileRow: any) => {
  if (!profileRow?.bio || typeof profileRow.bio !== 'string') return false;
  try {
    const envelope = JSON.parse(profileRow.bio);
    const telemetry = envelope?.telemetry || {};
    return envelope?.__kongila === true && Number(telemetry.profileCompletionPercent || 0) >= 100;
  } catch (e) {
    return false;
  }
};

export default function KongilaWeb() {
  // DB States
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [rehireRequests, setRehireRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Assessment state for talent-side
  const [assessments, setAssessments] = useState<any[]>([]);
  const [assessmentCategories, setAssessmentCategories] = useState<any[]>([]);
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([]);
  const [talentSkillAssessments, setTalentSkillAssessments] = useState<any[]>([]);
  const [skillAssessmentResults, setSkillAssessmentResults] = useState<any[]>([]);

  // Identity & Unified Auth Progressive States
  const [currentUser, setCurrentUser] = useState<any>(null); // { id, name, email, role, onboardingStatus, emailVerified, organizationId }
  const [authView, setAuthView] = useState<'login' | 'signup' | 'verify' | 'onboarding' | null>(null);
  const [authRole, setAuthRole] = useState<'talent' | 'client'>('talent');
  
  // Auth Form Fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Talent Wizard Steps (1 to 6)
  const [talentWizardStep, setTalentWizardStep] = useState(1);
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
    preferredEngagementType: '',
    preferredWorkHours: '',
    preferredProjectType: '',
    noticePeriod: '',
    availableStartDate: '',
    availability: '',
    salaryExpectationMin: '',
    salaryExpectationMax: '',
    hourlyMonthly: 'Monthly',
    currency: 'USD',
    cvName: '',
    cvUrl: '',
    cvSize: 0,
    certificationFiles: [] as Array<{ name: string; url: string; size: number; type: string }>,
    portfolioUrl: '',
    linkedInUrl: '',
    githubUrl: '',
    websiteUrl: '',
    certifications: '',
    internetQuality: '',
    workSetup: '',
    devices: '',
    communicationTools: ''
  });

  const [skillSearch, setSkillSearch] = useState('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [secondarySkillSearch, setSecondarySkillSearch] = useState('');
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

  useEffect(() => {
    if (authView === 'onboarding' && currentUser?.name && !talentOnboardingData.fullName) {
      setTalentOnboardingData(prev => ({
        ...prev,
        fullName: currentUser.name,
      }));
    }
  }, [authView, currentUser?.name, talentOnboardingData.fullName]);

  useEffect(() => {
    const needsOnboarding = currentUser?.role === 'talent' && currentUser?.onboardingStatus !== 'complete';
    if (needsOnboarding) {
      if (authView !== 'onboarding') {
        setAuthView('onboarding');
      }
    }
  }, [currentUser?.role, currentUser?.onboardingStatus, authView]);

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
        
        // Fetch service requests from Supabase
        let query = supabase.from('talent_requests').select('payload').order('created_at', { ascending: false });
        // If current session user is a client, we should scope the query
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.user_metadata?.role === 'client') {
           query = query.eq('client_id', session.user.id);
        }
        
        const { data: supabaseRequests, error: reqErr } = await query;
        if (supabaseRequests) {
          const mappedRequests = supabaseRequests.map(r => r.payload);
          setRequests(mappedRequests);
        } else {
          setRequests(dbData.clientRequests || []);
        }

        setMatches(dbData.matches || []);
        setContracts(dbData.contracts || []);
        setInvoices(dbData.invoices || []);
        setMessages(dbData.messages || []);
        setNotifications(dbData.notifications || []);
        setRehireRequests(dbData.rehireRequests || []);
        setDocuments(dbData.documents || []);
        // Assessment data for talent side
        setAssessments(dbData.assessments || []);
        setAssessmentCategories(dbData.assessmentCategories || []);
        setAssessmentQuestions(dbData.assessmentQuestions || []);
        setTalentSkillAssessments(dbData.talentSkillAssessments || []);
        setSkillAssessmentResults(dbData.skillAssessmentResults || []);
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

  const syncAuthSignupToDb = async (user: any) => {
    // Legacy sync method disabled to fix long load times and use direct Supabase writes.
  };

  useEffect(() => {
    setShowPassword(false);
  }, [authView, clientIntakeStep, clientIntakeActive]);

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
        let isOnboardingComplete = dbUser?.status === 'active';
        if (role === 'talent') {
          const { data: dbTalentProfile } = await supabase
            .from('talent_profiles')
            .select('id,bio')
            .eq('id', dbUser?.id || authUser.id)
            .maybeSingle();
          isOnboardingComplete = isTalentProfileOnboardingComplete(dbTalentProfile);
        }
        
        const restoredUser = {
          id: dbUser?.id || authUser.id,
          name: authUser.user_metadata?.full_name || dbUser?.email || 'User',
          email: authUser.email || '',
          role,
          onboardingStatus: isOnboardingComplete ? 'complete' : 'incomplete',
          emailVerified: true,
          companyName: authUser.user_metadata?.company_name,
          createdAt: authUser.created_at
        };
        setCurrentUser(restoredUser);
        
        if (!isOnboardingComplete && role === 'talent') {
          setAuthView('onboarding');
        } else {
          setAuthView(null);
          if (role === 'talent') setActiveTab('talent');
          else setActiveTab('client');
        }
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
      } else if (event === 'SIGNED_IN') {
        await initSession();
      }
    });

    // Poll DB every 5 seconds for updates
    const interval = setInterval(syncFromDb, 5000);
    
    // Realtime subscription to talent_requests
    const requestChannel = supabase
      .channel('public:talent_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'talent_requests' }, payload => {
        syncFromDb();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
      supabase.removeChannel(requestChannel);
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

    // Save to Supabase Postgres backend
    try {
      const { error } = await supabase.from('talent_requests').insert([{
        client_id: currentUser?.id || 'anon_client',
        service_type: formData.serviceType,
        payload: newReq
      }]);
      if (error) {
        console.error("Supabase storage error:", error);
        triggerBanner('Error saving to database. Please try again.', 'error');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("Failed to connect to Supabase", err);
      triggerBanner('Connection error. Please try again.', 'error');
      setLoading(false);
      return;
    }

    // Calculate matches instantly
    const calculatedMatches = generateMatchesForRequest(newReq, talents);

    const updatedRequests = [...requests, newReq];
    const updatedMatches = [...matches, ...calculatedMatches];
    
    // Insert real audit log
    await supabase.from('audit_logs').insert({
      actor: currentUser ? currentUser.name : 'Guest Client',
      action: 'Intake Submitted',
      details: `Requested ${formData.numberOfHires}x ${formData.serviceType} role. Budget: $${formData.budget}/mo`
    });

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

      const authUserId = data.user?.id || crypto.randomUUID();

      // Write to public.users table
      const { error: userErr } = await supabase.from('users').upsert({
        id: authUserId,
        email: emailInput,
        password_hash: 'auth_managed',
        role: authRole,
        status: authRole === 'talent' ? 'onboarding' : 'active',
        email_verified: false
      });
      if (userErr) throw new Error(`User DB Error: ${userErr.message}`);

      if (authRole === 'client') {
        // Create organization record
        const orgId = crypto.randomUUID();
        const { error: orgErr } = await supabase.from('organizations').upsert({
          id: orgId,
          name: companyInput || `${nameInput}'s Company`,
          created_by: authUserId
        });
        if (orgErr) throw new Error(`Org DB Error: ${orgErr.message}`);

        // Create client profile
        const { error: clpErr } = await supabase.from('client_profiles').upsert({
          id: crypto.randomUUID(),
          user_id: authUserId,
          organization_id: orgId,
          position: 'Admin'
        });
        if (clpErr) throw new Error(`Client Profile DB Error: ${clpErr.message}`);
      } else {
        // Create talent profile placeholder — use auth UUID as the profile ID so onboarding
        // can upsert by id without creating duplicate records
        const { error: tpErr } = await supabase.from('talent_profiles').upsert({
          id: authUserId,
          user_id: authUserId,
          full_name: nameInput,
          status: 'active',
          vetting_stage: 'Application Screening',
          vetting_status: 'Applied',
          level: null,
          country: null,
          timezone: null,
          availability_hours: null,
          bio: ''
        }, { onConflict: 'id' });
        if (tpErr) console.error('[Signup] talent_profiles upsert error:', tpErr);
      }

      // Always write to user_roles table
      const { error: urErr } = await supabase.from('user_roles').upsert({
        id: crypto.randomUUID(),
        user_id: authUserId,
        role_id: authRole
      }, { onConflict: 'id' });
      if (urErr) console.warn('[Signup] user_roles upsert skipped (table may not exist or RLS):', urErr);

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
      await syncAuthSignupToDb(newUser);

      if (authRole === 'talent') {
        setTalentOnboardingData(prev => ({
          ...prev,
          fullName: nameInput,
        }));
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
      let isOnboardingComplete = dbUser?.status === 'active';
      if (role === 'talent') {
        const { data: dbTalentProfile } = await supabase
          .from('talent_profiles')
          .select('id,bio')
          .eq('id', dbUser?.id || data.user?.id)
          .maybeSingle();
        isOnboardingComplete = isTalentProfileOnboardingComplete(dbTalentProfile);
      }

      const loggedInUser = {
        id: dbUser?.id || data.user?.id || `user_${Date.now()}`,
        name: data.user?.user_metadata?.full_name || emailInput,
        email: emailInput,
        role,
        onboardingStatus: isOnboardingComplete ? 'complete' : 'incomplete',
        emailVerified: true,
        companyName: data.user?.user_metadata?.company_name,
        createdAt: data.user?.created_at || new Date().toISOString()
      };

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



  const uploadToBucket = async (bucket: string, fileName: string, file: File) => {
    return supabase.storage.from(bucket).upload(fileName, file, { upsert: true });
  };

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
    const fileName = `${currentUser?.id || Date.now()}-profile-${file.name}`;
    try {
      const bucketsToTry = ['profile-assets', 'documents'];
      let uploadResult: any = null;
      let uploadedBucket = 'profile-assets';
      let lastError: any = null;

      for (const bucket of bucketsToTry) {
        const result = await uploadToBucket(bucket, fileName, file);
        if (!result.error) {
          uploadResult = result;
          uploadedBucket = bucket;
          break;
        }
        lastError = result.error;
      }

      if (!uploadResult?.data) throw lastError || new Error('Profile photo upload failed.');

      const publicUrl = supabase.storage.from(uploadedBucket).getPublicUrl(uploadResult.data.path).data.publicUrl;
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
      const fileName = `${currentUser?.id || Date.now()}-cv-${file.name}`;

      const { data, error } = await uploadToBucket('documents', fileName, file);

      if (error) {
        throw error;
      }
      
      setUploadProgress(100);
      const publicUrl = supabase.storage.from('documents').getPublicUrl(data.path).data.publicUrl;
      setTalentOnboardingData(prev => ({ ...prev, cvName: data.path, cvUrl: publicUrl, cvSize: file.size }));
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
        const fileName = `${currentUser?.id || Date.now()}-cert-${file.name}`;
        const { data, error } = await uploadToBucket('documents', fileName, file);
        if (error) throw error;
        const publicUrl = supabase.storage.from('documents').getPublicUrl(data.path).data.publicUrl;
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
        preferredEngagementType: talentOnboardingData.preferredEngagementType || talentOnboardingData.employmentPreference || '',
        preferredWorkHours: talentOnboardingData.hourlyMonthly || talentOnboardingData.preferredWorkHours || '',
        preferredProjectType: talentOnboardingData.preferredProjectType || '',
        noticePeriod: talentOnboardingData.noticePeriod || talentOnboardingData.availableStartDate || '',
        availableStartDate: talentOnboardingData.noticePeriod || talentOnboardingData.availableStartDate || '',
        currency: salaryCurrency,
        salaryExpectationUsd: resolvedSalaryUsd,
        salaryExpectationMinUsd: resolvedSalaryMinUsd,
        salaryExpectationMaxUsd: resolvedSalaryMaxUsd,
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
        internetQuality: talentOnboardingData.internetQuality || '',
        workSetup: talentOnboardingData.workSetup || '',
        devices: talentOnboardingData.devices || '',
        communicationTools: talentOnboardingData.communicationTools || '',
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
        preferredEngagementType: talentOnboardingData.preferredEngagementType || talentOnboardingData.employmentPreference || '',
        preferredWorkHours: talentOnboardingData.preferredWorkHours || talentOnboardingData.hourlyMonthly || '',
        preferredProjectType: talentOnboardingData.preferredProjectType || '',
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
        documents: []
      });

      if (completionCheck.percent < 100) {
        triggerBanner(`Complete your profile before finishing onboarding. Missing: ${completionCheck.incomplete.join(', ')}`, 'error');
        setLoading(false);
        return;
      }

      onboardingTelemetry.profileCompletionPercent = completionCheck.percent;
      packedBio = JSON.stringify({
        __kongila: true,
        tags: primarySkills,
        scores: {},
        telemetry: onboardingTelemetry,
        bio: bioText
      });

      // ── 1. Upsert full onboarding data directly into Supabase talent_profiles ──
      if (authUserId) {
        const supabasePayload = {
          id: authUserId,
          user_id: authUserId,
          full_name: talentName,
          phone: talentOnboardingData.phone || null,
          country: talentOnboardingData.country || null,
          address: null,
          gender: talentOnboardingData.gender || null,
          level: talentOnboardingData.primaryRole || null,
          availability_hours: Number(talentOnboardingData.availability) || null,
          salary_max: resolvedSalaryUsd || null,
          salary_expectation: resolvedSalaryUsd || null,
          experience_years: Number(talentOnboardingData.yearsExperience) || null,
          vetting_stage: 'Application Screening',
          vetting_status: 'Applied',
          grade: 'Ungraded',
          status: 'active',
          timezone: talentOnboardingData.timezone || null,
          bio: packedBio,
          avatar_url: talentOnboardingData.profilePhotoUrl || null
        };

        const { error: spErr } = await supabase
          .from('talent_profiles')
          .upsert(supabasePayload, { onConflict: 'id' });

        if (spErr) {
          console.error('[Onboarding] Supabase talent_profiles upsert error:', spErr);
          throw spErr;
        } else {
          console.log('[Onboarding] Saved talent profile to Supabase successfully.');
        }

        // ── 2. Upsert skills into talent_skills table ──
        if (skillsList.length > 0) {
          // First ensure skills exist in the skills table
          for (const skillName of skillsList) {
            const skillId = `skl_${skillName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            await supabase.from('skills').upsert({ id: skillId, name: skillName }, { onConflict: 'id' });
            await supabase.from('talent_skills').upsert(
              { id: `ts_${authUserId}_${skillId}`, talent_id: authUserId, skill_id: skillId, level: talentOnboardingData.skillLevels?.[skillName] ? String(talentOnboardingData.skillLevels[skillName]).toLowerCase() : 'intermediate' },
              { onConflict: 'id' }
            );
          }
        }

        // ── 3. Update public.users with verified name ──
        await supabase.from('users').update({ status: 'active' }).eq('id', authUserId);
      }

      // ── 4. Sync to local db.json for offline/admin panel fallback ──
      const res = await fetch('/api/db');
      if (res.ok) {
        const dbData = await res.json();
        if (!dbData.talents) dbData.talents = [];
        if (!dbData.notifications) dbData.notifications = [];
        if (!dbData.auditLogs) dbData.auditLogs = [];
        if (!dbData.agentLogs) dbData.agentLogs = [];

        const existingIndex = dbData.talents.findIndex((t: any) =>
          t.id === authUserId || (talentEmail && t.email?.toLowerCase() === talentEmail.toLowerCase())
        );

        const baseTalent = existingIndex > -1 ? dbData.talents[existingIndex] : {};

        const updatedTalent: TalentProfile = {
          ...baseTalent,
          id: authUserId || baseTalent.id || `talent_${Date.now()}`,
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
            remoteReadiness: 0, workSimulation: 0, communication: 0, experience: 0
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
          preferredEngagementType: talentOnboardingData.preferredEngagementType || talentOnboardingData.employmentPreference || '',
          preferredWorkHours: talentOnboardingData.hourlyMonthly || talentOnboardingData.preferredWorkHours || '',
          preferredProjectType: talentOnboardingData.preferredProjectType || '',
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
          internetQuality: talentOnboardingData.internetQuality || '',
          workSetup: talentOnboardingData.workSetup || '',
          devices: talentOnboardingData.devices || '',
          communicationTools: talentOnboardingData.communicationTools || '',
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

        if (existingIndex > -1) {
          dbData.talents[existingIndex] = updatedTalent;
        } else {
          dbData.talents.push(updatedTalent);
        }

        dbData.notifications.push({
          id: `notif_${Date.now()}`,
          userId: updatedTalent.id,
          title: 'Application Intake Submitted',
          message: 'Your talent application screening review is running. Complete your assessment.',
          read: false,
          createdAt: new Date().toISOString()
        });

        dbData.auditLogs.push({
          id: `audit_${Date.now()}`,
          actor: updatedTalent.name,
          action: 'Progressive Onboarding Completed',
          details: `Role: ${updatedTalent.title}. Setup: ${talentOnboardingData.workSetup}`,
          timestamp: new Date().toISOString()
        });

        dbData.agentLogs.push({
          id: `alog_talent_${Date.now()}`,
          agentName: 'Compliance Agent',
          message: `Screening pipeline initiated for ${updatedTalent.name}. KYC & equipment logs verified.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'info'
        });

        await saveToDb(dbData);
        setTalents(dbData.talents);
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
          actor: currentUser ? currentUser.name : 'Guest Client',
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
      clientName: currentUser ? `${currentUser.name} (${currentUser.companyName || 'Unknown Company'})` : 'Guest Client',
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

    const ndaText = generateNDATemplate(talent.name, currentUser ? `${currentUser.name} (${currentUser.companyName || 'Unknown Company'})` : 'Guest Client');
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
          actor: currentUser ? currentUser.name : 'Guest Client',
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

  const handleUpdateMatch = async (updatedMatch: any) => {
    const updatedMatches = matches.map(m => m.id === updatedMatch.id ? updatedMatch : m);
    setMatches(updatedMatches);

    let updatedContracts = contracts;
    if (updatedMatch.status === 'Offer Accepted') {
      const matchRequest = requests.find(r => r.id === updatedMatch.requestId);
      const newContract = {
        id: `KNG-CON-${Date.now().toString().slice(-4)}`,
        matchId: updatedMatch.id,
        clientId: matchRequest?.clientId || 'usr_horizon',
        clientName: matchRequest?.clientName || 'Horizon Fintech',
        talentId: updatedMatch.talentId,
        talentName: currentUser?.name || 'Chidi Anya',
        role: matchRequest?.roleDescription || 'Senior Engineer',
        salary: matchRequest?.budget || 5000,
        startDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: 'Signed' as const,
        signedAt: new Date().toISOString(),
        rateType: 'Monthly',
        rateAmount: matchRequest?.budget || 5000,
        totalEarned: 0,
        invoicedBalance: 0,
        nextPayout: matchRequest?.budget || 5000,
        nextPayoutDate: 'End of Month',
        engagementModel: matchRequest?.commitmentLevel || 'Remote / Full-time Retainer',
        rating: 5,
        qualityOfWork: 5.0
      } as any;
      updatedContracts = [...contracts, newContract];
      setContracts(updatedContracts);
    }

    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const dbData = await res.json();
        dbData.matches = updatedMatches;
        dbData.contracts = updatedContracts;
        await saveToDb(dbData);
      }
    } catch (e) {
      console.error("Failed to persist match update", e);
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
                                  setNameInput('');
                                  setEmailInput('');
                                  setPasswordInput('');
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
              onComplete={async (req) => {
                const calculatedMatches = generateMatchesForRequest(req, talents);
                setRequests([...requests, req]);
                setMatches([...matches, ...calculatedMatches]);
                
                // Save matches to mock db for the matching engine
                await fetch('/api/db', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    matches: [...matches, ...calculatedMatches]
                  })
                });

                // Insert real audit log
                await supabase.from('audit_logs').insert({
                  actor: req.clientName || 'Guest Client',
                  action: 'Intake Submitted',
                  details: `Requested ${req.numberOfHires}x ${req.serviceType} role. Budget: $${req.budget}/mo`
                });

                setClientIntakeActive(false);
                setAuthView(null);
                setActiveTab('client');
                triggerBanner('Service Request Created Successfully', 'success');
              }}
              onCancel={() => setClientIntakeActive(false)}
            />
          </div>
        )}

        {/* ====================================================================== */}
        {/* UNIFIED AUTHENTICATION VIEWS (Sign-Up / Sign-In / Verification Modal) */}
        {/* ====================================================================== */}
        {/* Auth two-panel: only login / signup / verify — NOT onboarding */}
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
                <KongilaLogo size={48} textColor="#FFFFFF" />
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
                  Access premium remote EOR opportunities globally.
                </p>



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
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>1. Personal Information</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>We use this to verify your identity and personalize your dashboard experience.</p>

                <div className="form-group">
                  <label className="form-label">Profile Photo</label>
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
                  <label className="form-label">Full Name</label>
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
                  <label className="form-label">Mobile Phone Number</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select 
                      className="form-input" 
                      style={{ width: '120px' }}
                      value={talentOnboardingData.phoneCode}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, phoneCode: e.target.value })}
                    >
                      {COUNTRIES_AND_CODES.map(c => (
                        <option key={c.name} value={c.code}>{c.code} ({c.name})</option>
                      ))}
                    </select>
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
                    <label className="form-label">Country</label>
                    <select
                      className="form-input"
                      value={talentOnboardingData.country || ''}
                      onChange={e => {
                        const val = e.target.value;
                        const matched = COUNTRIES_AND_CODES.find(c => c.name === val);
                        setTalentOnboardingData({ 
                          ...talentOnboardingData, 
                          country: val,
                          phoneCode: matched ? matched.code : talentOnboardingData.phoneCode
                        });
                      }}
                    >
                      <option value="" disabled>Select a country</option>
                      {COUNTRIES_AND_CODES.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">City</label>
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
                  <label className="form-label">Date of Birth</label>
                  <input type="date" className="form-input" value={talentOnboardingData.dateOfBirth} onChange={e => setTalentOnboardingData({ ...talentOnboardingData, dateOfBirth: e.target.value })} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Gender</label>
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
                  <label className="form-label">Timezone Alignment</label>
                  <input 
                    type="text"
                    list="timezone-list"
                    className="form-input"
                    value={talentOnboardingData.timezone}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, timezone: e.target.value })}
                    placeholder="e.g. Africa/Lagos (GMT+1)"
                  />
                  <datalist id="timezone-list">
                    <option value="Africa/Lagos (GMT+1)" />
                    <option value="Africa/Johannesburg (GMT+2)" />
                    <option value="Africa/Nairobi (GMT+3)" />
                    <option value="Africa/Cairo (GMT+2)" />
                    <option value="Africa/Accra (GMT)" />
                    <option value="Europe/London (GMT)" />
                    <option value="Europe/Paris (GMT+1)" />
                    <option value="Europe/Berlin (GMT+1)" />
                    <option value="Europe/Madrid (GMT+1)" />
                    <option value="Europe/Moscow (GMT+3)" />
                    <option value="America/New_York (EST/EDT)" />
                    <option value="America/Chicago (CST/CDT)" />
                    <option value="America/Los_Angeles (PST/PDT)" />
                    <option value="America/Denver (MST/MDT)" />
                    <option value="America/Toronto (EST/EDT)" />
                    <option value="America/Sao_Paulo (BRT)" />
                    <option value="America/Mexico_City (CST/CDT)" />
                    <option value="Asia/Kolkata (IST)" />
                    <option value="Asia/Singapore (SGT)" />
                    <option value="Asia/Tokyo (JST)" />
                    <option value="Asia/Dubai (GST)" />
                    <option value="Asia/Shanghai (CST)" />
                    <option value="Asia/Hong_Kong (HKT)" />
                    <option value="Asia/Seoul (KST)" />
                    <option value="Asia/Bangkok (ICT)" />
                    <option value="Australia/Sydney (AEST/AEDT)" />
                    <option value="Australia/Perth (AWST)" />
                    <option value="Australia/Brisbane (AEST)" />
                    <option value="Pacific/Auckland (NZST/NZDT)" />
                  </datalist>
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
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>2. Professional Details</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Tell us about your current role, specialization, and seniority.</p>

                <div className="form-group">
                  <label className="form-label">Primary Professional Title</label>
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
                    <label className="form-label">Primary Role Category</label>
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
                    <label className="form-label">Seniority Level</label>
                    <select
                      className="form-input"
                      value={talentOnboardingData.seniorityLevel}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, seniorityLevel: e.target.value })}
                    >
                      <option value="">Select level</option>
                      <option>Associate</option>
                      <option>Specialist</option>
                      <option>Consultant</option>
                      <option>Manager</option>
                      <option>Director</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Years of Relevant Experience</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={talentOnboardingData.yearsExperience}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, yearsExperience: e.target.value })}
                    placeholder="e.g. 5"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Short Bio</label>
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
                  <label className="form-label">Primary Skills</label>
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
                  <label className="form-label">Employment Pref</label>
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

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <NeonButton variant="secondary" onClick={() => setTalentWizardStep(1)}>Back</NeonButton>
                  <NeonButton onClick={() => setTalentWizardStep(3)}>Continue</NeonButton>
                </div>
              </div>
            )}

            {/* Step 3: Compensation */}
            {talentWizardStep === 3 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>3. Preferences</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Help us match you to the right engagement and availability window.</p>

                <div className="form-group">
                  <label className="form-label">Preferred Engagement Type</label>
                  <select
                    className="form-select"
                    value={talentOnboardingData.preferredEngagementType}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, preferredEngagementType: e.target.value })}
                  >
                    <option value="">Select engagement type</option>
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Either</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Work Hours Format</label>
                  <select
                    className="form-select"
                    value={talentOnboardingData.hourlyMonthly}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, hourlyMonthly: e.target.value })}
                  >
                    <option value="Hourly">Hourly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Notice Period</label>
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

                <div className="form-group">
                  <label className="form-label">Preferred Project Type</label>
                  <input
                    type="text"
                    className="form-input"
                    value={talentOnboardingData.preferredProjectType}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, preferredProjectType: e.target.value })}
                    placeholder="e.g. Product operations, client delivery, or platform support"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }} className="form-group">
                  <div>
                    <label className="form-label">Salary Range Min</label>
                    <input
                      type="number"
                      className="form-input"
                      value={talentOnboardingData.salaryExpectationMin}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, salaryExpectationMin: e.target.value })}
                      placeholder="e.g. 3500"
                    />
                  </div>
                  <div>
                    <label className="form-label">Salary Range Max</label>
                    <input
                      type="number"
                      className="form-input"
                      value={talentOnboardingData.salaryExpectationMax}
                      onChange={e => setTalentOnboardingData({ ...talentOnboardingData, salaryExpectationMax: e.target.value })}
                      placeholder="e.g. 5000"
                    />
                  </div>
                  <div>
                    <label className="form-label">Currency</label>
                    <select 
                      className="form-select"
                      value={talentOnboardingData.currency}
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, currency: e.target.value })}
                    >
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
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
                <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fff' }}>4. Documents & Links</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Upload the mandatory CV and add any supporting certification or portfolio links.</p>

                <div className="form-group" style={{ background: 'var(--bg-tertiary)', padding: '24px', borderRadius: '10px', textAlign: 'center', border: '1.5px dashed var(--border-glass)' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>📁</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Curriculum Vitae (PDF)</div>
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
                  <label className="form-label">LinkedIn URL</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={talentOnboardingData.linkedInUrl}
                    placeholder="https://linkedin.com/in/your-profile"
                    onChange={e => setTalentOnboardingData({ ...talentOnboardingData, linkedInUrl: e.target.value })}
                  />
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
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: '72px', marginBottom: '24px', color: 'var(--accent-green)', textShadow: '0 0 20px rgba(51, 255, 87, 0.4)' }}>✓</div>
                <h3 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px' }}>You're All Set!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, maxWidth: '450px', margin: '0 auto 32px auto' }}>
                  Your profile and documents have been successfully securely uploaded. Click <strong>Complete Onboarding</strong> below to access your dashboard and begin your verification process.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                  <NeonButton variant="secondary" onClick={() => setTalentWizardStep(5)}>Review Setup</NeonButton>
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
            clientRequests={requests}
            allDocuments={documents}
            dashboardNotifications={notifications}
            setDashboardNotifications={setNotifications}
            assessments={assessments}
            assessmentCategories={assessmentCategories}
            assessmentQuestions={assessmentQuestions}
            talentSkillAssessments={talentSkillAssessments}
            skillAssessmentResults={skillAssessmentResults}
            onSignOut={handleSignOut}
            onUpdateProfile={handleUpdateProfile}
            onUpdateMatch={handleUpdateMatch}
            onUpdateDocument={async (updatedDoc) => {
              const updatedDocs = documents.map((d: any) => d.id === updatedDoc.id ? updatedDoc : d);
              setDocuments(updatedDocs);
              await saveToDb({ documents: updatedDocs });
            }}
            onSubmitAssessment={async (result: any) => {
              // Persist assessment result to DB
              const updatedResults = [...skillAssessmentResults, result];
              const updatedTSAs = talentSkillAssessments.map((tsa: any) =>
                tsa.id === result.talentSkillAssessmentId
                  ? { ...tsa, status: 'submitted', score: result.autoScore, submittedAt: result.submittedAt }
                  : tsa
              );
              // Also update the talent's vettingPipeline stage record with assessmentScore
              const profile = getCurrentTalentProfile();
              const updatedTalents = talents.map((t: any) => {
                if (t.id !== profile?.id) return t;
                const pipeline = [...(t.vettingPipeline || [])];
                const stageIdx = pipeline.findIndex((s: any) => s.assessmentId && (s.status === 'in_progress'));
                if (stageIdx >= 0) {
                  pipeline[stageIdx] = { ...pipeline[stageIdx], assessmentScore: result.autoScore };
                }
                return { ...t, vettingPipeline: pipeline };
              });
              setSkillAssessmentResults(updatedResults);
              setTalentSkillAssessments(updatedTSAs);
              setTalents(updatedTalents);
              await saveToDb({
                skillAssessmentResults: updatedResults,
                talentSkillAssessments: updatedTSAs,
                talents: updatedTalents
              });
            }}
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
            setRequests={setRequests}
            setInvoices={setInvoices}
            setMessages={setMessages}
            setNotifications={setNotifications}
            setMatches={setMatches}
            saveToDb={saveToDb}
            rehireRequests={rehireRequests}
            setRehireRequests={setRehireRequests}
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
