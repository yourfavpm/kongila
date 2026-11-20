/**
 * Reading a spreadsheet of roles.
 *
 * A client hiring eight people types the same brief eight times today, which
 * is the point at which they give up and send a spreadsheet by email. This
 * reads that spreadsheet.
 *
 * It is deliberately forgiving about what a column is called and strict about
 * what a row means. Headers arrive as "Role Title", "role_title", "title" and
 * "Position" from four different clients, and refusing the file over a header
 * is a worse outcome than guessing it right. A row with no title, on the
 * other hand, is not a role, and is reported rather than quietly dropped —
 * finding out later that two of your eight roles never arrived is far worse
 * than being told now.
 *
 * This file imports nothing, so it can be tested on its own with node --test.
 */

export interface ParsedRole {
  /** 1-based line in the file, for pointing at the row that is wrong. */
  line: number;
  title: string;
  count: number;
  seniorityLevel?: string;
  requiredSkills: string[];
  description?: string;
  commitmentLevel?: string;
  startDate?: string;
  budgetMinUsd?: number;
  budgetMaxUsd?: number;
}

export interface RoleRowProblem {
  line: number;
  message: string;
}

export interface ParsedRoleFile {
  roles: ParsedRole[];
  problems: RoleRowProblem[];
  /** Headers found in the file, so a screen can show what it understood. */
  headers: string[];
}

/**
 * One pass, character by character, because a split on commas breaks the
 * moment a description contains one — and descriptions always do.
 * Handles quoted fields, escaped quotes ("" inside a quoted field), and both
 * line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const src = String(text || '').replace(/^﻿/, ''); // Excel writes a BOM.

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => {
    endField();
    // A trailing newline should not produce a row of one empty string.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const char = src[i];

    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += char; i++; continue;
    }

    if (char === '"') { inQuotes = true; i++; continue; }
    if (char === ',') { endField(); i++; continue; }
    if (char === '\r') { i++; continue; }
    if (char === '\n') { endRow(); i++; continue; }
    field += char; i++;
  }

  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** Header spellings seen in the wild, mapped to the field they mean. */
const COLUMNS: Record<string, string[]> = {
  title: ['title', 'role', 'role title', 'roletitle', 'position', 'job title', 'job'],
  count: ['count', 'headcount', 'number', 'quantity', 'qty', 'how many', 'number of hires', 'hires'],
  seniorityLevel: ['seniority', 'seniority level', 'level', 'experience level'],
  requiredSkills: ['skills', 'required skills', 'requiredskills', 'tech', 'stack', 'technologies'],
  description: ['description', 'role description', 'details', 'notes', 'summary', 'about'],
  commitmentLevel: ['commitment', 'commitment level', 'engagement', 'engagement type', 'type'],
  startDate: ['start date', 'startdate', 'start', 'begins'],
  budgetMinUsd: ['budget min', 'budgetmin', 'min budget', 'min', 'salary min', 'rate min'],
  budgetMaxUsd: ['budget max', 'budgetmax', 'max budget', 'max', 'salary max', 'rate max']
};

function normalizeHeader(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function fieldFor(header: string): string | null {
  const normalized = normalizeHeader(header);
  for (const [field, spellings] of Object.entries(COLUMNS)) {
    if (spellings.includes(normalized)) return field;
  }
  return null;
}

function toNumber(value: string): number | undefined {
  // "$4,500" and "4 500" are both what people type into a budget column.
  const cleaned = String(value || '').replace(/[^0-9.]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** ISO date, or undefined. A date nobody can parse is better left unset. */
function toDate(value: string): string | undefined {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

export interface ParseRolesOptions {
  /** Refuses anything past this, so one file cannot file 500 requests. */
  maxRoles?: number;
}

export function parseRoleCsv(text: string, options: ParseRolesOptions = {}): ParsedRoleFile {
  const maxRoles = options.maxRoles ?? 100;
  const rows = parseCsv(text);
  const problems: RoleRowProblem[] = [];

  if (rows.length === 0) {
    return { roles: [], headers: [], problems: [{ line: 0, message: 'That file is empty.' }] };
  }

  const headerRow = rows[0];
  const mapping = headerRow.map(fieldFor);
  const headers = headerRow.map(h => String(h || '').trim());

  if (!mapping.includes('title')) {
    return {
      roles: [],
      headers,
      problems: [{
        line: 1,
        message: 'No column of role titles. Name one column "Title" and try again.'
      }]
    };
  }

  const roles: ParsedRole[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const line = r + 1;

    // A blank line in the middle of a spreadsheet is a blank line, not an error.
    if (cells.every(cell => String(cell || '').trim() === '')) continue;

    const picked: Record<string, string> = {};
    mapping.forEach((field, index) => {
      if (field) picked[field] = String(cells[index] ?? '').trim();
    });

    const title = (picked.title || '').trim();
    if (!title) {
      problems.push({ line, message: 'No role title on this row, so it was skipped.' });
      continue;
    }

    if (roles.length >= maxRoles) {
      problems.push({ line, message: `Past the limit of ${maxRoles} roles, so this row was skipped.` });
      continue;
    }

    const countRaw = Number(String(picked.count || '').replace(/[^0-9]/g, ''));
    const count = Number.isInteger(countRaw) && countRaw > 0 ? countRaw : 1;
    if (picked.count && !(countRaw > 0)) {
      problems.push({ line, message: `"${picked.count}" is not a number of people, so this row was read as 1.` });
    }

    const minBudget = toNumber(picked.budgetMinUsd || '');
    const maxBudget = toNumber(picked.budgetMaxUsd || '');
    if (minBudget && maxBudget && minBudget > maxBudget) {
      problems.push({ line, message: 'The minimum budget is above the maximum, so both were left out.' });
    }

    const skills = (picked.requiredSkills || '')
      // Semicolons, because a skills column inside a CSV is usually
      // semicolon-separated for exactly that reason.
      .split(/[;,|]/)
      .map(skill => skill.trim())
      .filter(Boolean);

    roles.push({
      line,
      title,
      count,
      seniorityLevel: picked.seniorityLevel || undefined,
      requiredSkills: skills,
      description: picked.description || undefined,
      commitmentLevel: picked.commitmentLevel || undefined,
      startDate: toDate(picked.startDate || ''),
      budgetMinUsd: minBudget && maxBudget && minBudget > maxBudget ? undefined : minBudget,
      budgetMaxUsd: minBudget && maxBudget && minBudget > maxBudget ? undefined : maxBudget
    });
  }

  if (roles.length === 0 && problems.length === 0) {
    problems.push({ line: 0, message: 'No roles were found below the header row.' });
  }

  return { roles, headers, problems };
}

/** The template a client downloads, so the columns are right first time. */
export const ROLE_CSV_TEMPLATE = [
  'Title,Headcount,Seniority,Skills,Description,Commitment,Start Date,Budget Min,Budget Max',
  '"Backend Engineer",2,Senior,"Node.js; PostgreSQL; AWS","Owns our payments service",Full-Time,2026-01-12,4000,6000',
  '"Product Designer",1,Mid,"Figma; Design systems","Redesigning the client dashboard",Part-Time,2026-02-02,2500,3500'
].join('\n');
