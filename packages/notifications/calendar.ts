/**
 * Calendar invitations.
 *
 * Builds a real iCalendar (RFC 5545) file for an interview, which every
 * calendar app understands. Attached to the invitation email, so both parties
 * get the event in their own calendar at the correct local time without
 * anyone doing timezone arithmetic by hand.
 *
 * Deliberately no dependency: the format is a few lines of text and a library
 * would be more code than this.
 *
 * Times go out as UTC (the trailing Z form). Calendar clients convert to the
 * reader's own zone, which is the whole point.
 */

export interface CalendarInvite {
  uid: string;
  title: string;
  description?: string;
  /** ISO instant the interview starts. */
  startsAt: string;
  durationMinutes?: number;
  location?: string;
  organizerName?: string;
  organizerEmail?: string;
  attendees?: Array<{ name?: string; email: string }>;
  /** Bumped on every change, or calendar apps ignore the update. */
  sequence?: number;
  /** CANCELLED removes the event from an attendee's calendar. */
  method?: 'REQUEST' | 'CANCEL';
}

function toIcsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escapes the four characters iCalendar treats specially. */
function esc(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Lines must not exceed 75 octets; longer ones continue with a leading space. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const chunks: string[] = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    chunks.push(' ' + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest) chunks.push(' ' + rest);
  return chunks.join('\r\n');
}

export function buildIcs(invite: CalendarInvite): string {
  const start = new Date(invite.startsAt);
  if (Number.isNaN(start.getTime())) {
    throw new Error('buildIcs: startsAt is not a valid date');
  }
  const minutes = invite.durationMinutes ?? 60;
  const end = new Date(start.getTime() + minutes * 60_000);
  const method = invite.method || 'REQUEST';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kongila//Interviews//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${esc(invite.uid)}`,
    `DTSTAMP:${toIcsStamp(new Date().toISOString())}`,
    `DTSTART:${toIcsStamp(start.toISOString())}`,
    `DTEND:${toIcsStamp(end.toISOString())}`,
    `SEQUENCE:${invite.sequence ?? 0}`,
    `SUMMARY:${esc(invite.title)}`,
    `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`
  ];

  if (invite.description) lines.push(`DESCRIPTION:${esc(invite.description)}`);
  if (invite.location) lines.push(`LOCATION:${esc(invite.location)}`);
  if (invite.organizerEmail) {
    const cn = invite.organizerName ? `;CN=${esc(invite.organizerName)}` : '';
    lines.push(`ORGANIZER${cn}:mailto:${invite.organizerEmail}`);
  }
  for (const attendee of invite.attendees || []) {
    const cn = attendee.name ? `;CN=${esc(attendee.name)}` : '';
    lines.push(
      `ATTENDEE${cn};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee.email}`
    );
  }

  // A reminder inside the calendar itself, independent of anything Kongila
  // sends. If the reminder job never runs, the attendee is still nudged.
  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(invite.title)}`,
    'END:VALARM'
  );

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Base64 for an email attachment. */
export function icsAttachment(invite: CalendarInvite, filename = 'interview.ics') {
  return {
    filename,
    content: Buffer.from(buildIcs(invite), 'utf8').toString('base64'),
    contentType: `text/calendar; method=${invite.method || 'REQUEST'}; charset=utf-8`
  };
}
