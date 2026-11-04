/**
 * Settings: the defaults, and what counts as a valid value.
 *
 * Separate from settingsService because these are the parts worth testing on
 * their own, and settingsService imports the database.
 *
 * This file imports nothing.
 */

/**
 * What the product falls back to when a setting has not been stored.
 *
 * Deliberately the same values the code used to hardcode, so introducing
 * the table changes no behaviour until somebody edits a setting. The one
 * exception is platform_fee_rate, which has no default: inventing a margin
 * is what produced the fictional revenue figure in the first place.
 */
export const SETTING_DEFAULTS: Record<string, any> = {
  platform_fee_rate: null,
  default_currency: 'USD',
  payout_day_of_month: 25,
  vetting_grade_thresholds: { 'A+': 85, A: 75, B: 65 },
  grade_b_deployable: false,
  max_interviews_per_candidate: 3,
  interview_late_change_hours: 4,
  interview_default_duration_minutes: 60,
  reminder_hours_before: [24, 1],
  support_sla_hours: { High: 4, Medium: 24, Low: 48 }
};

/**
 * Checks a value before it is stored.
 *
 * A fee rate of 25 instead of 0.25 would multiply every revenue figure by a
 * hundred, and a grade threshold above 100 makes a grade unreachable. Both
 * are easy to type and neither would announce itself.
 */
export function validateSetting(key: string, value: any): string | null {
  switch (key) {
    case 'platform_fee_rate': {
      const rate = Number(value);
      if (!Number.isFinite(rate)) return 'The fee rate must be a number.';
      if (rate < 0 || rate > 1) {
        return 'The fee rate is a fraction between 0 and 1. For 25%, enter 0.25.';
      }
      return null;
    }

    case 'payout_day_of_month': {
      const day = Number(value);
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        return 'Pick a day between 1 and 28, so the run happens in every month.';
      }
      return null;
    }

    case 'vetting_grade_thresholds': {
      if (typeof value !== 'object' || value === null) return 'Expected an object of grade thresholds.';
      const { 'A+': aPlus, A: a, B: b } = value as any;
      for (const [grade, score] of Object.entries({ 'A+': aPlus, A: a, B: b })) {
        const n = Number(score);
        if (!Number.isFinite(n) || n < 0 || n > 100) return `${grade} must be between 0 and 100.`;
      }
      if (!(Number(aPlus) > Number(a) && Number(a) > Number(b))) {
        return 'Thresholds must descend: A+ above A above B.';
      }
      return null;
    }

    case 'max_interviews_per_candidate': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 10) return 'Pick between 1 and 10.';
      return null;
    }

    case 'interview_late_change_hours': {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || n > 168) return 'Pick between 0 and 168 hours.';
      return null;
    }

    case 'interview_default_duration_minutes': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 15 || n > 480) return 'Pick between 15 and 480 minutes.';
      return null;
    }

    case 'reminder_hours_before': {
      if (!Array.isArray(value)) return 'Expected a list of hours, for example [24, 1].';
      if (value.some(h => !Number.isFinite(Number(h)) || Number(h) <= 0)) {
        return 'Every reminder must be a positive number of hours before the start.';
      }
      return null;
    }

    case 'default_currency': {
      if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
        return 'Use a three-letter currency code, for example USD.';
      }
      return null;
    }

    case 'grade_b_deployable': {
      if (typeof value !== 'boolean') return 'Expected true or false.';
      return null;
    }

    default:
      return null;
  }
}
