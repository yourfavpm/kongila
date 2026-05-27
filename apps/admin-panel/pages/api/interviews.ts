import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync } from '@kongila/database';
import { Interview } from '@kongila/shared-types';

function generateMeetLink(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `https://meet.google.com/${seg(3)}-${seg(4)}-${seg(3)}`;
}

function generateCalendarEventId(): string {
  return `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function generateCalendarLink(eventId: string, interview: Partial<Interview>): string {
  const title = encodeURIComponent(interview.title || 'Interview');
  const startDate = interview.date?.replace(/-/g, '') || '';
  const startTime = (interview.time || '10:00').replace(':', '') + '00';
  const start = `${startDate}T${startTime}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${start}&details=Kongila+Interview+via+Google+Meet&location=${encodeURIComponent(interview.meetingLink || '')}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await readDbAsync();
  if (!db.interviews) (db as any).interviews = [];

  if (req.method === 'GET') {
    return res.status(200).json(db.interviews);
  }

  if (req.method === 'POST') {
    const body = req.body as Omit<Interview, 'id' | 'createdAt'>;
    const meetLink = generateMeetLink();
    const calEventId = generateCalendarEventId();
    const newInterview: Interview = {
      ...body,
      id: `interview_${Date.now()}`,
      meetingLink: body.meetingLink || meetLink,
      googleCalendarEventId: calEventId,
      googleCalendarLink: generateCalendarLink(calEventId, { ...body, meetingLink: meetLink }),
      createdAt: new Date().toISOString()
    };

    db.interviews.push(newInterview);

    // Write audit + agent logs
    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: body.clientName || 'Client',
        action: 'Schedule Interview',
        details: `Booked "${body.title}" with ${body.talentName} on ${body.date} at ${body.time}. Google Calendar event created.`,
        timestamp: new Date().toISOString()
      },
      ...(db.auditLogs || [])
    ];
    db.agentLogs = [
      {
        id: `alog_${Date.now()}`,
        agentName: 'Workflow Agent',
        message: `Interview slot confirmed with ${body.talentName} on ${body.date}. Meet link generated & calendar synced.`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'success'
      },
      ...(db.agentLogs || [])
    ];

    // Also update match status if matchId provided
    if (body.matchId && db.matches) {
      db.matches = db.matches.map(m =>
        m.id === body.matchId ? { ...m, status: 'Interview Scheduled' as const } : m
      );
    }

    // Push notification
    db.notifications = [
      {
        id: `notif_${Date.now()}`,
        userId: body.talentId,
        title: 'Interview Scheduled',
        message: `Interview "${body.title}" has been booked for ${body.date} at ${body.time}. Check your Google Calendar.`,
        read: false,
        createdAt: new Date().toISOString()
      },
      ...(db.notifications || [])
    ];

    await writeDbAsync(db);
    return res.status(201).json(newInterview);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body as Interview;
    if (!id) return res.status(400).json({ error: 'Missing interview id' });

    let updated: Interview | null = null;
    db.interviews = db.interviews.map(iv => {
      if (iv.id === id) {
        updated = { ...iv, ...updates, updatedAt: new Date().toISOString() };
        return updated;
      }
      return iv;
    });

    if (!updated) return res.status(404).json({ error: 'Interview not found' });

    const iv = updated as Interview;
    const isReschedule = updates.status === 'Rescheduled';
    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: iv.clientName || 'Client',
        action: isReschedule ? 'Reschedule Interview' : 'Update Interview',
        details: `Interview "${iv.title}" with ${iv.talentName} — new slot: ${iv.date} at ${iv.time}`,
        timestamp: new Date().toISOString()
      },
      ...(db.auditLogs || [])
    ];
    db.agentLogs = [
      {
        id: `alog_${Date.now()}`,
        agentName: 'Workflow Agent',
        message: `${isReschedule ? 'Rescheduled' : 'Updated'} interview for ${iv.talentName}. Calendar invite updated.`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'info'
      },
      ...(db.agentLogs || [])
    ];

    await writeDbAsync(db);
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    const target = db.interviews.find(iv => iv.id === id);
    if (!target) return res.status(404).json({ error: 'Interview not found' });
    db.interviews = db.interviews.filter(iv => iv.id !== id);
    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: target.clientName || 'Client',
        action: 'Cancel Interview',
        details: `Interview "${target.title}" with ${target.talentName} cancelled.`,
        timestamp: new Date().toISOString()
      },
      ...(db.auditLogs || [])
    ];
    await writeDbAsync(db);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
