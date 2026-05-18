import { 
  TalentProfile, ServiceRequest, Match, Task, Contract, Notification, AuditLog, AgentLog
} from '@kongila/shared-types';
import * as fs from 'fs';
import * as path from 'path';

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
    bio: 'Elite developer specializing in React and distributed Node.js backends. Passionate about writing scalable, clean code.'
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
    bio: 'Visual designer dedicated to creating beautiful, human-centered web and mobile experiences.'
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
}

// In-Memory Fallback
let inMemoryDb: Schema = {
  talents: DEFAULT_TALENTS,
  clientRequests: [],
  matches: [],
  tasks: [],
  contracts: [],
  notifications: [],
  auditLogs: [],
  agentLogs: INITIAL_AGENT_LOGS
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
