/**
 * The HTML a contract template may be written in, and what it turns into.
 *
 * Templates have been plain text. That is fine to read in a textarea and
 * wrong everywhere else: a contract is a numbered, headed document with a
 * rate table and a signature block, and a wall of preformatted text is not
 * that. It also means the PDF, the screen and the email all have to agree
 * about what a blank line means, and they did not.
 *
 * So a template body may be HTML. A deliberately small subset of it:
 *
 *   h1 h2 h3      headings
 *   p             a paragraph
 *   ul ol li      lists, numbered or bulleted
 *   table tr td th   a simple grid, no spans
 *   strong b      bold
 *   em i          treated as bold, because the PDF has two fonts
 *   br            a line break inside a block
 *   hr            a rule
 *   div section   treated as a container, contents kept
 *
 * Everything else is dropped, including every attribute, every script and
 * every style. A contract is not a web page and nothing in it should be
 * able to load, run or style anything. That is not a sanitiser bolted on
 * afterwards: this parser only ever recognises the tags above, so there is
 * no path by which anything else reaches the output.
 *
 * The result is a list of blocks. The screen renders them, the PDF draws
 * them, and `blocksToText` flattens them for hashing and for email, so all
 * three agree by construction rather than by three separate implementations
 * that drift.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export type BlockKind = 'heading' | 'paragraph' | 'list' | 'table' | 'rule';

export interface InlineRun {
  text: string;
  bold?: boolean;
}

export interface DocumentBlock {
  kind: BlockKind;
  /** 1, 2 or 3 for a heading. */
  level?: number;
  /** A paragraph or heading's content. */
  runs?: InlineRun[];
  /** List items, each a run list. Ordered lists are numbered when rendered. */
  items?: InlineRun[][];
  ordered?: boolean;
  /** Table rows, each a list of cells, each cell a run list. */
  rows?: InlineRun[][][];
  /** True when the first table row is a header row. */
  headerRow?: boolean;
}

const BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'hr', 'div', 'section']);
const BOLD_TAGS = new Set(['strong', 'b', 'em', 'i', 'th']);

/** Decodes the handful of entities a contract body realistically contains. */
export function decodeEntities(text: string): string {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '-')
    .replace(/&ndash;/gi, '-')
    .replace(/&#(\d+);/g, (_whole, code) => {
      const number = Number(code);
      return Number.isFinite(number) && number >= 32 && number < 0x10000
        ? String.fromCharCode(number)
        : '';
    });
}

/** Escapes text for placing back into HTML. */
export function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Whether a body is HTML or plain text.
 *
 * Looks for one of the block tags rather than for any angle bracket, so a
 * plain-text contract mentioning "< 30 days" is not mistaken for markup.
 */
export function isHtml(body: string): boolean {
  return /<\s*(h1|h2|h3|p|ul|ol|li|table|tr|td|th|hr|div|section|strong|b|em|i|br)\b[^>]*>/i.test(String(body || ''));
}

interface Token {
  type: 'open' | 'close' | 'text' | 'selfclose';
  name?: string;
  text?: string;
}

/** Splits a body into tags and text, ignoring comments and anything unknown. */
function tokenise(html: string): Token[] {
  const tokens: Token[] = [];
  const source = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
  const pattern = /<\s*(\/?)\s*([a-z0-9]+)(\s[^>]*?)?\/?\s*>/gi;

  let index = 0;
  let match = pattern.exec(source);

  while (match) {
    if (match.index > index) {
      tokens.push({ type: 'text', text: source.slice(index, match.index) });
    }

    const closing = match[1] === '/';
    const name = String(match[2]).toLowerCase();

    if (name === 'br') tokens.push({ type: 'selfclose', name: 'br' });
    else if (BLOCK_TAGS.has(name) || BOLD_TAGS.has(name)) {
      tokens.push({ type: closing ? 'close' : 'open', name });
    }
    // Anything else — script, style, img, a, span, anything invented — is
    // dropped entirely, tag and all. Its text content is kept, because
    // dropping words silently is worse than dropping formatting.

    index = match.index + match[0].length;
    match = pattern.exec(source);
  }

  if (index < source.length) tokens.push({ type: 'text', text: source.slice(index) });
  return tokens;
}

function tidy(text: string): string {
  return decodeEntities(text).replace(/\s+/g, ' ');
}

function pushRun(runs: InlineRun[], text: string, bold: boolean) {
  if (!text) return;
  const last = runs[runs.length - 1];
  if (last && Boolean(last.bold) === bold) last.text += text;
  else runs.push(bold ? { text, bold: true } : { text });
}

function trimRuns(runs: InlineRun[]): InlineRun[] {
  const copy = runs.map(run => ({ ...run }));
  while (copy.length && !copy[0].text.trim()) copy.shift();
  while (copy.length && !copy[copy.length - 1].text.trim()) copy.pop();
  if (copy.length) {
    copy[0].text = copy[0].text.replace(/^\s+/, '');
    copy[copy.length - 1].text = copy[copy.length - 1].text.replace(/\s+$/, '');
  }
  return copy.filter(run => run.text.length > 0);
}

/**
 * Parses the subset into blocks.
 *
 * Deliberately forgiving about structure: an unclosed paragraph, a list item
 * outside a list, a table cell outside a row. A template is written by a
 * person in a textarea, and refusing to render a contract over a missing
 * closing tag helps nobody.
 */
export function parseDocument(body: string): DocumentBlock[] {
  if (!isHtml(body)) return parsePlainText(body);

  const blocks: DocumentBlock[] = [];
  let runs: InlineRun[] = [];
  let bold = 0;

  // Where we are. Only one of these is ever active at a time.
  let listItems: InlineRun[][] | null = null;
  let listOrdered = false;
  let tableRows: InlineRun[][][] | null = null;
  let tableRow: InlineRun[][] | null = null;
  let tableHeader = false;
  let cellOpen = false;
  let heading = 0;

  const flushInline = (): InlineRun[] => {
    const done = trimRuns(runs);
    runs = [];
    return done;
  };

  const closeParagraph = () => {
    const content = flushInline();
    if (content.length) blocks.push({ kind: 'paragraph', runs: content });
  };

  const closeHeading = () => {
    const content = flushInline();
    if (content.length) blocks.push({ kind: 'heading', level: heading || 2, runs: content });
    heading = 0;
  };

  const closeListItem = () => {
    const content = flushInline();
    if (content.length && listItems) listItems.push(content);
  };

  /**
   * Ends the cell currently being filled, if there is one.
   *
   * Guarded by cellOpen rather than called on every td, because a td that
   * opens a cell must not also close the one before it into existence: that
   * produced a leading empty cell in every row.
   */
  const closeCell = () => {
    if (!cellOpen) return;
    const content = flushInline();
    if (tableRow) tableRow.push(content);
    cellOpen = false;
  };

  for (const token of tokenise(body)) {
    if (token.type === 'text') {
      pushRun(runs, tidy(token.text || ''), bold > 0);
      continue;
    }

    if (token.type === 'selfclose' && token.name === 'br') {
      pushRun(runs, '\n', bold > 0);
      continue;
    }

    const name = token.name as string;
    const opening = token.type === 'open';

    if (BOLD_TAGS.has(name) && name !== 'th') {
      bold += opening ? 1 : -1;
      if (bold < 0) bold = 0;
      continue;
    }

    if (opening) {
      switch (name) {
        case 'h1': case 'h2': case 'h3':
          closeParagraph();
          heading = Number(name.slice(1));
          break;
        case 'p':
          closeParagraph();
          break;
        case 'ul': case 'ol':
          closeParagraph();
          listItems = [];
          listOrdered = name === 'ol';
          break;
        case 'li':
          closeListItem();
          if (!listItems) { listItems = []; listOrdered = false; }
          break;
        case 'table':
          closeParagraph();
          tableRows = [];
          tableHeader = false;
          break;
        case 'tr':
          closeCell();
          tableRow = [];
          break;
        case 'th':
          closeCell();
          if (!tableRow) tableRow = [];
          cellOpen = true;
          bold += 1;
          if (tableRows && tableRows.length === 0) tableHeader = true;
          break;
        case 'td':
          closeCell();
          if (!tableRow) tableRow = [];
          cellOpen = true;
          break;
        case 'hr':
          closeParagraph();
          blocks.push({ kind: 'rule' });
          break;
        default:
          // div, section: a container. Its contents carry on.
          break;
      }
      continue;
    }

    switch (name) {
      case 'h1': case 'h2': case 'h3':
        closeHeading();
        break;
      case 'p':
        closeParagraph();
        break;
      case 'li':
        closeListItem();
        break;
      case 'ul': case 'ol':
        closeListItem();
        if (listItems && listItems.length) {
          blocks.push({ kind: 'list', items: listItems, ordered: listOrdered });
        }
        listItems = null;
        break;
      case 'th':
        bold = Math.max(0, bold - 1);
        closeCell();
        break;
      case 'td':
        closeCell();
        break;
      case 'tr':
        if (tableRow && tableRow.length && tableRows) tableRows.push(tableRow);
        tableRow = null;
        break;
      case 'table':
        if (tableRow && tableRow.length && tableRows) tableRows.push(tableRow);
        tableRow = null;
        if (tableRows && tableRows.length) {
          blocks.push({ kind: 'table', rows: tableRows, headerRow: tableHeader });
        }
        tableRows = null;
        break;
      default:
        break;
    }
  }

  // Anything left over: an unclosed paragraph at the end of the body.
  closeParagraph();
  if (listItems && listItems.length) {
    blocks.push({ kind: 'list', items: listItems, ordered: listOrdered });
  }
  if (tableRows && tableRows.length) {
    blocks.push({ kind: 'table', rows: tableRows, headerRow: tableHeader });
  }

  return blocks;
}

/**
 * Plain text, read as a document.
 *
 * The eight templates that ship are written this way and are not being
 * rewritten by hand: a line in capitals or numbered like "7. LIABILITY" is
 * a heading, a blank line separates paragraphs, and a line starting with a
 * dash or a bullet is a list item.
 */
export function parsePlainText(body: string): DocumentBlock[] {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: DocumentBlock[] = [];

  let paragraph: string[] = [];
  let items: InlineRun[][] | null = null;

  const closeParagraph = () => {
    const text = paragraph.join(' ').trim();
    paragraph = [];
    if (text) blocks.push({ kind: 'paragraph', runs: [{ text }] });
  };

  const closeList = () => {
    if (items && items.length) blocks.push({ kind: 'list', items, ordered: false });
    items = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) { closeParagraph(); closeList(); continue; }

    if (/^[-=_]{4,}$/.test(line)) {
      closeParagraph(); closeList();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      closeParagraph();
      items = items || [];
      items.push([{ text: bullet[1].trim() }]);
      continue;
    }

    // A short line that is a numbered clause title, or is all capitals.
    const isHeading = line.length <= 80 && (
      /^\d+(\.\d+)*\.?\s+[A-Z][A-Z \-/&']*$/.test(line)
      || (/^[A-Z][A-Z0-9 \-/&',.()]*$/.test(line) && line.replace(/[^A-Z]/g, '').length >= 3)
    );

    if (isHeading) {
      closeParagraph(); closeList();
      blocks.push({ kind: 'heading', level: /^\d/.test(line) ? 3 : 2, runs: [{ text: line }] });
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  closeParagraph();
  closeList();
  return blocks;
}

/** The runs of a block as one string. */
function runsToText(runs?: InlineRun[]): string {
  return (runs || []).map(run => run.text).join('');
}

/**
 * The document as plain text.
 *
 * What gets hashed on signing and what goes in an email. Both formats
 * flatten the same way, so a template upgraded from text to HTML without
 * changing a word hashes the same.
 */
export function blocksToText(blocks: DocumentBlock[]): string {
  const out: string[] = [];

  for (const block of blocks) {
    if (block.kind === 'rule') { out.push('---'); continue; }
    if (block.kind === 'heading') { out.push(runsToText(block.runs)); continue; }
    if (block.kind === 'paragraph') { out.push(runsToText(block.runs)); continue; }
    if (block.kind === 'list') {
      (block.items || []).forEach((item, index) => {
        out.push(`${block.ordered ? `${index + 1}.` : '-'} ${runsToText(item)}`);
      });
      continue;
    }
    if (block.kind === 'table') {
      for (const row of block.rows || []) {
        out.push(row.map(cell => runsToText(cell)).join(' | '));
      }
    }
  }

  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** A document body as plain text, whatever it was written in. */
export function documentToText(body: string): string {
  return isHtml(body) ? blocksToText(parseDocument(body)) : String(body || '').trim();
}

/**
 * Blocks back to HTML, for the screen.
 *
 * Built from the parsed blocks rather than passed through, so what renders
 * is only ever the subset: a body carrying a script tag renders without it
 * because the parser never produced one.
 */
export function blocksToHtml(blocks: DocumentBlock[]): string {
  const inline = (runs?: InlineRun[]): string => (runs || [])
    .map(run => {
      const text = escapeHtml(run.text).replace(/\n/g, '<br>');
      return run.bold ? `<strong>${text}</strong>` : text;
    })
    .join('');

  return blocks.map(block => {
    if (block.kind === 'rule') return '<hr>';
    if (block.kind === 'heading') {
      const level = Math.min(3, Math.max(1, block.level || 2));
      return `<h${level}>${inline(block.runs)}</h${level}>`;
    }
    if (block.kind === 'paragraph') return `<p>${inline(block.runs)}</p>`;
    if (block.kind === 'list') {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = (block.items || []).map(item => `<li>${inline(item)}</li>`).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    if (block.kind === 'table') {
      const rows = (block.rows || []).map((row, index) => {
        const cellTag = block.headerRow && index === 0 ? 'th' : 'td';
        return `<tr>${row.map(cell => `<${cellTag}>${inline(cell)}</${cellTag}>`).join('')}</tr>`;
      }).join('');
      return `<table>${rows}</table>`;
    }
    return '';
  }).join('\n');
}

/** A body as safe HTML for display, whatever it was written in. */
export function documentToHtml(body: string): string {
  return blocksToHtml(parseDocument(body));
}

/**
 * Plain text promoted to HTML, so an existing template can be upgraded
 * without being retyped.
 */
export function textToHtml(body: string): string {
  return blocksToHtml(parsePlainText(body));
}
