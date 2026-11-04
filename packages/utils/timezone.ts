/**
 * Timezones for interviews.
 *
 * The premise of this product is African talent working for clients abroad,
 * so an interview almost always spans two zones. Until now it did not handle
 * them at all: `date` and `time` were naive wall-clock text with no zone
 * recorded, and every portal printed the raw string labelled "Your Local
 * Time". A client in New York booking 15:00 stored "15:00"; the candidate in
 * Lagos was shown "15:00 (Your Local Time)" for a call that actually started
 * at 21:00 their time, and joined six hours early.
 *
 * The rule from here: one instant, stored as UTC in `scheduled_time`, plus
 * the zone whoever scheduled it was working in. Wall-clock text is written
 * alongside for older screens, and is display only — never the source of
 * truth.
 *
 * No dependency. Intl handles the zone arithmetic, including DST.
 */

/** A zone the viewer's browser believes in, falling back to UTC. */
export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidTimeZone(zone?: string | null): boolean {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** How far `zone` is from UTC at a given instant, in milliseconds. */
function zoneOffsetMs(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value || 0);
  const asIfUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    get('hour') % 24, get('minute'), get('second')
  );
  return asIfUtc - instant.getTime();
}

/**
 * Turns a wall-clock date and time in a named zone into the UTC instant it
 * refers to. Returns null rather than guessing when the input is unusable.
 *
 * Two passes, because the offset itself depends on the instant: on the day a
 * zone changes for daylight saving, the first guess can land on the wrong
 * side of the change.
 */
export function wallClockToUtc(
  date?: string | null,
  time?: string | null,
  zone?: string | null
): string | null {
  if (!date) return null;
  const cleanDate = String(date).trim().slice(0, 10);
  const cleanTime = String(time || '00:00').trim().slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return null;
  if (!/^\d{2}:\d{2}$/.test(cleanTime)) return null;

  const tz = isValidTimeZone(zone) ? (zone as string) : 'UTC';
  const provisional = new Date(`${cleanDate}T${cleanTime}:00Z`);
  if (Number.isNaN(provisional.getTime())) return null;

  let utc = new Date(provisional.getTime() - zoneOffsetMs(provisional, tz));
  utc = new Date(provisional.getTime() - zoneOffsetMs(utc, tz));
  return utc.toISOString();
}

/** The wall-clock date and time an instant falls on, in a given zone. */
export function utcToWallClock(
  iso?: string | null,
  zone?: string | null
): { date: string; time: string } | null {
  if (!iso) return null;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;

  const tz = isValidTimeZone(zone) ? (zone as string) : 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(instant);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`
  };
}

/** "Thu 12 Nov, 3:00 PM WAT" — what a person should actually read. */
export function formatInstantInZone(
  iso?: string | null,
  zone?: string | null,
  options?: { withDate?: boolean; withZone?: boolean }
): string {
  if (!iso) return 'Not scheduled';
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return 'Not scheduled';

  const tz = isValidTimeZone(zone) ? (zone as string) : 'UTC';
  const withDate = options?.withDate !== false;
  const withZone = options?.withZone !== false;

  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: withDate ? 'short' : undefined,
      day: withDate ? 'numeric' : undefined,
      month: withDate ? 'short' : undefined,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: withZone ? 'short' : undefined
    }).format(instant);
  } catch {
    return instant.toISOString();
  }
}

/**
 * Both sides of the call, so neither party has to do the arithmetic.
 * `otherLabel` names whose zone the second line belongs to.
 */
export function formatForBothParties(
  iso?: string | null,
  viewerZone?: string | null,
  otherZone?: string | null,
  otherLabel = 'their time'
): { viewer: string; other: string | null } {
  const vz = isValidTimeZone(viewerZone) ? (viewerZone as string) : viewerTimeZone();
  const viewer = formatInstantInZone(iso, vz);

  if (!isValidTimeZone(otherZone) || otherZone === vz) {
    return { viewer, other: null };
  }
  return {
    viewer,
    other: `${formatInstantInZone(iso, otherZone)} (${otherLabel})`
  };
}

/**
 * The instant an interview row refers to.
 *
 * Prefers scheduled_time, the only field that is unambiguous. Falls back to
 * the legacy wall-clock columns, interpreting them in the zone the row
 * recorded, or UTC when it recorded none. A row written before this existed
 * has no zone, so its time is a guess — which is why the writers now always
 * set scheduled_time.
 */
export function interviewInstant(interview: any): string | null {
  if (!interview) return null;
  const direct = interview.scheduledTime || interview.scheduled_time || interview.confirmedSlot || interview.confirmed_slot;
  if (direct) {
    const parsed = new Date(direct);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return wallClockToUtc(
    interview.date,
    interview.time,
    interview.scheduledTimezone || interview.scheduled_timezone
  );
}

/** The zone an interview was scheduled in, when the row recorded one. */
export function interviewZone(interview: any): string | null {
  const zone = interview?.scheduledTimezone || interview?.scheduled_timezone;
  return isValidTimeZone(zone) ? zone : null;
}

/** A short, readable list of zones for a picker, viewer's own first. */
export function timeZoneOptions(viewer = viewerTimeZone()): Array<{ value: string; label: string }> {
  const common = [
    { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'America/New_York', label: 'New York (ET)' },
    { value: 'America/Chicago', label: 'Chicago (CT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Australia/Sydney', label: 'Sydney (AET)' },
    { value: 'UTC', label: 'UTC' }
  ];
  const rest = common.filter(o => o.value !== viewer);
  return [{ value: viewer, label: `${viewer} (your timezone)` }, ...rest];
}

/**
 * Candidate slots for a scheduling picker.
 *
 * The modal used to offer four slots hardcoded to 20-22 July 2026, which are
 * in the past, so the client's main route to an interview offered only
 * expired dates. These are generated from today, on weekdays, in the zone the
 * scheduler picked.
 */
export function generateSlots(
  zone: string,
  options?: { days?: number; hours?: number[]; startInDays?: number }
): Array<{ date: string; time: string; iso: string }> {
  const days = options?.days ?? 5;
  const hours = options?.hours ?? [9, 11, 14, 16];
  const startInDays = options?.startInDays ?? 1;
  const tz = isValidTimeZone(zone) ? zone : 'UTC';

  const slots: Array<{ date: string; time: string; iso: string }> = [];
  const today = utcToWallClock(new Date().toISOString(), tz);
  if (!today) return slots;

  let offered = 0;
  for (let dayOffset = startInDays; dayOffset < startInDays + 21 && offered < days; dayOffset++) {
    const cursor = new Date(`${today.date}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + dayOffset);
    const weekday = cursor.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    const date = cursor.toISOString().slice(0, 10);
    for (const hour of hours) {
      const time = `${String(hour).padStart(2, '0')}:00`;
      const iso = wallClockToUtc(date, time, tz);
      if (iso) slots.push({ date, time, iso });
    }
    offered++;
  }
  return slots;
}
