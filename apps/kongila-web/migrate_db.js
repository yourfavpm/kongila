const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const dbPath = '/Users/oluwadammilola/benita/kongila/db.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

function getClientUserId(orgOrUserId) {
  if (!orgOrUserId) return null;
  if (orgOrUserId.startsWith('usr_') || orgOrUserId.startsWith('user_')) {
    return orgOrUserId;
  }
  const cp = (db.clientProfiles || []).find(profile => profile.organizationId === orgOrUserId || profile.id === orgOrUserId);
  if (cp) return cp.userId;
  return 'usr_horizon'; // Default fallback client user ID
}

async function migrate() {
  console.log('Starting migration to Supabase...');

  // 1. Users
  console.log('Migrating users...');
  for (const u of db.users || []) {
    const { error } = await supabase.from('users').upsert({
      id: u.id,
      email: u.email,
      password_hash: 'auth_managed',
      role: u.role,
      status: 'active',
      email_verified: true
    });
    if (error) console.error('Error user:', u.id, error.message);
  }

  // 2. Organizations
  console.log('Migrating organizations...');
  for (const o of db.organizations || []) {
    const { error } = await supabase.from('organizations').upsert({
      id: o.id,
      name: o.name,
      created_by: o.created_by || null
    });
    if (error) console.error('Error org:', o.id, error.message);
  }

  // 3. Client Profiles
  console.log('Migrating client profiles...');
  for (const cp of db.clientProfiles || []) {
    const { error } = await supabase.from('client_profiles').upsert({
      id: cp.id,
      user_id: cp.userId,
      organization_id: cp.organizationId,
      position: cp.position,
      phone: cp.phone || null
    });
    if (error) console.error('Error client profile:', cp.id, error.message);
  }

  // 4. Talent Profiles
  console.log('Migrating talent profiles...');
  for (const t of db.talents || []) {
    const bioText = `Tags: ${(t.tags || []).join(', ')}\n\nScores: ${JSON.stringify(t.vettingScores || {})}\n\nBio: ${t.bio || ''}`;
    
    // Find associated user record if any (match by email)
    const matchedUser = (db.users || []).find(u => u.email.toLowerCase() === t.email.toLowerCase());
    const userId = matchedUser ? matchedUser.id : null;

    const { error } = await supabase.from('talent_profiles').upsert({
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
    });
    if (error) console.error('Error talent profile:', t.id, error.message);
  }

  // 5. Skills
  console.log('Migrating skills...');
  for (const s of db.skills || []) {
    const { error } = await supabase.from('skills').upsert({
      id: s.id,
      name: s.name
    });
    if (error) console.error('Error skill:', s.id, error.message);
  }

  // 6. Talent Skills
  console.log('Migrating talent skills...');
  for (const ts of db.talentSkills || []) {
    const { error } = await supabase.from('talent_skills').upsert({
      id: ts.id,
      talent_id: ts.talentId,
      skill_id: ts.skillId,
      level: ts.level || 'intermediate'
    });
    if (error) console.error('Error talent skill:', ts.id, error.message);
  }

  // 7. Documents
  console.log('Migrating documents...');
  for (const doc of db.documents || []) {
    const { error } = await supabase.from('documents').upsert({
      id: doc.id,
      user_id: doc.userId || null,
      name: doc.name,
      type: doc.type || doc.category || 'Other',
      file_size: doc.fileSize || null,
      status: doc.status || 'uploaded',
      uploaded_at: doc.uploadedAt && !doc.uploadedAt.includes('ago') ? new Date(doc.uploadedAt).toISOString() : new Date().toISOString()
    });
    if (error) console.error('Error document:', doc.id, error.message);
  }

  // 8. Service Requests
  console.log('Migrating service requests...');
  for (const r of db.clientRequests || []) {
    const descText = JSON.stringify({
      roleDescription: r.roleDescription,
      requiredSkills: r.requiredSkills || [],
      priority: r.priority || 'Medium',
      timezone: r.timezone || 'GMT+1',
      budget: r.budget || 0,
      clientName: r.clientName || 'Horizon Fintech'
    });

    const { error } = await supabase.from('service_requests').upsert({
      id: r.id,
      client_id: getClientUserId(r.clientId),
      service_type: r.serviceType || 'hire',
      title: `${r.serviceType || 'hire'} request`,
      description: descText,
      num_of_talents: r.numberOfHires || 1,
      duration: r.duration || null,
      start_date: r.startDate ? new Date(r.startDate).toISOString().split('T')[0] : null,
      commitment_level: r.commitmentLevel || null,
      status: r.status === 'New Request' ? 'new' : 'matching'
    });
    if (error) console.error('Error service request:', r.id, error.message);
  }

  // 9. Matches
  console.log('Migrating matches...');
  for (const m of db.matches || []) {
    const { error } = await supabase.from('matches').upsert({
      id: m.id,
      request_id: m.requestId,
      talent_id: m.talentId,
      status: m.status === 'Interview Scheduled' || m.status === 'Offer Extended' ? 'proposed' : m.status.toLowerCase()
    });
    if (error) console.error('Error match:', m.id, error.message);
  }

  // 10. Projects
  console.log('Migrating projects...');
  for (const p of db.projects || []) {
    const { error } = await supabase.from('projects').upsert({
      id: p.id,
      client_id: getClientUserId(p.clientId),
      name: p.name,
      description: p.description || null,
      start_date: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : null,
      end_date: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : null,
      status: p.status || 'active'
    });
    if (error) console.error('Error project:', p.id, error.message);
  }

  // 11. Tasks
  console.log('Migrating tasks...');
  for (const t of db.tasks || []) {
    const { error } = await supabase.from('tasks').upsert({
      id: t.id,
      project_id: t.projectId || null,
      assigned_to: t.assigneeId || null,
      title: t.title,
      description: t.description || null,
      status: t.status === 'In Progress' ? 'in_progress' : (t.status === 'Completed' ? 'done' : 'todo')
    });
    if (error) console.error('Error task:', t.id, error.message);
  }

  // 12. Contracts
  console.log('Migrating contracts...');
  for (const c of db.contracts || []) {
    const { error } = await supabase.from('contracts').upsert({
      id: c.id,
      client_id: getClientUserId(c.clientId),
      talent_id: c.talentId || null,
      service_type: c.role || null,
      start_date: null, // to match date format or default
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
    });
    if (error) console.error('Error contract:', c.id, error.message);
  }

  // 13. Assignments
  console.log('Migrating assignments...');
  for (const a of db.assignments || []) {
    const { error } = await supabase.from('assignments').upsert({
      id: a.id,
      talent_id: a.talentId,
      project_id: a.projectId,
      contract_id: a.contractId,
      role: a.role,
      status: a.status || 'active'
    });
    if (error) console.error('Error assignment:', a.id, error.message);
  }

  // 14. Invoices
  console.log('Migrating invoices...');
  for (const inv of db.invoices || []) {
    const { error } = await supabase.from('invoices').upsert({
      id: inv.id,
      client_id: getClientUserId(inv.clientId),
      amount: inv.amount,
      status: inv.status || 'sent',
      due_date: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : null
    });
    if (error) console.error('Error invoice:', inv.id, error.message);
  }

  // 15. Payments
  console.log('Migrating payments...');
  for (const p of db.payments || []) {
    const { error } = await supabase.from('payments').upsert({
      id: p.id,
      invoice_id: p.invoiceId,
      amount: p.amount,
      payment_method: p.paymentMethod || 'ACH Bank Wire',
      status: p.status || 'paid',
      paid_at: p.paidAt ? new Date(p.paidAt).toISOString() : new Date().toISOString()
    });
    if (error) console.error('Error payment:', p.id, error.message);
  }

  // 16. Talent Payouts
  console.log('Migrating talent payouts...');
  for (const tp of db.talentPayouts || []) {
    const { error } = await supabase.from('talent_payouts').upsert({
      id: tp.id,
      talent_id: tp.talentId,
      contract_id: tp.contractId,
      amount: tp.amount,
      status: tp.status || 'paid',
      paid_at: tp.paidAt ? new Date(tp.paidAt).toISOString() : new Date().toISOString()
    });
    if (error) console.error('Error payout:', tp.id, error.message);
  }

  // 17. Messages
  console.log('Migrating messages...');
  for (const msg of db.messages || []) {
    const { error } = await supabase.from('messages').upsert({
      id: msg.id,
      sender_id: msg.senderId,
      receiver_id: msg.receiverId,
      content: msg.content,
      read_status: msg.readStatus || false,
      timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString()
    });
    if (error) console.error('Error message:', msg.id, error.message);
  }

  // 18. Notifications
  console.log('Migrating notifications...');
  for (const n of db.notifications || []) {
    const { error } = await supabase.from('notifications').upsert({
      id: n.id,
      user_id: n.userId,
      title: n.title,
      message: n.message,
      read: n.read || false,
      created_at: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString()
    });
    if (error) console.error('Error notification:', n.id, error.message);
  }

  // 19. Audit Logs
  console.log('Migrating audit logs...');
  for (const al of db.auditLogs || []) {
    const { error } = await supabase.from('audit_logs').upsert({
      id: al.id,
      actor: al.actor,
      action: al.action,
      details: al.details,
      timestamp: al.timestamp ? new Date(al.timestamp).toISOString() : new Date().toISOString()
    });
    if (error) console.error('Error audit log:', al.id, error.message);
  }

  // 20. Agent Logs
  console.log('Migrating agent logs...');
  for (const ag of db.agentLogs || []) {
    const { error } = await supabase.from('agent_logs').upsert({
      id: ag.id,
      agent_name: ag.agentName,
      message: ag.message,
      timestamp: ag.timestamp && !ag.timestamp.includes(':') ? new Date(ag.timestamp).toISOString() : new Date().toISOString(),
      type: ag.type || 'info'
    });
    if (error) console.error('Error agent log:', ag.id, error.message);
  }

  // 21. Support Tickets
  console.log('Migrating support tickets...');
  for (const t of db.supportTickets || []) {
    const { error } = await supabase.from('support_tickets').upsert({
      id: t.id,
      talent_id: t.talentId,
      subject: t.subject,
      category: t.category,
      status: t.status || 'Open',
      priority: t.priority || 'Medium',
      created_at: t.createdAt && !t.createdAt.includes('ago') ? new Date(t.createdAt).toISOString() : new Date().toISOString()
    });
    if (error) console.error('Error ticket:', t.id, error.message);
  }

  // 22. Support Messages
  console.log('Migrating support messages...');
  for (const m of db.supportMessages || []) {
    const { error } = await supabase.from('support_messages').upsert({
      id: m.id,
      ticket_id: m.ticketId,
      sender_name: m.senderName,
      sender_role: m.senderRole,
      is_support: m.isSupport || false,
      avatar_url: m.avatarUrl || null,
      text: m.text,
      timestamp: m.timestamp || new Date().toLocaleTimeString(),
      created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString()
    });
    if (error) console.error('Error support message:', m.id, error.message);
  }

  console.log('Migration COMPLETED successfully!');
  process.exit(0);
}

migrate();
