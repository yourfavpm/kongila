/**
 * A very small PDF writer.
 *
 * Written by hand for the same reason `calendar.ts` builds its own .ics:
 * the output is a single page of text and rules, and the alternative is a
 * dependency tree for something a few hundred lines covers. Nothing here
 * embeds a font, because Helvetica is one of the fourteen faces every PDF
 * reader is required to provide.
 *
 * It does exactly what an invoice needs: text at a position, in two or
 * three sizes, with horizontal rules and right-aligned numbers. It is not
 * a general PDF library and should not grow into one.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export type FontName = 'Helvetica' | 'Helvetica-Bold';

export interface TextOp {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  size?: number;
  font?: FontName;
  /** Right-aligns the text so it ends at x. Used for money columns. */
  align?: 'left' | 'right';
}

export interface LineOp {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width?: number;
  grey?: number;
}

export type DrawOp = TextOp | LineOp;

/** A4 in PDF points, which is the unit everything here is in. */
export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;

/**
 * Widths of Helvetica glyphs, in thousandths of the font size.
 *
 * Only needed to right-align text, since there is no layout engine to ask.
 * Anything not in the table falls back to the average, which is close
 * enough for a column of digits and would only ever be wrong for an
 * unusual character in a right-aligned string.
 */
const HELVETICA_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, 'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778,
  'H': 722, 'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778,
  'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944,
  'X': 667, 'Y': 667, 'Z': 611, '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556,
  '`': 333, 'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556,
  'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556,
  'p': 556, 'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722,
  'x': 500, 'y': 500, 'z': 500, '{': 334, '|': 260, '}': 334, '~': 584
};

const AVERAGE_WIDTH = 556;
/** Bold is a little wider; near enough for alignment. */
const BOLD_FACTOR = 1.06;

export function textWidth(text: string, size: number, font: FontName = 'Helvetica'): number {
  let total = 0;
  for (const char of String(text)) {
    total += HELVETICA_WIDTHS[char] ?? AVERAGE_WIDTH;
  }
  const width = (total / 1000) * size;
  return font === 'Helvetica-Bold' ? width * BOLD_FACTOR : width;
}

/**
 * Makes a string safe to put inside a PDF literal.
 *
 * Backslash and both parens end the string early if they go in raw, which
 * produces a file that opens as blank or not at all. A company name with a
 * bracket in it is not unusual.
 */
export function escapeText(text: string): string {
  return toWinAnsi(String(text))
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Brings text into the single-byte encoding the base fonts use.
 *
 * Characters outside it are transliterated where there is an obvious
 * equivalent and dropped where there is not, because a mangled byte renders
 * as a wrong glyph rather than nothing, and a wrong glyph on an invoice
 * looks like a mistake nobody made.
 */
export function toWinAnsi(text: string): string {
  const swaps: Record<string, string> = {
    '—': '-', '–': '-', '‘': "'", '’': "'",
    '“': '"', '”': '"', '…': '...', ' ': ' ',
    '•': '-', '−': '-', '₦': 'NGN ', '€': 'EUR ',
    '£': 'GBP '
  };

  let out = '';
  for (const char of String(text)) {
    if (swaps[char] !== undefined) { out += swaps[char]; continue; }
    const code = char.charCodeAt(0);
    // Printable ASCII and the Latin-1 range the base encoding covers.
    if (code >= 32 && code <= 126) { out += char; continue; }
    if (code >= 160 && code <= 255) { out += char; continue; }
    // Anything else is dropped rather than guessed at.
  }
  return out;
}

function opToStream(op: DrawOp): string {
  if (op.kind === 'line') {
    const grey = op.grey ?? 0.8;
    return [
      'q',
      `${grey} ${grey} ${grey} RG`,
      `${op.width ?? 0.75} w`,
      `${op.x1} ${PAGE_HEIGHT - op.y1} m`,
      `${op.x2} ${PAGE_HEIGHT - op.y2} l`,
      'S',
      'Q'
    ].join('\n');
  }

  const size = op.size ?? 10;
  const font = op.font ?? 'Helvetica';
  const resource = font === 'Helvetica-Bold' ? '/F2' : '/F1';
  const x = op.align === 'right' ? op.x - textWidth(op.text, size, font) : op.x;

  return [
    'BT',
    `${resource} ${size} Tf`,
    // PDF's origin is bottom left; callers think top left.
    `1 0 0 1 ${Math.round(x * 100) / 100} ${PAGE_HEIGHT - op.y} Tm`,
    `(${escapeText(op.text)}) Tj`,
    'ET'
  ].join('\n');
}

/**
 * Builds the file.
 *
 * Returns a Buffer because every byte offset in the cross-reference table
 * has to be counted in bytes, not characters, and a name with an accent in
 * it is more than one byte.
 */
export function buildPdf(ops: DrawOp[]): Buffer {
  const content = ops.map(opToStream).join('\n');
  const contentBytes = Buffer.from(content, 'latin1');

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] `
      + '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  ];

  const chunks: Buffer[] = [];
  let offset = 0;
  const push = (text: string) => {
    const buffer = Buffer.from(text, 'latin1');
    chunks.push(buffer);
    offset += buffer.length;
  };

  push('%PDF-1.4\n');
  // A comment of high bytes, which tells tools the file is binary rather
  // than text and stops a transfer mangling the line endings.
  push('%\xE2\xE3\xCF\xD3\n');

  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(offset);
    push(`${index + 1} 0 obj\n${body}\nendobj\n`);
  });

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const position of offsets) {
    xref += `${String(position).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.concat(chunks);
}
