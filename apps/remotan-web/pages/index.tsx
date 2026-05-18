import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { GlassCard, Badge, NeonButton, AgentBadge } from '@kongila/ui';
import { formatDate } from '@kongila/utils';
import { 
  TalentProfile, Task, TaskStatus, AgentLog
} from '@kongila/shared-types';

export default function RemotanWeb() {
  // DB States
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);

  // UI Navigation
  const [activeTab, setActiveTab] = useState<'board' | 'timer' | 'performance'>('board');
  const [selectedTalentId, setSelectedTalentId] = useState<string>('talent_chidi');

  // Time Tracker Simulator State
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockTime, setClockTime] = useState('00:00:00');
  const [timeLogs, setTimeLogs] = useState<{ time: string; action: string }[]>([]);
  const [activityLogs, setActivityLogs] = useState<{ time: string; app: string; score: number }[]>([
    { time: '11:15', app: 'VS Code (index.tsx)', score: 95 },
    { time: '11:00', app: 'Figma (Design System)', score: 88 },
    { time: '10:45', app: 'Chrome (MDN Web Docs)', score: 90 }
  ]);

  // Modals & Blockers
  const [showAddTask, setShowAddTask] = useState(false);
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [activeTaskForBlocker, setActiveTaskForBlocker] = useState<Task | null>(null);
  const [blockerText, setBlockerText] = useState('');
  
  // Custom Task Input State
  const [newTaskData, setNewTaskData] = useState({
    title: 'Refactor Auth middleware routes',
    description: 'Ensure EOR role restrictions isolate Admin access from Client requests.',
    priority: 'Medium' as 'Low' | 'Medium' | 'High'
  });

  // Automated Alerts
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Sync filesystem DB
  const syncFromDb = async () => {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const dbData = await res.json();
        setTalents(dbData.talents || []);
        setTasks(dbData.tasks || []);
        setAgentLogs(dbData.agentLogs || []);
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
    const interval = setInterval(syncFromDb, 3000);
    return () => clearInterval(interval);
  }, []);

  // Timer Tick Simulation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isClockedIn) {
      let seconds = 0;
      let minutes = 0;
      let hours = 0;
      timer = setInterval(() => {
        seconds++;
        if (seconds >= 60) {
          seconds = 0;
          minutes++;
          if (minutes >= 60) {
            minutes = 0;
            hours++;
          }
        }
        setClockTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isClockedIn]);

  const handleClockToggle = async () => {
    const action = isClockedIn ? 'Clocked Out' : 'Clocked In';
    setIsClockedIn(!isClockedIn);
    
    const newLog = {
      time: new Date().toLocaleTimeString(),
      action
    };
    setTimeLogs([newLog, ...timeLogs]);

    const activeTalent = talents.find(t => t.id === selectedTalentId);
    if (!activeTalent) return;

    // Log to Agent Console
    const logMsg = `${activeTalent.name} registered attendance trigger: ${action}. Time card active.`;
    const newAgentLog: AgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Compliance Agent',
      message: logMsg,
      timestamp: new Date().toLocaleTimeString(),
      type: isClockedIn ? 'warning' : 'success'
    };

    const updatedDb = {
      talents,
      clientRequests: [],
      matches: [],
      tasks,
      contracts: [],
      notifications: [],
      auditLogs: [],
      agentLogs: [newAgentLog, ...agentLogs]
    };

    setAgentLogs([newAgentLog, ...agentLogs]);
    await saveToDb(updatedDb);
  };

  // Idle Alert Simulator
  const triggerIdleAlert = () => {
    setAlertMessage('WARNING: Idle status detected (No keyboard / mouse input for 10 minutes).');
    
    // Add agent logs
    const newAgentLog: AgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Performance Agent',
      message: `Idle state triggered for ${talents.find(t=>t.id===selectedTalentId)?.name || 'Chidi Anya'}. Ping dispatched to workstation.`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'warning'
    };

    const updatedDb = {
      talents,
      clientRequests: [],
      matches: [],
      tasks,
      contracts: [],
      notifications: [],
      auditLogs: [],
      agentLogs: [newAgentLog, ...agentLogs]
    };

    setAgentLogs([newAgentLog, ...agentLogs]);
    saveToDb(updatedDb);

    setTimeout(() => {
      setAlertMessage(null);
    }, 6000);
  };

  // Add Custom Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeTalent = talents.find(t => t.id === selectedTalentId);
    if (!activeTalent) return;

    const newTask: Task = {
      id: `task_${Date.now()}`,
      projectId: 'project_general',
      projectName: 'Main Workspace',
      title: newTaskData.title,
      description: newTaskData.description,
      assigneeId: activeTalent.id,
      assigneeName: activeTalent.name,
      status: 'Not Started',
      priority: newTaskData.priority,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    const updatedTasks = [...tasks, newTask];

    const newAgentLog: AgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Execution Agent',
      message: `New task deployed to Kanban board for ${activeTalent.name}: "${newTaskData.title}"`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'info'
    };

    const updatedDb = {
      talents,
      clientRequests: [],
      matches: [],
      tasks: updatedTasks,
      contracts: [],
      notifications: [],
      auditLogs: [],
      agentLogs: [newAgentLog, ...agentLogs]
    };

    setTasks(updatedTasks);
    setAgentLogs([newAgentLog, ...agentLogs]);
    await saveToDb(updatedDb);

    setShowAddTask(false);
  };

  // Update Task State
  const handleTaskStateChange = async (taskId: string, newStatus: TaskStatus) => {
    if (newStatus === 'Blocked') {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setActiveTaskForBlocker(task);
        setShowBlockerModal(true);
      }
      return;
    }

    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, status: newStatus, blockerDescription: undefined } : t
    );

    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    let logMsg = `Task "${targetTask.title}" transitioned to: ${newStatus}`;
    let logType: AgentLog['type'] = 'info';

    if (newStatus === 'Completed') {
      logMsg = `Task "${targetTask.title}" completed by ${targetTask.assigneeName}. Performance log scored.`;
      logType = 'success';
    }

    const newAgentLog: AgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Execution Agent',
      message: logMsg,
      timestamp: new Date().toLocaleTimeString(),
      type: logType
    };

    const updatedDb = {
      talents,
      clientRequests: [],
      matches: [],
      tasks: updatedTasks,
      contracts: [],
      notifications: [],
      auditLogs: [],
      agentLogs: [newAgentLog, ...agentLogs]
    };

    setTasks(updatedTasks);
    setAgentLogs([newAgentLog, ...agentLogs]);
    await saveToDb(updatedDb);
  };

  // Block Task Submit
  const handleBlockerSubmit = async () => {
    if (!activeTaskForBlocker) return;

    const updatedTasks = tasks.map(t => 
      t.id === activeTaskForBlocker.id 
        ? { ...t, status: 'Blocked' as const, blockerDescription: blockerText } 
        : t
    );

    setAlertMessage(`BLOCKER ESCALATED: Blocker flagged on "${activeTaskForBlocker.title}"`);

    const newAgentLog: AgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Execution Agent',
      message: `CRITICAL BLOCKER on "${activeTaskForBlocker.title}": "${blockerText}". Escalating support ticket.`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'error'
    };

    const updatedDb = {
      talents,
      clientRequests: [],
      matches: [],
      tasks: updatedTasks,
      contracts: [],
      notifications: [
        {
          id: `notif_${Date.now()}`,
          userId: 'user_client_1', // Notifies client
          title: 'Contractor Blocked',
          message: `${activeTaskForBlocker.assigneeName} flagged a blocker: "${blockerText}"`,
          read: false,
          createdAt: new Date().toISOString()
        }
      ],
      auditLogs: [],
      agentLogs: [newAgentLog, ...agentLogs]
    };

    setTasks(updatedTasks);
    setAgentLogs([newAgentLog, ...agentLogs]);
    await saveToDb(updatedDb);

    setShowBlockerModal(false);
    setBlockerText('');
    
    setTimeout(() => {
      setAlertMessage(null);
    }, 6000);
  };

  // Simulate Productivity Dip (PIP Trigger)
  const triggerPIPDip = async () => {
    setAlertMessage('CRITICAL ALERT: Productivity dip detected (Average Efficiency 58%). Auto-triggering PIP Program.');

    const updatedTalents = talents.map(t => 
      t.id === selectedTalentId 
        ? { ...t, vettingScores: { ...t.vettingScores, workSimulation: 58 } } // Lowers efficiency simulation score
        : t
    );

    const activeTalent = talents.find(t => t.id === selectedTalentId);
    if (!activeTalent) return;

    // Dispatch logs
    const newAgentLog: AgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Performance Agent',
      message: `Productivity check: ${activeTalent.name}'s task efficiency slipped to 58%. Warning issued.`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'error'
    };

    const pipLog: AgentLog = {
      id: `alog_pip_${Date.now()}`,
      agentName: 'Workflow Agent',
      message: `Automated Performance Improvement Plan (PIP) locked. Initializing weekly milestone checks.`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'warning'
    };

    const updatedDb = {
      talents: updatedTalents,
      clientRequests: [],
      matches: [],
      tasks,
      contracts: [],
      notifications: [],
      auditLogs: [],
      agentLogs: [pipLog, newAgentLog, ...agentLogs]
    };

    setTalents(updatedTalents);
    setAgentLogs([pipLog, newAgentLog, ...agentLogs]);
    await saveToDb(updatedDb);

    setTimeout(() => {
      setAlertMessage(null);
    }, 6000);
  };

  const getTasksForStatus = (status: TaskStatus) => {
    return tasks.filter(t => t.assigneeId === selectedTalentId && t.status === status);
  };

  const getActiveTalent = () => {
    return talents.find(t => t.id === selectedTalentId) || talents[0];
  };

  return (
    <div className="app-shell">
      <Head>
        <title>Remotan Work OS — Delivery & Execution Management</title>
        <meta name="description" content="Subscription operational execution system for monitoring remote teams." />
      </Head>


      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <span>◆</span> Remotan OS
        </div>
        
        <div className="sidebar-menu">
          <div 
            className={`menu-item ${activeTab === 'board' ? 'active' : ''}`}
            onClick={() => setActiveTab('board')}
          >
            <span>📋</span> Kanban Workspace
          </div>
          <div 
            className={`menu-item ${activeTab === 'timer' ? 'active' : ''}`}
            onClick={() => setActiveTab('timer')}
          >
            <span>⏱️</span> Work Tracker Time
          </div>
          <div 
            className={`menu-item ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveTab('performance')}
          >
            <span>📈</span> Performance & PIP
          </div>
        </div>

        <div className="sidebar-footer">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SELECT ACTIVE TALENT PERSPECTIVE:</div>
          <select 
            className="form-select" 
            style={{ fontSize: '12px', padding: '6px 10px', marginTop: '6px' }}
            value={selectedTalentId}
            onChange={e => setSelectedTalentId(e.target.value)}
          >
            {talents.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.title.split(' ')[0]})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Floating alerts */}
        {alertMessage && (
          <div className="floating-alert">
            <span className="alert-icon">⚠️</span>
            <div style={{ fontSize: '13px' }}>{alertMessage}</div>
          </div>
        )}

        <div className="page-header">
          <div>
            <h1 className="page-title">Operational Workspace: {getActiveTalent()?.name}</h1>
            <p className="page-subtitle">{getActiveTalent()?.title} • Active EOR deployment</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <NeonButton variant="secondary" onClick={() => setShowAddTask(true)}>Create Task Card</NeonButton>
            <NeonButton 
              variant={isClockedIn ? 'danger' : 'primary'}
              onClick={handleClockToggle}
            >
              {isClockedIn ? `Clock Out [${clockTime}]` : 'Clock In for work'}
            </NeonButton>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr', gap: '32px', marginBottom: '32px' }}>
          {/* Main workspace */}
          <div>
            {/* Board View */}
            {activeTab === 'board' && (
              <div>
                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Task Execution Board</h2>
                <div className="kanban-board">
                  {/* Column Not Started */}
                  <div className="kanban-column">
                    <div className="column-header">
                      <span className="column-title">Not Started</span>
                      <span className="column-count">{getTasksForStatus('Not Started').length}</span>
                    </div>
                    <div className="kanban-cards">
                      {getTasksForStatus('Not Started').map(task => (
                        <div key={task.id} className="task-card">
                          <span className={`task-priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                          <h4 style={{ fontSize: '13px', marginBottom: '6px' }}>{task.title}</h4>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{task.description}</p>
                          <select 
                            className="form-select" 
                            style={{ padding: '4px', fontSize: '11px' }}
                            value={task.status}
                            onChange={e => handleTaskStateChange(task.id, e.target.value as any)}
                          >
                            <option value="Not Started">Not Started</option>
                            <option value="In Progress">Move to Progress</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column In Progress */}
                  <div className="kanban-column">
                    <div className="column-header">
                      <span className="column-title">In Progress</span>
                      <span className="column-count">{getTasksForStatus('In Progress').length}</span>
                    </div>
                    <div className="kanban-cards">
                      {getTasksForStatus('In Progress').map(task => (
                        <div key={task.id} className="task-card">
                          <span className={`task-priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                          <h4 style={{ fontSize: '13px', marginBottom: '6px' }}>{task.title}</h4>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{task.description}</p>
                          <select 
                            className="form-select" 
                            style={{ padding: '4px', fontSize: '11px' }}
                            value={task.status}
                            onChange={e => handleTaskStateChange(task.id, e.target.value as any)}
                          >
                            <option value="In Progress">In Progress</option>
                            <option value="Blocked">Flag Blocker ⚠️</option>
                            <option value="Under Review">Submit for Review</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column Blocked */}
                  <div className="kanban-column">
                    <div className="column-header">
                      <span className="column-title" style={{ color: 'var(--accent-magenta)' }}>Blocked</span>
                      <span className="column-count">{getTasksForStatus('Blocked').length}</span>
                    </div>
                    <div className="kanban-cards">
                      {getTasksForStatus('Blocked').map(task => (
                        <div key={task.id} className="task-card blocked">
                          <span className="task-priority priority-high">Blocked</span>
                          <h4 style={{ fontSize: '13px', marginBottom: '6px' }}>{task.title}</h4>
                          <div style={{ background: 'rgba(255,0,127,0.04)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,0,127,0.1)', fontSize: '10px', color: 'var(--accent-magenta)', marginBottom: '10px' }}>
                            <strong>Blocker:</strong> {task.blockerDescription}
                          </div>
                          <select 
                            className="form-select" 
                            style={{ padding: '4px', fontSize: '11px' }}
                            value={task.status}
                            onChange={e => handleTaskStateChange(task.id, e.target.value as any)}
                          >
                            <option value="Blocked">Blocked</option>
                            <option value="In Progress">Resolve Blocker</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column Under Review */}
                  <div className="kanban-column">
                    <div className="column-header">
                      <span className="column-title">Under Review</span>
                      <span className="column-count">{getTasksForStatus('Under Review').length}</span>
                    </div>
                    <div className="kanban-cards">
                      {getTasksForStatus('Under Review').map(task => (
                        <div key={task.id} className="task-card">
                          <span className={`task-priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                          <h4 style={{ fontSize: '13px', marginBottom: '6px' }}>{task.title}</h4>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{task.description}</p>
                          <select 
                            className="form-select" 
                            style={{ padding: '4px', fontSize: '11px' }}
                            value={task.status}
                            onChange={e => handleTaskStateChange(task.id, e.target.value as any)}
                          >
                            <option value="Under Review">Under Review</option>
                            <option value="Completed">Approve & Complete</option>
                            <option value="In Progress">Request changes</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column Completed */}
                  <div className="kanban-column">
                    <div className="column-header">
                      <span className="column-title" style={{ color: 'var(--accent-green)' }}>Completed</span>
                      <span className="column-count">{getTasksForStatus('Completed').length}</span>
                    </div>
                    <div className="kanban-cards">
                      {getTasksForStatus('Completed').map(task => (
                        <div key={task.id} className="task-card" style={{ opacity: 0.7, borderLeft: '3px solid var(--accent-green)' }}>
                          <span className="task-priority" style={{ color: 'var(--accent-green)' }}>Completed</span>
                          <h4 style={{ fontSize: '13px', marginBottom: '4px', textDecoration: 'line-through' }}>{task.title}</h4>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Closed: {formatDate(task.dueDate)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Time Tracking View */}
            {activeTab === 'timer' && (
              <div>
                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Time & Attendance Tracking</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                  <GlassCard style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      WORKSTATION TRACKING SESSION
                    </div>
                    <div style={{ 
                      fontSize: '54px', 
                      fontFamily: 'monospace', 
                      fontWeight: 800, 
                      margin: '24px 0', 
                      color: isClockedIn ? 'var(--accent-green)' : 'var(--text-muted)',
                      textShadow: isClockedIn ? '0 0 20px var(--accent-green-glow)' : 'none'
                    }}>
                      {clockTime}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '32px' }}>
                      Attendance logs and screenshot triggers sync directly to EOR Compliance logs.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                      <NeonButton 
                        variant={isClockedIn ? 'danger' : 'primary'}
                        onClick={handleClockToggle}
                      >
                        {isClockedIn ? 'Clock Out' : 'Clock In Session'}
                      </NeonButton>
                      <NeonButton variant="secondary" onClick={triggerIdleAlert}>
                        Simulate Idle State
                      </NeonButton>
                    </div>
                  </GlassCard>

                  <GlassCard>
                    <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Workstation Screenshot Log (Simulated)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {activityLogs.map((act, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700 }}>{act.app}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Captured at: {act.time} AM • Focus checked</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-cyan)' }}>{act.score}% Activity</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}

            {/* Performance View */}
            {activeTab === 'performance' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px' }}>Productivity Scorecard</h2>
                  <NeonButton variant="danger" onClick={triggerPIPDip}>Simulate Productivity Dip</NeonButton>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
                  <GlassCard>
                    <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Scorecard Gauges</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                          <span>Workspace Task Efficiency</span>
                          <span style={{ fontWeight: 700, color: getActiveTalent()?.vettingScores.workSimulation < 65 ? 'var(--accent-magenta)' : '#fff' }}>
                            {getActiveTalent()?.vettingScores.workSimulation}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                          <div style={{ 
                            width: `${getActiveTalent()?.vettingScores.workSimulation}%`, 
                            height: '100%', 
                            background: getActiveTalent()?.vettingScores.workSimulation < 65 ? 'var(--accent-magenta)' : 'var(--accent-green)', 
                            borderRadius: '4px' 
                          }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                          <span>Technical Work Quality</span>
                          <span>{getActiveTalent()?.vettingScores.technical}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                          <div style={{ width: `${getActiveTalent()?.vettingScores.technical}%`, height: '100%', background: 'var(--accent-cyan)', borderRadius: '4px' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                          <span>Reliability Index</span>
                          <span>{getActiveTalent()?.vettingScores.behavioral}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                          <div style={{ width: `${getActiveTalent()?.vettingScores.behavioral}%`, height: '100%', background: 'var(--accent-gold)', borderRadius: '4px' }} />
                        </div>
                      </div>
                    </div>

                    {getActiveTalent()?.vettingScores.workSimulation < 65 && (
                      <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255, 0, 127, 0.1)', border: '1px solid var(--accent-magenta)', borderRadius: '10px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--accent-magenta)', fontWeight: 700 }}>⚠️ PIP ACTIVE PROGRAM:</span> This contractor is currently placed on an automated Performance Improvement Plan. Goals are reviewed weekly.
                      </div>
                    )}
                  </GlassCard>

                  <GlassCard>
                    <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Review Cycles</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <div><strong>Active Cycle:</strong> Weekly Operational Review</div>
                      <div><strong>Next Evaluation:</strong> Friday (May 22, 2026)</div>
                      <div><strong>Reviewers:</strong> Platform Team Lead, Client Sponsor</div>
                      <hr style={{ borderColor: 'var(--border-glass)' }} />
                      <div><strong>PIP Auto-Trigger Rules:</strong> Slip below 65% efficiency triggers warning logs. 30-day goals set.</div>
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}
          </div>

          {/* Right hand Agent console feed */}
          <div>
            <div className="agent-terminal">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <div className="dot dot-red" />
                  <div className="dot dot-yellow" />
                  <div className="dot dot-green" />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>REMOTAN AGENT TIMELINE LOGS</div>
              </div>
              <div className="terminal-body">
                {agentLogs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '40px' }}>
                    Awaiting agent log triggers...
                  </div>
                ) : (
                  agentLogs.map((log) => (
                    <div key={log.id} className="log-entry">
                      <span className="log-time">[{log.timestamp}]</span>
                      <div style={{ flexGrow: 1 }}>
                        <AgentBadge name={log.agentName} />
                        <span className={`log-text log-${log.type}`} style={{ marginLeft: '8px', fontSize: '12px' }}>
                          {log.message}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px', padding: '24px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Create Project Task Card</h2>
            <form onSubmit={handleAddTask}>
              <div className="form-group">
                <label className="form-label">Task Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newTaskData.title}
                  onChange={e => setNewTaskData({ ...newTaskData, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Task Description</label>
                <textarea 
                  className="form-textarea" 
                  rows={3}
                  value={newTaskData.description}
                  onChange={e => setNewTaskData({ ...newTaskData, description: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select 
                  className="form-select"
                  value={newTaskData.priority}
                  onChange={e => setNewTaskData({ ...newTaskData, priority: e.target.value as any })}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <NeonButton variant="ghost" type="button" onClick={() => setShowAddTask(false)}>Cancel</NeonButton>
                <NeonButton type="submit">Create Card</NeonButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blocker Modal */}
      {showBlockerModal && activeTaskForBlocker && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px', padding: '24px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '16px', color: 'var(--accent-magenta)' }}>Flag Blocker & Escalate</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              You are flagging <strong>"{activeTaskForBlocker.title}"</strong> as Blocked. This action will notify the client and trigger the Execution Agent support ticket.
            </p>

            <div className="form-group">
              <label className="form-label">Provide Blocker Details</label>
              <textarea 
                className="form-textarea" 
                rows={3}
                placeholder="Explain what is delaying task progress (e.g., API keys missing, access permissions error)..."
                value={blockerText}
                onChange={e => setBlockerText(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <NeonButton variant="ghost" onClick={() => setShowBlockerModal(false)}>Cancel</NeonButton>
              <NeonButton variant="danger" onClick={handleBlockerSubmit}>Flag and Escalate Alert</NeonButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
