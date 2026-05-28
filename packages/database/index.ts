import { 
  TalentProfile, ServiceRequest, Match, Task, Contract, Notification, AuditLog, AgentLog,
  User, Organization, ClientProfile, Skill, TalentSkill, Document, Project, Assignment,
  Invoice, Payment, TalentPayout, Message, SupportTicket, SupportMessage, Interview, RehireRequest
} from '@kongila/shared-types';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Seed Data
const DEFAULT_TALENTS: TalentProfile[] = [
  {
    id: 'talent_chidi',
    name: 'Chidi Anya',
    email: 'chidi.anya@kongila.dev',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    title: 'Senior Full-Stack Engineer',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'GraphQL', 'Next.js'],
    timezone: 'GMT+1 (Lagos)',
    salaryExpectation: 4500,
    experienceYears: 6,
    availability: 100,
    vettingStage: 'Final Review',
    vettingStatus: 'Vetted',
    vettingScores: {
      technical: 94,
      behavioral: 88,
      personality: 90,
      remoteReadiness: 95,
      workSimulation: 92,
      communication: 90,
      experience: 85
    },
    grade: 'A+',
    tags: ['Highly Reliable', 'Strong Communicator', 'Independent Worker'],
    bio: 'Elite developer specializing in React and distributed Node.js backends. Passionate about writing scalable, clean code.',
    documents: [
      {
        id: 'doc_chidi_cv',
        name: 'Professional_CV_2024.pdf',
        category: 'Professional (CV, Portfolio)',
        fileSize: '1.2 MB',
        uploadedAt: 'Uploaded 2 days ago',
        status: 'Vetted'
      },
      {
        id: 'doc_chidi_portfolio',
        name: 'UX_Case_Studies.pdf',
        category: 'Professional (CV, Portfolio)',
        fileSize: '18.5 MB',
        uploadedAt: 'Updated 1 week ago',
        status: 'Vetted'
      },
      {
        id: 'doc_chidi_aws',
        name: 'AWS_Devops_cert_Assoc.png',
        category: 'Certifications',
        fileSize: '4.8 MB',
        uploadedAt: 'Verified Jun 2023',
        status: 'Verified',
        certificateImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=150'
      },
      {
        id: 'doc_chidi_nda',
        name: 'Non-Disclosure Agreement (NDA)',
        category: 'Identity & Legal',
        description: 'Confidentiality and proprietary rights for Project Orion.',
        fileSize: '1.5 MB',
        uploadedAt: 'Added 3 days ago',
        status: 'pending_signature',
        dueDate: 'Due in 3 days'
      },
      {
        id: 'doc_chidi_ip',
        name: 'Intellectual Property Agreement',
        category: 'Identity & Legal',
        description: 'Master assignment of inventions and copyright.',
        fileSize: '2.1 MB',
        uploadedAt: 'Dec 12, 2023',
        status: 'signed',
        signedAt: 'Dec 12, 2023'
      },
      {
        id: 'doc_chidi_ethics',
        name: 'Code of Ethics & Conduct',
        category: 'Identity & Legal',
        description: 'Standard corporate behavior and anti-corruption policy.',
        fileSize: '1.1 MB',
        uploadedAt: 'Jan 05, 2026',
        status: 'under_review'
      },
      {
        id: 'doc_chidi_contractor',
        name: 'Independent Contractor Agreement',
        category: 'Identity & Legal',
        description: 'General service provision terms and payout schedules.',
        fileSize: '3.4 MB',
        uploadedAt: 'Mar 30, 2023',
        status: 'signed',
        signedAt: 'Mar 30, 2023'
      },
      {
        id: 'doc_chidi_dpa',
        name: 'Data Privacy Addendum (DPA)',
        category: 'Identity & Legal',
        description: 'Compliance with GDPR and regional data protection laws.',
        fileSize: '1.8 MB',
        uploadedAt: 'Added 2 hours ago',
        status: 'pending_signature',
        dueDate: 'Added 2 hours ago'
      }
    ] as any,
    supportTickets: [
      {
        id: 'TK-88210',
        subject: 'Urgent - API Timeout on Webhooks',
        category: 'Technical Support',
        status: 'Open',
        priority: 'Urgent',
        createdAt: 'Oct 28, 2023',
        lastActivity: '2 mins ago',
        assignedAgent: { name: 'Support System', role: 'Automated Bot', avatar: '' },
        messages: [
          {
            id: 'msg_1',
            sender: { name: 'Chidi Anya', role: 'Talent', isSupport: false },
            text: 'I am getting continuous 504 gateway timeouts when our webhook endpoint is triggered by kongila integration. Please check.',
            timestamp: '10:40 AM'
          }
        ]
      },
      {
        id: 'TK-67842',
        subject: 'Issues with International Wire Transfer - Q3 Earnings',
        category: 'Payment Issues',
        status: 'In Progress',
        priority: 'High',
        createdAt: 'Oct 24, 2023',
        lastActivity: '5 hours ago',
        assignedAgent: { name: 'Sarah Kong', role: 'Global Support Lead', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80' },
        messages: [
          {
            id: 'msg_2_1',
            sender: { name: 'Chidi Anya', role: 'Talent', isSupport: false },
            text: 'Hello, I\'m having trouble receiving my payout for the last project (Project: Nebula). The status says \'Sent\' in the dashboard, but I haven\'t seen anything in my account. I checked with my bank and they don\'t see any pending transfers.',
            timestamp: '10:12 AM'
          },
          {
            id: 'msg_2_2',
            sender: { name: 'Sarah Kong', role: 'Global Support Lead', isSupport: true, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80' },
            text: 'Hi Chidi, I\'ve looked into this for you. It seems there was a slight delay in the intermediary bank processing for international wires this week. I\'ve initiated a trace on the transaction. Could you please confirm if your SWIFT/BIC code has changed recently?',
            timestamp: '10:45 AM'
          }
        ]
      },
      {
        id: 'TK-57115',
        subject: 'Profile Badge Verification',
        category: 'Verification',
        status: 'Resolved',
        priority: 'Medium',
        createdAt: 'Oct 22, 2023',
        lastActivity: '2 days ago',
        assignedAgent: { name: 'Vetting Team', role: 'Compliance Lead', avatar: '' },
        messages: [
          {
            id: 'msg_3_1',
            sender: { name: 'Chidi Anya', role: 'Talent', isSupport: false },
            text: 'Could you please check if my AWS and Scrum Master badges are verified? I uploaded the certificates.',
            timestamp: '9:00 AM'
          },
          {
            id: 'msg_3_2',
            sender: { name: 'Vetting Team', role: 'Compliance Lead', isSupport: true },
            text: 'Hi Chidi, we have verified both certificates. The badges are now live on your profile.',
            timestamp: '2:15 PM'
          }
        ]
      },
      {
        id: 'TK-28301',
        subject: 'New User Onboarding Guide',
        category: 'Guidance',
        status: 'Resolved',
        priority: 'Low',
        createdAt: 'Oct 15, 2023',
        lastActivity: '1 week ago',
        assignedAgent: { name: 'Onboarding Bot', role: 'System Guide', avatar: '' },
        messages: [
          {
            id: 'msg_4_1',
            sender: { name: 'Chidi Anya', role: 'Talent', isSupport: false },
            text: 'Where can I find details about remote retainer agreements?',
            timestamp: '11:00 AM'
          },
          {
            id: 'msg_4_2',
            sender: { name: 'Onboarding Bot', role: 'System Guide', isSupport: true },
            text: 'Welcome to Kongila! You can view all agreement guides in the resources pane or in your documents tab.',
            timestamp: '11:01 AM'
          }
        ]
      }
    ]
  },
  {
    id: 'talent_fatoumata',
    name: 'Fatoumata Diallo',
    email: 'fatoumata.diallo@kongila.dev',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    title: 'Senior Product Designer',
    skills: ['Figma', 'UI Design', 'User Research', 'Design Systems', 'Mobile UX'],
    timezone: 'GMT (Dakar)',
    salaryExpectation: 3800,
    experienceYears: 5,
    availability: 100,
    vettingStage: 'Final Review',
    vettingStatus: 'Vetted',
    vettingScores: {
      technical: 90,
      behavioral: 92,
      personality: 85,
      remoteReadiness: 90,
      workSimulation: 88,
      communication: 95,
      experience: 80
    },
    grade: 'A',
    tags: ['Strong Communicator', 'Attention to Detail'],
    bio: 'Visual designer dedicated to creating beautiful, human-centered web and mobile experiences.',
    documents: [
      {
        id: 'doc_fatoumata_cv',
        name: 'Design_Portfolio_Fatoumata.pdf',
        category: 'Professional (CV, Portfolio)',
        fileSize: '4.2 MB',
        uploadedAt: 'Uploaded 3 days ago',
        status: 'Vetted'
      },
      {
        id: 'doc_fatoumata_nda',
        name: 'Mutual_NDA_Nexus.pdf',
        category: 'Identity & Legal',
        fileSize: '1.4 MB',
        uploadedAt: 'Signed Feb 2024',
        status: 'Verified'
      }
    ] as any
  },
  {
    id: 'talent_kofi',
    name: 'Kofi Mensah',
    email: 'kofi.mensah@kongila.dev',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
    title: 'Lead DevOps Engineer',
    skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux'],
    timezone: 'GMT (Accra)',
    salaryExpectation: 5200,
    experienceYears: 8,
    availability: 90,
    vettingStage: 'Final Review',
    vettingStatus: 'Vetted',
    vettingScores: {
      technical: 96,
      behavioral: 85,
      personality: 80,
      remoteReadiness: 95,
      workSimulation: 95,
      communication: 80,
      experience: 95
    },
    grade: 'A+',
    tags: ['Highly Reliable', 'Independent Worker'],
    bio: 'Infrastructure specialist with deep expertise in cloud architectures, container orchestration, and secure automation pipelines.'
  },
  {
    id: 'talent_zola',
    name: 'Zola Ndlovu',
    email: 'zola.ndlovu@kongila.dev',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
    title: 'Technical Product Manager',
    skills: ['Product Strategy', 'Agile', 'Scrum', 'Jira', 'User Research', 'Product Analytics'],
    timezone: 'GMT+2 (Johannesburg)',
    salaryExpectation: 4800,
    experienceYears: 7,
    availability: 100,
    vettingStage: 'Final Review',
    vettingStatus: 'Vetted',
    vettingScores: {
      technical: 88,
      behavioral: 95,
      personality: 92,
      remoteReadiness: 90,
      workSimulation: 90,
      communication: 98,
      experience: 85
    },
    grade: 'A',
    tags: ['Independent Worker', 'Strong Communicator'],
    bio: 'Experienced PM skilled in bridging engineering and business goals to deliver exceptional user-facing features.'
  },
  {
    id: 'talent_amina',
    name: 'Amina Osei',
    email: 'amina.osei@kongila.dev',
    avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&q=80&w=200',
    title: 'Frontend Engineer',
    skills: ['React', 'CSS', 'JavaScript', 'HTML5', 'TailwindCSS'],
    timezone: 'GMT+3 (Nairobi)',
    salaryExpectation: 2500,
    experienceYears: 2,
    availability: 100,
    vettingStage: 'Skill Assessment',
    vettingStatus: 'Review',
    vettingScores: {
      technical: 72,
      behavioral: 80,
      personality: 78,
      remoteReadiness: 85,
      workSimulation: 70,
      communication: 88,
      experience: 50
    },
    grade: 'B',
    tags: ['Needs Supervision', 'Strong Learner'],
    bio: 'Motivated React developer eager to learn and grow in a fast-paced remote product team.'
  }
];

const INITIAL_AGENT_LOGS: AgentLog[] = [
  {
    id: 'alog_1',
    agentName: 'Context Agent',
    message: 'System monitoring initialized. Tracking 5 vetted talent files.',
    timestamp: new Date().toLocaleTimeString(),
    type: 'info'
  },
  {
    id: 'alog_2',
    agentName: 'Workflow Agent',
    message: 'Work execution hooks registered. Active status listener loaded.',
    timestamp: new Date().toLocaleTimeString(),
    type: 'info'
  }
];

const DB_FILE_PATH = path.join('/Users/oluwadammilola/benita/kongila', 'db.json');

interface Schema {
  talents: TalentProfile[];
  clientRequests: ServiceRequest[];
  matches: Match[];
  tasks: Task[];
  contracts: Contract[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  agentLogs: AgentLog[];
  users: User[];
  organizations: Organization[];
  clientProfiles: ClientProfile[];
  skills: Skill[];
  talentSkills: TalentSkill[];
  documents: Document[];
  projects: Project[];
  assignments: Assignment[];
  invoices: Invoice[];
  payments: Payment[];
  talentPayouts: TalentPayout[];
  messages: Message[];
  roles: any[];
  userRoles: any[];
  supportTickets: SupportTicket[];
  supportMessages: SupportMessage[];
  interviews: Interview[];
  rehireRequests?: RehireRequest[];
}

const DEFAULT_INTERVIEWS: Interview[] = [
  {
    id: 'interview_001',
    requestId: 'req_seed_001',
    matchId: 'match_seed_001',
    talentId: 'talent_chidi',
    talentName: 'Chidi Anya',
    talentAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    clientName: 'Horizon Fintech',
    title: 'Senior Full-Stack Engineering Interview',
    date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '10:00',
    status: 'Scheduled',
    meetingLink: 'https://meet.google.com/kng-int-001',
    notes: 'Focus on system design and distributed architecture experience.',
    googleCalendarEventId: 'gcal_evt_001',
    googleCalendarLink: 'https://calendar.google.com/calendar/event?eid=gcal_evt_001',
    createdAt: new Date().toISOString()
  },
  {
    id: 'interview_002',
    requestId: 'req_seed_002',
    matchId: 'match_seed_002',
    talentId: 'talent_fatoumata',
    talentName: 'Fatoumata Diallo',
    talentAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    clientName: 'Nexus Health',
    title: 'Lead Product Designer Final Interview',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '14:00',
    status: 'Scheduled',
    meetingLink: 'https://meet.google.com/kng-int-002',
    notes: 'Portfolio walkthrough and design philosophy discussion.',
    googleCalendarEventId: 'gcal_evt_002',
    googleCalendarLink: 'https://calendar.google.com/calendar/event?eid=gcal_evt_002',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_CONTRACTS: any[] = [
  {
    id: 'KNG-FIN-2024-883',
    matchId: 'match_chidi',
    clientId: 'client_horizon',
    clientName: 'Horizon Fintech',
    talentId: 'talent_chidi',
    talentName: 'Chidi Anya',
    role: 'Senior UI Designer',
    salary: 6400,
    startDate: 'Jan 12, 2024',
    status: 'Signed',
    signedAt: '2024-01-12T10:00:00.000Z',
    rateType: 'Hourly',
    rateAmount: 120.00,
    totalEarned: 54240.00,
    invoicedBalance: 12450.00,
    nextPayout: 6400.00,
    nextPayoutDate: 'Friday, May 24',
    endDate: 'Dec 21, 2024',
    engagementModel: 'Remote / Full-time Retainer',
    rating: 5,
    qualityOfWork: 4.9,
    communication: 4.8,
    timeliness: 4.9
  },
  {
    id: 'KNG-HEA-2023-735',
    matchId: 'match_fatoumata',
    clientId: 'client_nexus',
    clientName: 'Nexus Health',
    talentId: 'talent_fatoumata',
    talentName: 'Fatoumata Diallo',
    role: 'Lead Product Designer',
    salary: 5800,
    startDate: 'Mar 15, 2023',
    status: 'Signed',
    signedAt: '2023-03-15T09:30:00.000Z',
    rateType: 'Monthly',
    rateAmount: 5800.00,
    totalEarned: 42800.00,
    invoicedBalance: 8200.00,
    nextPayout: 5800.00,
    nextPayoutDate: 'Friday, May 24',
    endDate: 'Dec 15, 2024',
    engagementModel: 'Remote / Hybrid (Dakar)',
    rating: 5,
    qualityOfWork: 5.0,
    communication: 4.9,
    timeliness: 4.8
  }
];

const DEFAULT_USERS: User[] = [
  { id: 'usr_chidi', name: 'Chidi Anya', email: 'chidi.anya@kongila.dev', role: 'talent', platform_access: ['kongila', 'remotan'] },
  { id: 'usr_fatoumata', name: 'Fatoumata Diallo', email: 'fatoumata.diallo@kongila.dev', role: 'talent', platform_access: ['kongila', 'remotan'] },
  { id: 'usr_horizon', name: 'Horizon Fintech Admin', email: 'billing@horizon.com', role: 'client', platform_access: ['kongila'] },
  { id: 'usr_admin', name: 'System Admin', email: 'admin@kongila.com', role: 'admin', platform_access: ['kongila', 'admin'] }
];

const DEFAULT_ORGANIZATIONS: Organization[] = [
  { id: 'client_horizon', name: 'Horizon Fintech', subscription_type: 'Enterprise' },
  { id: 'client_nexus', name: 'Nexus Health', subscription_type: 'Basic' }
];

const DEFAULT_CLIENT_PROFILES: ClientProfile[] = [
  { id: 'clp_horizon', userId: 'usr_horizon', organizationId: 'client_horizon', position: 'VP of Engineering', phone: '+1 (555) 019-2834' }
];

const DEFAULT_SKILLS: Skill[] = [
  { id: 'skl_react', name: 'React' },
  { id: 'skl_node', name: 'Node.js' },
  { id: 'skl_ts', name: 'TypeScript' },
  { id: 'skl_figma', name: 'Figma' },
  { id: 'skl_aws', name: 'AWS' }
];

const DEFAULT_TALENT_SKILLS: TalentSkill[] = [
  { id: 'tsk_chidi_react', talentId: 'talent_chidi', skillId: 'skl_react', level: 'expert' },
  { id: 'tsk_chidi_node', talentId: 'talent_chidi', skillId: 'skl_node', level: 'expert' },
  { id: 'tsk_fatoumata_figma', talentId: 'talent_fatoumata', skillId: 'skl_figma', level: 'expert' }
];

const DEFAULT_DOCUMENTS: Document[] = [
  { id: 'doc_chidi_cv', userId: 'usr_chidi', name: 'Professional_CV_2024.pdf', type: 'CV', fileSize: '1.2 MB', status: 'vetted', uploadedAt: '2024-05-17T10:00:00.000Z' },
  { id: 'doc_chidi_portfolio', userId: 'usr_chidi', name: 'UX_Case_Studies.pdf', type: 'portfolio', fileSize: '18.5 MB', status: 'vetted', uploadedAt: '2024-05-12T10:00:00.000Z' },
  { id: 'doc_chidi_aws', userId: 'usr_chidi', name: 'AWS_Devops_cert_Assoc.png', type: 'certification', fileSize: '4.8 MB', status: 'verified', certificateImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=150', uploadedAt: '2023-06-15T10:00:00.000Z' },
  { id: 'doc_chidi_nda', userId: 'usr_chidi', name: 'Non-Disclosure Agreement (NDA)', type: 'NDA', fileSize: '1.5 MB', status: 'pending_signature', uploadedAt: '2026-05-16T10:00:00.000Z', description: 'Confidentiality and proprietary rights for Project Orion.', dueDate: 'Due in 3 days' },
  { id: 'doc_chidi_ip', userId: 'usr_chidi', name: 'Intellectual Property Agreement', type: 'agreement', fileSize: '2.1 MB', status: 'signed', uploadedAt: '2023-12-12T10:00:00.000Z', description: 'Master assignment of inventions and copyright.', signedAt: 'Dec 12, 2023' },
  { id: 'doc_chidi_ethics', userId: 'usr_chidi', name: 'Code of Ethics & Conduct', type: 'IT_Ethics_Policy', fileSize: '1.1 MB', status: 'under_review', uploadedAt: '2026-01-05T10:00:00.000Z', description: 'Standard corporate behavior and anti-corruption policy.' },
  { id: 'doc_chidi_contractor', userId: 'usr_chidi', name: 'Independent Contractor Agreement', type: 'agreement', fileSize: '3.4 MB', status: 'signed', uploadedAt: '2023-03-30T10:00:00.000Z', description: 'General service provision terms and payout schedules.', signedAt: 'Mar 30, 2023' },
  { id: 'doc_chidi_dpa', userId: 'usr_chidi', name: 'Data Privacy Addendum (DPA)', type: 'agreement', fileSize: '1.8 MB', status: 'pending_signature', uploadedAt: '2026-05-19T08:00:00.000Z', description: 'Compliance with GDPR and regional data protection laws.', dueDate: 'Added 2 hours ago' }
];

const DEFAULT_PROJECTS: Project[] = [
  { id: 'project_general', clientId: 'client_horizon', name: 'General Onboarding', description: 'Initial onboarding orientation projects.', startDate: '2024-01-01', endDate: '2024-12-31', status: 'active' },
  { id: 'project_nebula', clientId: 'client_horizon', name: 'Project Nebula', description: 'Core ledger database service development.', startDate: '2024-02-01', endDate: '2024-11-30', status: 'active' }
];

const DEFAULT_ASSIGNMENTS: Assignment[] = [
  { id: 'asg_chidi_nebula', talentId: 'talent_chidi', projectId: 'project_nebula', contractId: 'KNG-FIN-2024-883', role: 'Senior Full-Stack Developer', startDate: '2024-01-12', endDate: '2024-12-21', status: 'active' }
];

const DEFAULT_INVOICES: Invoice[] = [
  { id: 'inv_horizon_1', clientId: 'usr_horizon', amount: 12450.00, status: 'paid', dueDate: '2026-05-01' },
  { id: 'inv_horizon_2', clientId: 'usr_horizon', amount: 6250.40, status: 'overdue', dueDate: '2026-04-15' },
  { id: 'inv_horizon_3', clientId: 'usr_horizon', amount: 18750.40, status: 'sent', dueDate: '2026-05-31' },
  { id: 'inv_horizon_4', clientId: 'usr_horizon', amount: 8900.00, status: 'paid', dueDate: '2026-04-01' },
  { id: 'inv_horizon_5', clientId: 'usr_horizon', amount: 12500.00, status: 'overdue', dueDate: '2026-03-10' },
  { id: 'inv_horizon_6', clientId: 'usr_horizon', amount: 42300.00, status: 'sent', dueDate: '2026-06-15' }
];

const DEFAULT_PAYMENTS: Payment[] = [
  { id: 'pmt_horizon_april', invoiceId: 'inv_horizon_may', amount: 12450.00, paymentMethod: 'ACH Bank Wire', status: 'paid', paidAt: '2026-05-01T15:00:00.000Z' }
];

const DEFAULT_TALENT_PAYOUTS: TalentPayout[] = [
  { id: 'pay_chidi_may', talentId: 'talent_chidi', contractId: 'KNG-FIN-2024-883', amount: 5800.00, status: 'paid', paidAt: '2026-05-15T12:00:00.000Z' }
];

const DEFAULT_MESSAGES: Message[] = [
  { id: 'msg_chidi_admin', senderId: 'usr_admin', receiverId: 'usr_chidi', content: 'Welcome to Kongila talent network! Let us know if you need help setting up billing.', timestamp: '2026-05-18T09:00:00.000Z', readStatus: true }
];

const DEFAULT_SUPPORT_TICKETS: SupportTicket[] = [
  { id: 'TK-88210', talentId: 'talent_chidi', subject: 'Urgent - API Timeout on Webhooks', category: 'Technical Support', status: 'Open', priority: 'Urgent', createdAt: 'Oct 28, 2023', lastActivity: '2 mins ago' },
  { id: 'TK-67842', talentId: 'talent_chidi', subject: 'Issues with International Wire Transfer - Q3 Earnings', category: 'Payment Issues', status: 'In Progress', priority: 'High', createdAt: 'Oct 24, 2023', lastActivity: '5 hours ago' },
  { id: 'TK-57115', talentId: 'talent_chidi', subject: 'Profile Badge Verification', category: 'Verification', status: 'Resolved', priority: 'Medium', createdAt: 'Oct 22, 2023', lastActivity: '2 days ago' },
  { id: 'TK-28301', talentId: 'talent_chidi', subject: 'New User Onboarding Guide', category: 'Guidance', status: 'Resolved', priority: 'Low', createdAt: 'Oct 15, 2023', lastActivity: '1 week ago' }
];

const DEFAULT_SUPPORT_MESSAGES: SupportMessage[] = [
  {
    id: 'msg_1',
    ticketId: 'TK-88210',
    senderName: 'Chidi Anya',
    senderRole: 'Talent',
    isSupport: false,
    text: 'I am getting continuous 504 gateway timeouts when our webhook endpoint is triggered by kongila integration. Please check.',
    timestamp: '10:40 AM',
    createdAt: '2023-10-28T10:40:00.000Z'
  },
  {
    id: 'msg_2_1',
    ticketId: 'TK-67842',
    senderName: 'Chidi Anya',
    senderRole: 'Talent',
    isSupport: false,
    text: 'Hello, I\'m having trouble receiving my payout for the last project (Project: Nebula). The status says \'Sent\' in the dashboard, but I haven\'t seen anything in my account. I checked with my bank and they don\'t see any pending transfers.',
    timestamp: '10:12 AM',
    createdAt: '2023-10-24T10:12:00.000Z'
  },
  {
    id: 'msg_2_2',
    ticketId: 'TK-67842',
    senderName: 'Sarah Kong',
    senderRole: 'Global Support Lead',
    isSupport: true,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80',
    text: 'Hi Chidi, I\'ve looked into this for you. It seems there was a slight delay in the intermediary bank processing for international wires this week. I\'ve initiated a trace on the transaction. Could you please confirm if your SWIFT/BIC code has changed recently?',
    timestamp: '10:45 AM',
    createdAt: '2023-10-24T10:45:00.000Z'
  }
];

// In-Memory Fallback
let inMemoryDb: Schema = {
  talents: DEFAULT_TALENTS,
  clientRequests: [],
  matches: [],
  tasks: [],
  contracts: DEFAULT_CONTRACTS,
  notifications: [],
  auditLogs: [],
  agentLogs: INITIAL_AGENT_LOGS,
  users: DEFAULT_USERS,
  organizations: DEFAULT_ORGANIZATIONS,
  clientProfiles: DEFAULT_CLIENT_PROFILES,
  skills: DEFAULT_SKILLS,
  talentSkills: DEFAULT_TALENT_SKILLS,
  documents: DEFAULT_DOCUMENTS,
  projects: DEFAULT_PROJECTS,
  assignments: DEFAULT_ASSIGNMENTS,
  invoices: DEFAULT_INVOICES,
  payments: DEFAULT_PAYMENTS,
  talentPayouts: DEFAULT_TALENT_PAYOUTS,
  messages: DEFAULT_MESSAGES,
  roles: [],
  userRoles: [],
  supportTickets: DEFAULT_SUPPORT_TICKETS,
  supportMessages: DEFAULT_SUPPORT_MESSAGES,
  interviews: DEFAULT_INTERVIEWS,
  rehireRequests: []
};

function isServer(): boolean {
  return typeof window === 'undefined';
}

export function readDb(): Schema {
  if (!isServer()) {
    // Client Side: read from localStorage or return inMemoryDb
    const local = localStorage.getItem('kongila_db');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        return inMemoryDb;
      }
    }
    return inMemoryDb;
  }

  // Server Side: read from db.json file
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read db.json:', e);
  }

  // If file doesn't exist, create it with seed data
  writeDb(inMemoryDb);
  return inMemoryDb;
}

export function writeDb(db: Schema): void {
  inMemoryDb = db;
  if (!isServer()) {
    localStorage.setItem('kongila_db', JSON.stringify(db));
    return;
  }

  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write to db.json:', e);
  }
}

// REST Client Wrapper for frontend usage
export async function fetchDbClient(): Promise<Schema> {
  try {
    const res = await fetch('/api/db');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  return readDb();
}

export async function writeDbClient(db: Schema): Promise<void> {
  try {
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(db)
    });
  } catch (e) {}
  writeDb(db);
}

// Database Helpers
export function getTalents(): TalentProfile[] {
  return readDb().talents;
}

export function updateTalent(talent: TalentProfile): void {
  const db = readDb();
  db.talents = db.talents.map(t => t.id === talent.id ? talent : t);
  writeDb(db);
}

export function getClientRequests(): ServiceRequest[] {
  return readDb().clientRequests;
}

export function createClientRequest(req: Omit<ServiceRequest, 'id' | 'createdAt'>): ServiceRequest {
  const db = readDb();
  const newReq: ServiceRequest = {
    ...req,
    id: `req_${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  db.clientRequests.push(newReq);
  
  // Log event
  addAuditLog('Client', 'Create Service Request', `Submitted new ${req.serviceType} role request for budget $${req.budget}`);
  addAgentLog('Context Agent', `New client request added for a ${req.serviceType} role. Launching vetting & sourcing scans.`, 'success');
  
  writeDb(db);
  return newReq;
}

export function updateRequestStatus(id: string, status: ServiceRequest['status']): void {
  const db = readDb();
  db.clientRequests = db.clientRequests.map(r => r.id === id ? { ...r, status } : r);
  addAuditLog('Admin', 'Update Request Status', `Request ${id} updated to status ${status}`);
  addAgentLog('Workflow Agent', `Request status for ${id} transitioned to: ${status}.`, 'info');
  writeDb(db);
}

export function getMatches(): Match[] {
  return readDb().matches;
}

export function createMatches(matches: Match[]): void {
  const db = readDb();
  // Filter out duplicates
  const existingIds = db.matches.map(m => m.id);
  const newMatches = matches.filter(m => !existingIds.includes(m.id));
  db.matches.push(...newMatches);
  
  addAgentLog('Matching Agent', `Calculated matching scores for request. Highly suited talents recommended.`, 'success');
  writeDb(db);
}

export function updateMatchStatus(matchId: string, status: Match['status']): void {
  const db = readDb();
  db.matches = db.matches.map(m => m.id === matchId ? { ...m, status } : m);
  addAgentLog('Workflow Agent', `Match ${matchId} updated to state: ${status}.`, 'info');
  writeDb(db);
}

export function getTasks(): Task[] {
  return readDb().tasks;
}

export function createTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
  const db = readDb();
  const newTask: Task = {
    ...task,
    id: `task_${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  db.tasks.push(newTask);
  
  addAuditLog('Manager', 'Create Task', `Assigned task "${task.title}" to ${task.assigneeName}`);
  addAgentLog('Execution Agent', `Assigned work item: "${task.title}" placed on the Board for ${task.assigneeName}.`, 'info');
  
  writeDb(db);
  return newTask;
}

export function updateTaskStatus(id: string, status: Task['status'], blockerDescription?: string): void {
  const db = readDb();
  db.tasks = db.tasks.map(t => {
    if (t.id === id) {
      if (status === 'Blocked') {
        addAgentLog('Execution Agent', `Task ${id} flagged as BLOCKED: "${blockerDescription}". Escalating blocker alert.`, 'error');
        addNotification(t.assigneeId, 'Task Blocked Escalation', `Your task "${t.title}" was flagged as blocked. Support is informed.`);
      } else if (status === 'Completed') {
        addAgentLog('Performance Agent', `Task completed by ${t.assigneeName}. Efficiency scores updated.`, 'success');
      }
      return { ...t, status, blockerDescription };
    }
    return t;
  });
  writeDb(db);
}

export function getContracts(): Contract[] {
  return readDb().contracts;
}

export function createContract(contract: Omit<Contract, 'id' | 'status'>): Contract {
  const db = readDb();
  const newContract: Contract = {
    ...contract,
    id: `contract_${Date.now()}`,
    status: 'Pending'
  };
  db.contracts.push(newContract);
  
  addAuditLog('Admin', 'Generate Contract', `Generated employment agreement for ${contract.talentName}`);
  addAgentLog('Compliance Agent', `Generated contractor NDA & e-agreement for ${contract.talentName}. Waiting for signature.`, 'info');
  
  writeDb(db);
  return newContract;
}

export function signContract(id: string): void {
  const db = readDb();
  db.contracts = db.contracts.map(c => {
    if (c.id === id) {
      // Transition talent profile status to Deployed
      db.talents = db.talents.map(t => t.id === c.talentId ? { ...t, vettingStatus: 'Deployed' } : t);
      
      // Auto assign onboarding tasks in Remotan
      const onboardingTask: Task = {
        id: `task_onb_${Date.now()}`,
        projectId: 'project_general',
        projectName: 'General Onboarding',
        title: 'Complete Onboarding Welcome Videos & Systems Setup',
        description: 'Read the IT security handbook, complete portal onboarding details, and watch introducing media.',
        assigneeId: c.talentId,
        assigneeName: c.talentName,
        status: 'In Progress',
        priority: 'High',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };
      db.tasks.push(onboardingTask);
      
      addAuditLog('Talent', 'Sign Contract', `Talent ${c.talentName} successfully e-signed employment agreement.`);
      addAgentLog('Compliance Agent', `NDA and Master Services Agreement signed by ${c.talentName}. Onboarding tasks spawned.`, 'success');
      
      return { ...c, status: 'Signed', signedAt: new Date().toISOString() };
    }
    return c;
  });
  writeDb(db);
}

export function getNotifications(userId: string): Notification[] {
  return readDb().notifications.filter(n => n.userId === userId);
}

export function addNotification(userId: string, title: string, message: string): void {
  const db = readDb();
  db.notifications.push({
    id: `notif_${Date.now()}`,
    userId,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString()
  });
  writeDb(db);
}

export function getAuditLogs(): AuditLog[] {
  return readDb().auditLogs;
}

export function addAuditLog(actor: string, action: string, details: string): void {
  const db = readDb();
  db.auditLogs.push({
    id: `audit_${Date.now()}`,
    actor,
    action,
    details,
    timestamp: new Date().toISOString()
  });
  writeDb(db);
}

export function getAgentLogs(): AgentLog[] {
  return readDb().agentLogs;
}

export function addAgentLog(agentName: AgentLog['agentName'], message: string, type: AgentLog['type'] = 'info'): void {
  const db = readDb();
  db.agentLogs.unshift({
    id: `alog_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    agentName,
    message,
    timestamp: new Date().toLocaleTimeString(),
    type
  });
  
  // Cap agent logs at 100 entries to prevent memory overflow
  if (db.agentLogs.length > 100) {
    db.agentLogs = db.agentLogs.slice(0, 100);
  }
  
  writeDb(db);
}

// ─── Interview CRUD Helpers ───────────────────────────────────────────────────

export function getInterviews(): Interview[] {
  const db = readDb();
  return db.interviews || [];
}

export function createInterview(data: Omit<Interview, 'id' | 'createdAt'>): Interview {
  const db = readDb();
  const newInterview: Interview = {
    ...data,
    id: `interview_${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  if (!db.interviews) db.interviews = [];
  db.interviews.push(newInterview);

  addAuditLog(
    'Client',
    'Schedule Interview',
    `Booked "${data.title}" with ${data.talentName} on ${data.date} at ${data.time}`
  );
  addAgentLog(
    'Workflow Agent',
    `Interview slot confirmed with ${data.talentName} on ${data.date}. Google Calendar event synced.`,
    'success'
  );

  writeDb(db);
  return newInterview;
}

export function updateInterview(id: string, updates: Partial<Interview>): Interview | null {
  const db = readDb();
  if (!db.interviews) return null;
  let updated: Interview | null = null;
  db.interviews = db.interviews.map(iv => {
    if (iv.id === id) {
      updated = { ...iv, ...updates, updatedAt: new Date().toISOString() };
      return updated;
    }
    return iv;
  });

  if (updated) {
    const iv = updated as Interview;
    addAuditLog(
      'Client',
      updates.status === 'Rescheduled' ? 'Reschedule Interview' : 'Update Interview',
      `Interview "${iv.title}" with ${iv.talentName} updated — new slot: ${iv.date} at ${iv.time}`
    );
    addAgentLog(
      'Workflow Agent',
      `Interview rescheduled for ${iv.talentName}. Calendar invite updated automatically.`,
      'info'
    );
  }

  writeDb(db);
  return updated;
}

export function deleteInterview(id: string): void {
  const db = readDb();
  if (!db.interviews) return;
  const target = db.interviews.find(iv => iv.id === id);
  db.interviews = db.interviews.filter(iv => iv.id !== id);
  if (target) {
    addAuditLog('Client', 'Cancel Interview', `Interview with ${target.talentName} cancelled.`);
    addAgentLog('Workflow Agent', `Interview with ${target.talentName} removed from calendar.`, 'warning');
  }
  writeDb(db);
}

let supabaseClient: any = null;
const defaultSupabaseUrl = 'https://bsmwuofugczuhdbintgs.supabase.co';
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc';

function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultSupabaseAnonKey;
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

export async function readDbAsync(): Promise<Schema> {
  const localDb = readDb();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultSupabaseAnonKey;

    if (!supabaseAnonKey) {
      console.warn("No Supabase Anon Key provided. Operating in local-only mode using db.json.");
      return localDb;
    }

    const supabase = getSupabaseClient();

    const [
      rUsers, rOrgs, rClientProfiles, rTalents, rSkills, rTalentSkills, rDocs,
      rRequests, rMatches, rProjects, rTasks, rContracts, rAssignments,
      rInvoices, rPayments, rPayouts, rMessages, rNotifs, rAudit, rAgent,
      rTickets, rSupportMessages
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('organizations').select('*'),
      supabase.from('client_profiles').select('*'),
      supabase.from('talent_profiles').select('*'),
      supabase.from('skills').select('*'),
      supabase.from('talent_skills').select('*'),
      supabase.from('documents').select('*'),
      supabase.from('service_requests').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('projects').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('contracts').select('*'),
      supabase.from('assignments').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('talent_payouts').select('*'),
      supabase.from('messages').select('*'),
      supabase.from('notifications').select('*'),
      supabase.from('audit_logs').select('*'),
      supabase.from('agent_logs').select('*'),
      supabase.from('support_tickets').select('*'),
      supabase.from('support_messages').select('*')
    ]);

    if (rUsers.error || rTalents.error) {
      console.warn("Supabase queries failed. Operating in local-only mode using db.json.");
      return localDb;
    }

    const users = (rUsers.data || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      emailVerified: u.email_verified,
      createdAt: u.created_at,
      updatedAt: u.updated_at
    }));

    const userMap = new Map<string, any>(users.map((u: any) => [u.id, u]));

    const organizations = (rOrgs.data || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      created_by: o.created_by,
      created_at: o.created_at
    }));

    const clientProfiles = (rClientProfiles.data || []).map((cp: any) => ({
      id: cp.id,
      userId: cp.user_id,
      organizationId: cp.organization_id,
      position: cp.position,
      phone: cp.phone
    }));

    const skills = (rSkills.data || []).map((s: any) => ({
      id: s.id,
      name: s.name
    }));

    const talentSkills = (rTalentSkills.data || []).map((ts: any) => ({
      id: ts.id,
      talentId: ts.talent_id,
      skillId: ts.skill_id,
      level: ts.level
    }));

    const talentSkillsMap = new Map<string, string[]>();
    for (const ts of talentSkills) {
      const name = skills.find((s: any) => s.id === ts.skillId)?.name;
      if (name) {
        if (!talentSkillsMap.has(ts.talentId)) {
          talentSkillsMap.set(ts.talentId, []);
        }
        talentSkillsMap.get(ts.talentId)!.push(name);
      }
    }

    const documents = (rDocs.data || []).map((doc: any) => ({
      id: doc.id,
      userId: doc.user_id,
      name: doc.name,
      type: doc.type,
      fileSize: doc.file_size,
      status: doc.status,
      uploadedAt: doc.uploaded_at
    }));

    const talents = (rTalents.data || []).map((t: any) => {
      let bio = t.bio || '';
      let tags: string[] = [];
      let vettingScores: any = {
        technical: 90,
        behavioral: 85,
        personality: 88,
        remoteReadiness: 90,
        workSimulation: 85,
        communication: 90,
        experience: 80
      };
      let telemetry: any = {};
      
      if (bio.startsWith('Tags:')) {
        const lines = bio.split('\n\n');
        const tagsLine = lines[0].replace('Tags:', '').trim();
        tags = tagsLine ? tagsLine.split(', ').filter(Boolean) : [];
        
        if (lines[1] && lines[1].startsWith('Scores:')) {
          try {
            vettingScores = JSON.parse(lines[1].replace('Scores:', '').trim());
          } catch (e) {}
        }
        
        if (lines[2] && lines[2].startsWith('Telemetry:')) {
          try {
            telemetry = JSON.parse(lines[2].replace('Telemetry:', '').trim());
          } catch (e) {}
          bio = lines.slice(3).join('\n\n').replace('Bio:', '').trim();
        } else {
          bio = lines.slice(2).join('\n\n').replace('Bio:', '').trim();
        }
      }

      const email = userMap.get(t.user_id)?.email || '';
      const name = t.full_name;
      const avatar = t.avatar_url;
      const availability = t.availability_hours;

      const talentDocs = documents.filter((d: any) => d.userId === t.user_id);

      return {
        id: t.id,
        name,
        email,
        avatar,
        title: t.level || 'Professional',
        skills: talentSkillsMap.get(t.id) || [],
        timezone: t.timezone,
        salaryExpectation: Number(t.salary_expectation || t.salary_max || 0),
        experienceYears: Number(t.experience_years || 0),
        availability,
        vettingStage: t.vetting_stage,
        vettingStatus: t.vetting_status,
        vettingScores,
        grade: t.grade,
        tags,
        bio,
        documents: talentDocs,
        
        // Onboarding and Personal Telemetry fields from database (stored inside bio text)
        phone: t.phone || telemetry.phone || '',
        city: telemetry.city || '',
        country: t.country || telemetry.country || 'Nigeria',
        seniorityLevel: telemetry.seniorityLevel || '',
        employmentPreference: telemetry.employmentPreference || '',
        currency: telemetry.currency || 'USD',
        hourlyMonthly: telemetry.hourlyMonthly || 'Monthly',
        portfolioUrl: telemetry.portfolioUrl || '',
        certifications: telemetry.certifications || '',
        internetQuality: telemetry.internetQuality || '',
        workSetup: telemetry.workSetup || '',
        devices: telemetry.devices || '',
        communicationTools: telemetry.communicationTools || '',
        dateOfBirth: telemetry.dateOfBirth || '',
        gender: t.gender || telemetry.gender || '',
        nationality: telemetry.nationality || '',
        maritalStatus: telemetry.maritalStatus || '',
        nationalId: telemetry.nationalId || '',
        passportNo: telemetry.passportNo || '',
        address: t.address || telemetry.address || '',
        workExperience: telemetry.workExperience || []
      } as any;
    });

    const clientRequests = (rRequests.data || []).map((r: any) => {
      let roleDescription = r.description || '';
      let requiredSkills: string[] = [];
      let priority = 'Medium';
      let timezone = 'GMT+1';
      let budget = 0;
      let clientName = 'Horizon Fintech';
      
      try {
        const parsed = JSON.parse(r.description);
        if (parsed && typeof parsed === 'object') {
          roleDescription = parsed.roleDescription || '';
          requiredSkills = parsed.requiredSkills || [];
          priority = parsed.priority || 'Medium';
          timezone = parsed.timezone || 'GMT+1';
          budget = parsed.budget || 0;
          clientName = parsed.clientName || 'Horizon Fintech';
        }
      } catch (e) {}

      return {
        id: r.id,
        clientId: r.client_id,
        clientName,
        serviceType: r.service_type,
        roleDescription,
        requiredSkills,
        duration: r.duration,
        commitmentLevel: r.commitment_level,
        numberOfHires: r.num_of_talents,
        timezone,
        startDate: r.start_date,
        budget,
        priority,
        status: r.status === 'new' ? 'New Request' : 'Matching',
        createdAt: r.created_at
      };
    });

    const matches = (rMatches.data || []).map((m: any) => {
      return {
        id: m.id,
        requestId: m.request_id,
        talentId: m.talent_id,
        status: m.status === 'proposed' ? 'Interview Scheduled' : m.status.charAt(0).toUpperCase() + m.status.slice(1),
        score: 90,
        breakdown: { skillFit: 92, cultureFit: 88, experienceFit: 90 },
        createdAt: m.created_at || new Date().toISOString()
      } as any;
    });

    const projects = (rProjects.data || []).map((p: any) => ({
      id: p.id,
      clientId: p.client_id,
      name: p.name,
      description: p.description,
      startDate: p.start_date,
      endDate: p.end_date,
      status: p.status
    }));

    const tasks = (rTasks.data || []).map((t: any) => {
      const proj = projects.find((p: any) => p.id === t.project_id);
      const userRec = users.find((u: any) => u.id === t.assigned_to);
      const talentRec = talents.find((tal: any) => tal.id === t.assigned_to || tal.email === userRec?.email);
      
      return {
        id: t.id,
        projectId: t.project_id,
        projectName: proj?.name || 'General Project',
        title: t.title,
        description: t.description,
        assigneeId: t.assigned_to,
        assigneeName: talentRec?.name || userRec?.email || 'Unassigned',
        status: t.status === 'in_progress' ? 'In Progress' : (t.status === 'done' ? 'Completed' : 'To Do'),
        priority: 'Medium',
        dueDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      } as any;
    });

    const contracts = (rContracts.data || []).map((c: any) => {
      const talent = talents.find((t: any) => t.id === c.talent_id);
      const clientUser = users.find((u: any) => u.id === c.client_id);
      const clientProfile = clientProfiles.find((cp: any) => cp.userId === c.client_id);
      const org = organizations.find((o: any) => o.id === clientProfile?.organizationId);

      const clientName = org?.name || 'Horizon Fintech';
      const talentName = talent?.name || 'Chidi Anya';

      return {
        id: c.id,
        matchId: `match_${c.talent_id}`,
        clientId: c.client_id,
        clientName,
        talentId: c.talent_id,
        talentName,
        role: c.service_type || 'Contractor',
        salary: Number(c.rate_amount || 0),
        startDate: c.start_date || 'Jan 12, 2024',
        status: c.status === 'signed' ? 'Signed' : 'Pending',
        signedAt: c.signed_at,
        rateType: c.rate_type || 'Monthly',
        rateAmount: Number(c.rate_amount || 0),
        totalEarned: Number(c.total_earned || 0),
        invoicedBalance: Number(c.invoiced_balance || 0),
        nextPayout: Number(c.next_payout || 0),
        nextPayoutDate: 'Friday, May 24',
        endDate: c.end_date || 'Dec 21, 2024',
        engagementModel: c.engagement_model || null,
        rating: Number(c.rating || 5),
        qualityOfWork: Number(c.quality_of_work || 5),
        communication: Number(c.communication || 5),
        timeliness: Number(c.timeliness || 5)
      };
    });

    const assignments = (rAssignments.data || []).map((a: any) => ({
      id: a.id,
      talentId: a.talent_id,
      projectId: a.project_id,
      contractId: a.contract_id,
      role: a.role,
      status: a.status
    }));

    const invoices = (rInvoices.data || []).map((inv: any) => ({
      id: inv.id,
      clientId: inv.client_id,
      amount: Number(inv.amount || 0),
      status: inv.status,
      dueDate: inv.due_date
    }));

    const payments = (rPayments.data || []).map((p: any) => ({
      id: p.id,
      invoiceId: p.invoice_id,
      amount: Number(p.amount || 0),
      paymentMethod: p.payment_method,
      status: p.status,
      paidAt: p.paid_at
    }));

    const talentPayouts = (rPayouts.data || []).map((tp: any) => ({
      id: tp.id,
      talentId: tp.talent_id,
      contractId: tp.contract_id,
      amount: Number(tp.amount || 0),
      status: tp.status,
      paidAt: tp.paid_at
    }));

    const messages = (rMessages.data || []).map((msg: any) => ({
      id: msg.id,
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      content: msg.content,
      timestamp: msg.timestamp,
      readStatus: msg.read_status
    }));

    const notifications = (rNotifs.data || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.created_at
    }));

    const auditLogs = (rAudit.data || []).map((al: any) => ({
      id: al.id,
      actor: al.actor,
      action: al.action,
      details: al.details,
      timestamp: al.timestamp
    }));

    const agentLogs = (rAgent.data || []).map((ag: any) => ({
      id: ag.id,
      agentName: ag.agent_name,
      message: ag.message,
      timestamp: ag.timestamp,
      type: ag.type
    }));

    const supportTickets = (rTickets.data || []).map((st: any) => ({
      id: st.id,
      talentId: st.talent_id,
      subject: st.subject,
      category: st.category,
      status: st.status,
      priority: st.priority,
      createdAt: st.created_at,
      lastActivity: 'Active'
    }));

    const supportMessages = (rSupportMessages.data || []).map((sm: any) => ({
      id: sm.id,
      ticketId: sm.ticket_id,
      senderName: sm.sender_name,
      senderRole: sm.sender_role,
      isSupport: sm.is_support,
      avatarUrl: sm.avatar_url,
      text: sm.text,
      timestamp: sm.timestamp,
      createdAt: sm.created_at
    }));

    // RESILIENT MERGE LAYER: Merge the local-only users, talents, organizations, clientRequests, and matches
    // to guarantee they show up on Admin & Client dashboard even if Supabase sync had lag or errors!
    const mergedUsers = [...users];
    for (const lu of localDb.users || []) {
      if (!mergedUsers.some(u => u.id === lu.id || u.email.toLowerCase() === lu.email.toLowerCase())) {
        mergedUsers.push(lu);
      }
    }

    const mergedTalents = [...talents];
    for (const lt of localDb.talents || []) {
      const idx = mergedTalents.findIndex(t => t.id === lt.id || t.email.toLowerCase() === lt.email.toLowerCase());
      if (idx > -1) {
        // Merge the onboarding telemetry properties from local JSON
        mergedTalents[idx] = {
          ...lt,
          ...mergedTalents[idx],
          // Ensure we merge the custom onboarding telemetry fields
          phone: mergedTalents[idx].phone || lt.phone,
          city: mergedTalents[idx].city || lt.city,
          country: mergedTalents[idx].country || lt.country,
          seniorityLevel: mergedTalents[idx].seniorityLevel || lt.seniorityLevel,
          employmentPreference: mergedTalents[idx].employmentPreference || lt.employmentPreference,
          currency: mergedTalents[idx].currency || lt.currency,
          hourlyMonthly: mergedTalents[idx].hourlyMonthly || lt.hourlyMonthly,
          portfolioUrl: mergedTalents[idx].portfolioUrl || lt.portfolioUrl,
          certifications: mergedTalents[idx].certifications || lt.certifications,
          internetQuality: mergedTalents[idx].internetQuality || lt.internetQuality,
          workSetup: mergedTalents[idx].workSetup || lt.workSetup,
          devices: mergedTalents[idx].devices || lt.devices,
          communicationTools: mergedTalents[idx].communicationTools || lt.communicationTools,
          dateOfBirth: mergedTalents[idx].dateOfBirth || lt.dateOfBirth,
          gender: mergedTalents[idx].gender || lt.gender,
          nationality: mergedTalents[idx].nationality || lt.nationality,
          maritalStatus: mergedTalents[idx].maritalStatus || lt.maritalStatus,
          nationalId: mergedTalents[idx].nationalId || lt.nationalId,
          passportNo: mergedTalents[idx].passportNo || lt.passportNo,
          address: mergedTalents[idx].address || lt.address,
          workExperience: mergedTalents[idx].workExperience || lt.workExperience
        };
      } else {
        mergedTalents.push(lt);
      }
    }

    const mergedOrgs = [...organizations];
    for (const lo of localDb.organizations || []) {
      if (!mergedOrgs.some(o => o.id === lo.id || o.name === lo.name)) {
        mergedOrgs.push(lo);
      }
    }

    const mergedClientProfiles = [...clientProfiles];
    for (const lcp of localDb.clientProfiles || []) {
      if (!mergedClientProfiles.some(cp => cp.id === lcp.id || cp.userId === lcp.userId)) {
        mergedClientProfiles.push(lcp);
      }
    }

    const mergedClientRequests = [...clientRequests];
    for (const lr of localDb.clientRequests || []) {
      if (!mergedClientRequests.some(r => r.id === lr.id)) {
        mergedClientRequests.push(lr);
      }
    }

    const mergedMatches = [...matches];
    for (const lm of localDb.matches || []) {
      if (!mergedMatches.some(m => m.id === lm.id)) {
        mergedMatches.push(lm);
      }
    }

    return {
      talents: mergedTalents,
      clientRequests: mergedClientRequests,
      matches: mergedMatches,
      tasks: tasks.length > 0 ? tasks : (localDb.tasks || []),
      contracts: contracts.length > 0 ? contracts : (localDb.contracts || []),
      notifications: notifications.length > 0 ? notifications : (localDb.notifications || []),
      auditLogs: auditLogs.length > 0 ? auditLogs : (localDb.auditLogs || []),
      agentLogs: agentLogs.length > 0 ? agentLogs : (localDb.agentLogs || []),
      users: mergedUsers,
      organizations: mergedOrgs,
      clientProfiles: mergedClientProfiles,
      skills: skills.length > 0 ? skills : (localDb.skills || []),
      talentSkills: talentSkills.length > 0 ? talentSkills : (localDb.talentSkills || []),
      documents: documents.length > 0 ? documents : (localDb.documents || []),
      projects: projects.length > 0 ? projects : (localDb.projects || []),
      assignments: assignments.length > 0 ? assignments : (localDb.assignments || []),
      invoices: invoices.length > 0 ? invoices : (localDb.invoices || []),
      payments: payments.length > 0 ? payments : (localDb.payments || []),
      talentPayouts: talentPayouts.length > 0 ? talentPayouts : (localDb.talentPayouts || []),
      messages: messages.length > 0 ? messages : (localDb.messages || []),
      roles: [],
      userRoles: [],
      supportTickets: supportTickets.length > 0 ? supportTickets : (localDb.supportTickets || []),
      supportMessages: supportMessages.length > 0 ? supportMessages : (localDb.supportMessages || []),
      interviews: localDb.interviews || [],
      rehireRequests: localDb.rehireRequests || []
    };

  } catch (err) {
    console.warn("Resilient read: error occurred while reading from Supabase. Falling back to local db.json baseline.", err);
    return localDb;
  }
}

export async function writeDbAsync(db: Schema): Promise<void> {
  // Mirror state locally to db.json for persistent offline/interviews support
  try {
    const currentDb = readDb();
    const mergedDb = { ...currentDb, ...db };
    writeDb(mergedDb);
  } catch (e) {
    console.error('Failed to write db.json in writeDbAsync:', e);
  }

  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultSupabaseAnonKey;
  if (!supabaseAnonKey) {
    console.warn("No Supabase Anon Key provided. Storing changes locally in db.json.");
    return;
  }

  try {
    const supabase = getSupabaseClient();
    
    if (db.users) {
      const rows = db.users.map((u: any) => ({
        id: u.id,
        email: u.email,
        password_hash: 'auth_managed',
        role: u.role,
        status: u.status || 'active',
        email_verified: u.emailVerified || false
      }));
      await supabase.from('users').upsert(rows);
    }
    
    if (db.organizations) {
      const rows = db.organizations.map((o: any) => ({
        id: o.id,
        name: o.name,
        created_by: o.created_by || null
      }));
      await supabase.from('organizations').upsert(rows);
    }
    
    if (db.clientProfiles) {
      const rows = db.clientProfiles.map((cp: any) => ({
        id: cp.id,
        user_id: cp.userId,
        organization_id: cp.organizationId,
        position: cp.position,
        phone: cp.phone || null
      }));
      await supabase.from('client_profiles').upsert(rows);
    }
    
    if (db.talents) {
      const rows = db.talents.map((t: any) => {
        const telemetryObj = {
          city: t.city || '',
          seniorityLevel: t.seniorityLevel || '',
          employmentPreference: t.employmentPreference || '',
          currency: t.currency || 'USD',
          hourlyMonthly: t.hourlyMonthly || 'Monthly',
          portfolioUrl: t.portfolioUrl || '',
          certifications: t.certifications || '',
          internetQuality: t.internetQuality || '',
          workSetup: t.workSetup || '',
          devices: t.devices || '',
          communicationTools: t.communicationTools || '',
          dateOfBirth: t.dateOfBirth || '',
          nationality: t.nationality || '',
          maritalStatus: t.maritalStatus || '',
          nationalId: t.nationalId || '',
          passportNo: t.passportNo || '',
          workExperience: t.workExperience || []
        };
        
        const bioText = `Tags: ${(t.tags || []).join(', ')}\n\nScores: ${JSON.stringify(t.vettingScores || {})}\n\nTelemetry: ${JSON.stringify(telemetryObj)}\n\nBio: ${t.bio || ''}`;
        const matchedUser = (db.users || []).find((u: any) => u.email.toLowerCase() === t.email.toLowerCase());
        const userId = matchedUser ? matchedUser.id : (t.userId || null);
        
        return {
          id: t.id,
          user_id: userId,
          full_name: t.name,
          phone: t.phone || null,
          country: t.country || 'Nigeria',
          address: t.address || null,
          gender: t.gender || null,
          level: t.title || 'Professional',
          availability_hours: t.availability || 40,
          salary_max: t.salaryExpectation || null,
          status: t.vettingStatus === 'Deployed' ? 'assigned' : 'active',
          timezone: t.timezone || 'GMT+1 (Lagos)',
          salary_expectation: t.salaryExpectation || null,
          experience_years: t.experienceYears || null,
          vetting_stage: t.vettingStage || 'Final Review',
          vetting_status: t.vettingStatus || 'Vetted',
          grade: t.grade || 'A',
          bio: bioText,
          avatar_url: t.avatar || null
        };
      });
      await supabase.from('talent_profiles').upsert(rows);
    }
    
    if (db.skills) {
      const rows = db.skills.map((s: any) => ({
        id: s.id,
        name: s.name
      }));
      await supabase.from('skills').upsert(rows);
    }
    
    if (db.talentSkills) {
      const rows = db.talentSkills.map((ts: any) => ({
        id: ts.id,
        talent_id: ts.talentId,
        skill_id: ts.skillId,
        level: ts.level || 'intermediate'
      }));
      await supabase.from('talent_skills').upsert(rows);
    }
    
    if (db.documents) {
      const rows = db.documents.map((doc: any) => ({
        id: doc.id,
        user_id: doc.userId || null,
        name: doc.name,
        type: doc.type || doc.category || 'Other',
        file_size: doc.fileSize || null,
        status: doc.status || 'uploaded',
        uploaded_at: doc.uploadedAt && !doc.uploadedAt.includes('ago') ? new Date(doc.uploadedAt).toISOString() : new Date().toISOString()
      }));
      await supabase.from('documents').upsert(rows);
    }
    
    if (db.clientRequests) {
      const rows = db.clientRequests.map((r: any) => {
        const descText = JSON.stringify({
          roleDescription: r.roleDescription,
          requiredSkills: r.requiredSkills || [],
          priority: r.priority || 'Medium',
          timezone: r.timezone || 'GMT+1',
          budget: r.budget || 0,
          clientName: r.clientName || 'Horizon Fintech'
        });
        
        return {
          id: r.id,
          client_id: r.clientId || null,
          service_type: r.serviceType || 'hire',
          title: `${r.serviceType || 'hire'} request`,
          description: descText,
          num_of_talents: r.numberOfHires || 1,
          duration: r.duration || null,
          start_date: r.startDate ? new Date(r.startDate).toISOString().split('T')[0] : null,
          commitment_level: r.commitmentLevel || null,
          status: r.status === 'New Request' ? 'new' : 'matching'
        };
      });
      await supabase.from('service_requests').upsert(rows);
    }
    
    if (db.matches) {
      const rows = db.matches.map((m: any) => ({
        id: m.id,
        request_id: m.requestId,
        talent_id: m.talentId,
        status: m.status === 'Interview Scheduled' || m.status === 'Offer Extended' ? 'proposed' : m.status.toLowerCase()
      }));
      await supabase.from('matches').upsert(rows);
    }
    
    if (db.projects) {
      const rows = db.projects.map((p: any) => ({
        id: p.id,
        client_id: p.clientId || null,
        name: p.name,
        description: p.description || null,
        start_date: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : null,
        end_date: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : null,
        status: p.status || 'active'
      }));
      await supabase.from('projects').upsert(rows);
    }
    
    if (db.tasks) {
      const rows = db.tasks.map((t: any) => ({
        id: t.id,
        project_id: t.projectId || null,
        assigned_to: t.assigneeId || null,
        title: t.title,
        description: t.description || null,
        status: t.status === 'In Progress' ? 'in_progress' : (t.status === 'Completed' ? 'done' : 'todo')
      }));
      await supabase.from('tasks').upsert(rows);
    }
    
    if (db.contracts) {
      const rows = db.contracts.map((c: any) => ({
        id: c.id,
        client_id: c.clientId || null,
        talent_id: c.talentId || null,
        service_type: c.role || null,
        start_date: null,
        end_date: null,
        status: c.status.toLowerCase() === 'signed' ? 'signed' : 'pending',
        rate_type: c.rateType || 'Monthly',
        rate_amount: c.rateAmount || c.salary || 0,
        total_earned: c.totalEarned || 0,
        invoiced_balance: c.invoicedBalance || 0,
        next_payout: c.nextPayout || 0,
        next_payout_date: null,
        engagement_model: c.engagementModel || null,
        signed_at: c.signedAt ? new Date(c.signedAt).toISOString() : null,
        rating: c.rating || null,
        quality_of_work: c.qualityOfWork || null,
        communication: c.communication || null,
        timeliness: c.timeliness || null
      }));
      await supabase.from('contracts').upsert(rows);
    }
    
    if (db.assignments) {
      const rows = db.assignments.map(a => ({
        id: a.id,
        talent_id: a.talentId,
        project_id: a.projectId,
        contract_id: a.contractId,
        role: a.role,
        status: a.status || 'active'
      }));
      await supabase.from('assignments').upsert(rows);
    }
    
    if (db.invoices) {
      const rows = db.invoices.map(inv => ({
        id: inv.id,
        client_id: inv.clientId,
        amount: inv.amount,
        status: inv.status || 'sent',
        due_date: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : null
      }));
      await supabase.from('invoices').upsert(rows);
    }
    
    if (db.payments) {
      const rows = db.payments.map(p => ({
        id: p.id,
        invoice_id: p.invoiceId,
        amount: p.amount,
        payment_method: p.paymentMethod || 'ACH Bank Wire',
        status: p.status || 'paid',
        paid_at: p.paidAt ? new Date(p.paidAt).toISOString() : new Date().toISOString()
      }));
      await supabase.from('payments').upsert(rows);
    }
    
    if (db.talentPayouts) {
      const rows = db.talentPayouts.map(tp => ({
        id: tp.id,
        talent_id: tp.talentId,
        contract_id: tp.contractId,
        amount: tp.amount,
        status: tp.status || 'paid',
        paid_at: tp.paidAt ? new Date(tp.paidAt).toISOString() : new Date().toISOString()
      }));
      await supabase.from('talent_payouts').upsert(rows);
    }
    
    if (db.messages) {
      const rows = db.messages.map(msg => ({
        id: msg.id,
        sender_id: msg.senderId,
        receiver_id: msg.receiverId,
        content: msg.content,
        read_status: msg.readStatus || false,
        timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString()
      }));
      await supabase.from('messages').upsert(rows);
    }
    
    if (db.notifications) {
      const rows = db.notifications.map(n => ({
        id: n.id,
        user_id: n.userId,
        title: n.title,
        message: n.message,
        read: n.read || false,
        created_at: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString()
      }));
      await supabase.from('notifications').upsert(rows);
    }
    
    if (db.auditLogs) {
      const rows = db.auditLogs.map(al => ({
        id: al.id,
        actor: al.actor,
        action: al.action,
        details: al.details,
        timestamp: al.timestamp ? new Date(al.timestamp).toISOString() : new Date().toISOString()
      }));
      await supabase.from('audit_logs').upsert(rows);
    }
    
    if (db.agentLogs) {
      const rows = db.agentLogs.map(ag => ({
        id: ag.id,
        agent_name: ag.agentName,
        message: ag.message,
        timestamp: ag.timestamp || new Date().toLocaleTimeString(),
        type: ag.type || 'info'
      }));
      await supabase.from('agent_logs').upsert(rows);
    }
    
    if (db.supportTickets) {
      const rows = db.supportTickets.map(t => ({
        id: t.id,
        talent_id: t.talentId,
        subject: t.subject,
        category: t.category,
        status: t.status || 'Open',
        priority: t.priority || 'Medium',
        created_at: t.createdAt && !t.createdAt.includes('ago') ? new Date(t.createdAt).toISOString() : new Date().toISOString()
      }));
      await supabase.from('support_tickets').upsert(rows);
    }
    
    if (db.supportMessages) {
      const rows = db.supportMessages.map(m => ({
        id: m.id,
        ticket_id: m.ticketId,
        sender_name: m.senderName,
        sender_role: m.senderRole,
        is_support: m.isSupport || false,
        avatar_url: m.avatarUrl || null,
        text: m.text,
        timestamp: m.timestamp || new Date().toLocaleTimeString(),
        created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString()
      }));
      await supabase.from('support_messages').upsert(rows);
    }
  } catch (err) {
    console.error("Resilient write: failed to sync changes to Supabase.", err);
  }
}

