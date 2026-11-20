/**
 * The contract a party receives, as a PDF.
 *
 * There was no contract PDF at all. A contract existed as a body of text in
 * a database column, shown in a textarea on one screen and in a scrolling
 * div on another, and the thing a party was asked to sign could not be kept,
 * printed or sent to a lawyer. That is not a document.
 *
 * It lays out the blocks `@kongila/contracts/html` produces, so the PDF, the
 * screen and the hashed text are three renderings of one parse rather than
 * three implementations that drift. Text flows and breaks across pages,
 * which is what the single-page invoice writer could not do.
 */

import { buildPdfPages, textWidth, PAGE_WIDTH, PAGE_HEIGHT, type DrawOp, type FontName } from './pdf.ts';
import { BRAND_LOGO } from './brandLogo.ts';

/**
 * The block shape, declared here rather than imported.
 *
 * It is structurally what `@kongila/contracts/html` produces, and declaring
 * it keeps this package free of workspace dependencies, which is what lets
 * the PDF writer be tested on its own.
 */
export interface InlineRun {
  text: string;
  bold?: boolean;
}

export interface DocumentBlock {
  kind: 'heading' | 'paragraph' | 'list' | 'table' | 'rule';
  level?: number;
  runs?: InlineRun[];
  items?: InlineRun[][];
  ordered?: boolean;
  rows?: InlineRun[][][];
  headerRow?: boolean;
}

const BRAND: [number, number, number] = [0.043, 0.306, 0.722];
const INK: [number, number, number] = [0.08, 0.13, 0.25];
const MUTED: [number, number, number] = [0.42, 0.47, 0.55];

const LEFT = 56;
const RIGHT = PAGE_WIDTH - 56;
const WIDTH = RIGHT - LEFT;
const TOP = 132;
const BOTTOM = PAGE_HEIGHT - 72;

const BODY_SIZE = 10;
const LINE = 15;

export interface ContractPdfParty {
  /** 'Client' or 'Candidate', as it appears above the signature line. */
  role: string;
  name: string;
  /** Who actually signed, when they did. Absent until they have. */
  signedBy?: string | null;
  signedAt?: string | null;
}

export interface ContractPdfData {
  title: string;
  reference?: string | null;
  /** The blocks of the agreement, already rendered from its template. */
  blocks: DocumentBlock[];
  /** Kongila's own details, from platform settings. */
  issuerName?: string | null;
  issuerAddress?: string | null;
  /** Shown under the title: the engagement in one line. */
  subtitle?: string | null;
  parties?: ContractPdfParty[];
  /** sha256 of the signed text, printed in the footer as the audit anchor. */
  documentHash?: string | null;
  /** Marks the document as not yet executed. */
  draft?: boolean;
}

/** One line of laid-out text: the runs that fit, and how wide each is. */
interface LaidLine {
  runs: InlineRun[];
}

function runFont(run: InlineRun): FontName {
  return run.bold ? 'Helvetica-Bold' : 'Helvetica';
}

/**
 * Breaks runs into lines that fit a width.
 *
 * Word by word, keeping each word with the run it came from so bold stays
 * bold across a line break. An explicit newline inside a run, which is what
 * a <br> becomes, always breaks.
 */
function layoutRuns(runs: InlineRun[], width: number, size: number): LaidLine[] {
  const lines: LaidLine[] = [];
  let current: InlineRun[] = [];
  let used = 0;

  const flush = () => {
    lines.push({ runs: current });
    current = [];
    used = 0;
  };

  for (const run of runs || []) {
    const font = runFont(run);
    const segments = String(run.text || '').split('\n');

    segments.forEach((segment, segmentIndex) => {
      if (segmentIndex > 0) flush();

      const words = segment.split(/(\s+)/).filter(part => part.length > 0);
      for (const word of words) {
        const measure = textWidth(word, size, font);

        // Leading whitespace on a fresh line is dropped rather than indenting it.
        if (!current.length && /^\s+$/.test(word)) continue;

        if (used + measure > width && current.length) {
          flush();
          if (/^\s+$/.test(word)) continue;
        }

        const last = current[current.length - 1];
        if (last && Boolean(last.bold) === Boolean(run.bold)) last.text += word;
        else current.push(run.bold ? { text: word, bold: true } : { text: word });

        used += measure;
      }
    });
  }

  if (current.length) flush();
  return lines.filter((line, index) => index === 0 || line.runs.length > 0);
}

/** Draws one laid-out line, run by run, and returns nothing. */
function drawLine(
  ops: DrawOp[],
  line: LaidLine,
  x: number,
  y: number,
  size: number,
  colour: [number, number, number]
) {
  let cursor = x;
  for (const run of line.runs) {
    const font = runFont(run);
    ops.push({ kind: 'text', x: cursor, y, text: run.text, size, font, rgb: colour });
    cursor += textWidth(run.text, size, font);
  }
}

/** The header band, drawn at the top of every page. */
function header(ops: DrawOp[], data: ContractPdfData, page: number) {
  ops.push({ kind: 'rect', x: 0, y: 0, width: PAGE_WIDTH, height: 92, rgb: [0.97, 0.98, 1] });

  const logoHeight = 22;
  const logoWidth = Math.round((BRAND_LOGO.width / BRAND_LOGO.height) * logoHeight);
  ops.push({
    kind: 'image', x: LEFT, y: 26, width: logoWidth, height: logoHeight,
    rgb: BRAND_LOGO.rgb, alpha: BRAND_LOGO.alpha,
    pixelWidth: BRAND_LOGO.width, pixelHeight: BRAND_LOGO.height
  });

  ops.push({
    kind: 'text', x: RIGHT, y: 34, align: 'right', size: 13,
    font: 'Helvetica-Bold', rgb: BRAND, text: data.title || 'Agreement'
  });

  const right: string[] = [];
  if (data.reference) right.push(`Reference ${data.reference}`);
  if (data.draft) right.push('DRAFT — not executed');
  if (right.length) {
    ops.push({
      kind: 'text', x: RIGHT, y: 50, align: 'right', size: 8.5, rgb: MUTED,
      text: right.join('  ·  ')
    });
  }

  if (page === 0 && data.subtitle) {
    ops.push({ kind: 'text', x: LEFT, y: 70, size: 9, rgb: MUTED, text: data.subtitle });
  }

  ops.push({ kind: 'line', x1: 0, y1: 92, x2: PAGE_WIDTH, y2: 92, width: 1.2, grey: 0.86 });
}

/** The footer, with the page number and the document hash. */
function footer(ops: DrawOp[], data: ContractPdfData, page: number, total: number) {
  const y = PAGE_HEIGHT - 44;
  ops.push({ kind: 'line', x1: LEFT, y1: y - 14, x2: RIGHT, y2: y - 14, width: 0.6, grey: 0.88 });

  if (data.documentHash) {
    ops.push({
      kind: 'text', x: LEFT, y, size: 7.5, rgb: MUTED,
      text: `Document ${String(data.documentHash).slice(0, 32)}`
    });
  }

  ops.push({
    kind: 'text', x: RIGHT, y, size: 8, align: 'right', rgb: MUTED,
    text: `Page ${page + 1} of ${total}`
  });
}

interface Cursor {
  pages: DrawOp[][];
  ops: DrawOp[];
  y: number;
}

function newPage(cursor: Cursor, data: ContractPdfData) {
  cursor.ops = [];
  cursor.pages.push(cursor.ops);
  header(cursor.ops, data, cursor.pages.length - 1);
  cursor.y = TOP;
}

/** Makes room for `height` points, starting a page when there is none. */
function need(cursor: Cursor, data: ContractPdfData, height: number) {
  if (cursor.y + height > BOTTOM) newPage(cursor, data);
}

function drawBlock(cursor: Cursor, data: ContractPdfData, block: DocumentBlock) {
  if (block.kind === 'rule') {
    need(cursor, data, 20);
    cursor.y += 6;
    cursor.ops.push({ kind: 'line', x1: LEFT, y1: cursor.y, x2: RIGHT, y2: cursor.y, width: 0.6, grey: 0.85 });
    cursor.y += 14;
    return;
  }

  if (block.kind === 'heading') {
    const level = Math.min(3, Math.max(1, block.level || 2));
    const size = level === 1 ? 15 : level === 2 ? 12 : 10.5;
    const lines = layoutRuns(
      (block.runs || []).map(run => ({ ...run, bold: true })), WIDTH, size);

    // A heading never sits alone at the foot of a page.
    need(cursor, data, lines.length * (size + 5) + LINE + 12);
    cursor.y += level === 1 ? 14 : 12;

    for (const line of lines) {
      drawLine(cursor.ops, line, LEFT, cursor.y, size, level === 1 ? BRAND : INK);
      cursor.y += size + 5;
    }
    cursor.y += 4;
    return;
  }

  if (block.kind === 'paragraph') {
    const lines = layoutRuns(block.runs || [], WIDTH, BODY_SIZE);
    for (const line of lines) {
      need(cursor, data, LINE);
      drawLine(cursor.ops, line, LEFT, cursor.y, BODY_SIZE, INK);
      cursor.y += LINE;
    }
    cursor.y += 6;
    return;
  }

  if (block.kind === 'list') {
    const indent = 18;
    (block.items || []).forEach((item, index) => {
      const marker = block.ordered ? `${index + 1}.` : '•';
      const lines = layoutRuns(item, WIDTH - indent, BODY_SIZE);

      lines.forEach((line, lineIndex) => {
        need(cursor, data, LINE);
        if (lineIndex === 0) {
          cursor.ops.push({
            kind: 'text', x: LEFT, y: cursor.y, text: marker, size: BODY_SIZE, rgb: MUTED
          });
        }
        drawLine(cursor.ops, line, LEFT + indent, cursor.y, BODY_SIZE, INK);
        cursor.y += LINE;
      });
    });
    cursor.y += 6;
    return;
  }

  if (block.kind === 'table') {
    const rows = block.rows || [];
    if (rows.length === 0) return;

    const columns = Math.max(...rows.map(row => row.length));
    const columnWidth = WIDTH / columns;
    const padding = 6;

    rows.forEach((row, rowIndex) => {
      const isHeader = Boolean(block.headerRow) && rowIndex === 0;
      const cellLines = row.map(cell =>
        layoutRuns(
          isHeader ? cell.map(run => ({ ...run, bold: true })) : cell,
          columnWidth - padding * 2,
          BODY_SIZE - 0.5
        ));
      const height = Math.max(1, ...cellLines.map(lines => lines.length)) * (LINE - 1) + 8;

      need(cursor, data, height + 4);

      if (isHeader) {
        cursor.ops.push({
          kind: 'rect', x: LEFT, y: cursor.y - 10, width: WIDTH, height, rgb: [0.95, 0.97, 1]
        });
      } else if (rowIndex % 2 === 1) {
        cursor.ops.push({
          kind: 'rect', x: LEFT, y: cursor.y - 10, width: WIDTH, height, grey: 0.975
        });
      }

      cellLines.forEach((lines, columnIndex) => {
        let y = cursor.y;
        for (const line of lines) {
          drawLine(cursor.ops, line, LEFT + columnIndex * columnWidth + padding, y, BODY_SIZE - 0.5, INK);
          y += LINE - 1;
        }
      });

      cursor.y += height;
    });

    cursor.y += 10;
  }
}

/** The signature block, kept whole on one page. */
function signatures(cursor: Cursor, data: ContractPdfData) {
  const parties = data.parties || [];
  if (parties.length === 0) return;

  const height = 54 + parties.length * 72;
  need(cursor, data, height);

  cursor.y += 18;
  cursor.ops.push({
    kind: 'text', x: LEFT, y: cursor.y, text: 'SIGNED', size: 9,
    font: 'Helvetica-Bold', rgb: MUTED
  });
  cursor.y += 20;

  for (const party of parties) {
    cursor.ops.push({
      kind: 'text', x: LEFT, y: cursor.y, text: party.role, size: 8.5, rgb: MUTED
    });
    cursor.y += 14;
    cursor.ops.push({
      kind: 'text', x: LEFT, y: cursor.y, text: party.name || '', size: 11,
      font: 'Helvetica-Bold', rgb: INK
    });
    cursor.y += 22;

    cursor.ops.push({ kind: 'line', x1: LEFT, y1: cursor.y, x2: LEFT + 240, y2: cursor.y, width: 0.8, grey: 0.7 });
    cursor.y += 13;

    cursor.ops.push({
      kind: 'text', x: LEFT, y: cursor.y, size: 8.5,
      rgb: party.signedBy ? INK : MUTED,
      text: party.signedBy
        ? `Signed by ${party.signedBy}${party.signedAt ? ` on ${party.signedAt}` : ''}`
        : 'Not yet signed'
    });
    cursor.y += 23;
  }
}

/**
 * The contract, as a PDF.
 *
 * A draft is watermarked in the header rather than looking identical to an
 * executed one, because a document that cannot be told apart from the signed
 * version is a document somebody will file as the signed version.
 */
export function buildContractPdf(data: ContractPdfData): Buffer {
  const cursor: Cursor = { pages: [], ops: [], y: TOP };
  newPage(cursor, data);

  for (const block of data.blocks || []) drawBlock(cursor, data, block);
  signatures(cursor, data);

  if (data.issuerName || data.issuerAddress) {
    need(cursor, data, 40);
    cursor.y += 10;
    cursor.ops.push({
      kind: 'text', x: LEFT, y: cursor.y, size: 8, rgb: MUTED,
      text: [data.issuerName, data.issuerAddress].filter(Boolean).join(' · ')
    });
  }

  cursor.pages.forEach((ops, index) => footer(ops, data, index, cursor.pages.length));

  return buildPdfPages(cursor.pages);
}
