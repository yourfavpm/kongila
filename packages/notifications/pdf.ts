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
  /** 0 to 1 each. Black when omitted. */
  rgb?: [number, number, number];
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

export interface RectOp {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0 to 1 each. Omit for a grey fill. */
  rgb?: [number, number, number];
  grey?: number;
}

/**
 * An image placed on the page.
 *
 * Only one image is ever drawn, the wordmark, so this takes the deflate
 * streams directly rather than growing a decoder. See brandLogo.ts for how
 * they are produced.
 */
export interface ImageOp {
  kind: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  /** Base64 of a raw deflate stream of 8-bit RGB samples. */
  rgb: string;
  /** Base64 of a raw deflate stream of 8-bit greyscale alpha, when the image has any. */
  alpha?: string;
  /** Pixel dimensions of the source. */
  pixelWidth: number;
  pixelHeight: number;
}

export type DrawOp = TextOp | LineOp | RectOp | ImageOp;

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

/**
 * Widths of Helvetica-Bold glyphs, from the same metrics.
 *
 * Bold used to be the regular widths multiplied by 1.06, which was near
 * enough to right-align one short string on an invoice and not near enough
 * for anything else: on a flowing line of contract text the error
 * accumulates across a bold phrase, and the words after it are drawn on top
 * of its tail. "Northwind Ltd on" came out as "Northwind Ltdon".
 */
const HELVETICA_BOLD_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 333, '"': 474, '#': 556, '$': 556, '%': 889, '&': 722, "'": 238,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 333, ';': 333, '<': 584, '=': 584, '>': 584, '?': 611,
  '@': 975, 'A': 722, 'B': 722, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778,
  'H': 722, 'I': 278, 'J': 556, 'K': 722, 'L': 611, 'M': 833, 'N': 722, 'O': 778,
  'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944,
  'X': 667, 'Y': 667, 'Z': 611, '[': 333, '\\': 278, ']': 333, '^': 584, '_': 556,
  '`': 333, 'a': 556, 'b': 611, 'c': 556, 'd': 611, 'e': 556, 'f': 333, 'g': 611,
  'h': 611, 'i': 278, 'j': 278, 'k': 556, 'l': 278, 'm': 889, 'n': 611, 'o': 611,
  'p': 611, 'q': 611, 'r': 389, 's': 556, 't': 333, 'u': 611, 'v': 556, 'w': 778,
  'x': 556, 'y': 556, 'z': 500, '{': 389, '|': 280, '}': 389, '~': 584
};

const AVERAGE_WIDTH = 556;
const AVERAGE_BOLD_WIDTH = 611;

export function textWidth(text: string, size: number, font: FontName = 'Helvetica'): number {
  const widths = font === 'Helvetica-Bold' ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  const fallback = font === 'Helvetica-Bold' ? AVERAGE_BOLD_WIDTH : AVERAGE_WIDTH;

  let total = 0;
  for (const char of String(text)) total += widths[char] ?? fallback;
  return (total / 1000) * size;
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

function opToStream(op: DrawOp, imageNames: Map<ImageOp, string>): string {
  if (op.kind === 'rect') {
    const fill = op.rgb
      ? `${op.rgb[0]} ${op.rgb[1]} ${op.rgb[2]} rg`
      : `${op.grey ?? 0.95} ${op.grey ?? 0.95} ${op.grey ?? 0.95} rg`;
    return [
      'q',
      fill,
      `${op.x} ${PAGE_HEIGHT - op.y - op.height} ${op.width} ${op.height} re`,
      'f',
      'Q'
    ].join('\n');
  }

  if (op.kind === 'image') {
    const name = imageNames.get(op);
    if (!name) return '';
    // The transform matrix both scales the unit square the image is drawn
    // into and positions it, which is why there is no separate scale step.
    return [
      'q',
      `${op.width} 0 0 ${op.height} ${op.x} ${PAGE_HEIGHT - op.y - op.height} cm`,
      `/${name} Do`,
      'Q'
    ].join('\n');
  }

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

  const colour = op.rgb ? `${op.rgb[0]} ${op.rgb[1]} ${op.rgb[2]} rg\n` : '';

  return [
    'q',
    `${colour}BT`,
    `${resource} ${size} Tf`,
    // PDF's origin is bottom left; callers think top left.
    `1 0 0 1 ${Math.round(x * 100) / 100} ${PAGE_HEIGHT - op.y} Tm`,
    `(${escapeText(op.text)}) Tj`,
    'ET',
    'Q'
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
  return buildPdfPages([ops]);
}

/**
 * The same, over several pages.
 *
 * An invoice is one page and always was. A contract is not: it is a dozen
 * numbered clauses, a rate table and a signature block, and the writer could
 * only ever emit one page, so anything past the fold was simply lost.
 *
 * Each entry in `pages` is that page's draw ops, in the same coordinates as
 * before: the origin is the top left of that page.
 */
export function buildPdfPages(pages: DrawOp[][]): Buffer {
  const sheets = pages.length > 0 ? pages : [[]];

  // Images become XObjects, which live in the page resource dictionary and
  // are referenced by name from a content stream. Shared across pages, so a
  // wordmark repeated on every page is stored once.
  const images: ImageOp[] = [];
  for (const sheet of sheets) {
    for (const op of sheet) {
      if (op.kind === 'image' && !images.includes(op)) images.push(op);
    }
  }
  const imageNames = new Map<ImageOp, string>();
  images.forEach((image, index) => imageNames.set(image, `Im${index + 1}`));

  const contents = sheets.map(sheet =>
    Buffer.from(sheet.map(op => opToStream(op, imageNames)).join('\n'), 'latin1'));

  // Object 1 is the catalogue, 2 the page tree, 3 and 4 the two fonts. Then
  // one page object and one content stream per page, then the images.
  let nextObject = 5 + sheets.length * 2;
  const imageObjects: { body: string | Buffer; }[] = [];
  const resourceEntries: string[] = [];

  for (const image of images) {
    const rgb = Buffer.from(image.rgb, 'base64');
    let maskRef = '';

    if (image.alpha) {
      const alpha = Buffer.from(image.alpha, 'base64');
      const maskNumber = nextObject++;
      imageObjects.push({
        body: Buffer.concat([
          Buffer.from(
            `<< /Type /XObject /Subtype /Image /Width ${image.pixelWidth} /Height ${image.pixelHeight} `
            + `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alpha.length} >>\n`
            + 'stream\n', 'latin1'),
          alpha,
          Buffer.from('\nendstream', 'latin1')
        ])
      });
      maskRef = ` /SMask ${maskNumber} 0 R`;
    }

    const imageNumber = nextObject++;
    imageObjects.push({
      body: Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${image.pixelWidth} /Height ${image.pixelHeight} `
          + `/ColorSpace /DeviceRGB /BitsPerComponent 8${maskRef} /Filter /FlateDecode /Length ${rgb.length} >>\n`
          + 'stream\n', 'latin1'),
        rgb,
        Buffer.from('\nendstream', 'latin1')
      ])
    });
    resourceEntries.push(`/${imageNames.get(image)} ${imageNumber} 0 R`);
  }

  const xobjects = resourceEntries.length
    ? ` /XObject << ${resourceEntries.join(' ')} >>`
    : '';

  // Page n is object 5 + 2n, its content stream 6 + 2n.
  const pageNumber = (index: number) => 5 + index * 2;
  const kids = sheets.map((_sheet, index) => `${pageNumber(index)} 0 R`).join(' ');

  const pageObjects: (string | Buffer)[] = [];
  sheets.forEach((_sheet, index) => {
    pageObjects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] `
      + `/Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjects} >> `
      + `/Contents ${pageNumber(index) + 1} 0 R >>`
    );
    const body = contents[index];
    pageObjects.push(Buffer.concat([
      Buffer.from(`<< /Length ${body.length} >>\nstream\n`, 'latin1'),
      body,
      Buffer.from('\nendstream', 'latin1')
    ]));
  });

  const objects: (string | Buffer)[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${sheets.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ...pageObjects,
    ...imageObjects.map(entry => entry.body)
  ];

  const chunks: Buffer[] = [];
  let offset = 0;
  const push = (text: string | Buffer) => {
    const buffer = typeof text === 'string' ? Buffer.from(text, 'latin1') : text;
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
    push(`${index + 1} 0 obj\n`);
    push(body);
    push('\nendobj\n');
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
