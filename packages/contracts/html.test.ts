import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isHtml,
  parseDocument,
  parsePlainText,
  blocksToText,
  blocksToHtml,
  documentToHtml,
  documentToText,
  textToHtml,
  decodeEntities,
  escapeHtml
} from './html.ts';

// ─── Telling the two formats apart ───────────────────────────────────────────

test('a plain-text contract mentioning a comparison is not markup', () => {
  assert.equal(isHtml('Notice of less than < 30 days is not accepted.'), false);
});

test('a body with a block tag is markup', () => {
  assert.equal(isHtml('<p>Hello</p>'), true);
  assert.equal(isHtml('<H2>TERMS</H2>'), true);
});

// ─── The subset ──────────────────────────────────────────────────────────────

test('headings, paragraphs and rules come through', () => {
  const blocks = parseDocument('<h1>Agreement</h1><p>This is the deal.</p><hr>');
  assert.deepEqual(blocks.map(b => b.kind), ['heading', 'paragraph', 'rule']);
  assert.equal(blocks[0].level, 1);
  assert.equal(blocks[1].runs?.[0].text, 'This is the deal.');
});

test('bold survives and merges with its neighbours', () => {
  const blocks = parseDocument('<p>Pay <strong>USD 4,000</strong> monthly.</p>');
  const runs = blocks[0].runs || [];
  assert.equal(runs.length, 3);
  assert.equal(runs[1].bold, true);
  assert.equal(runs[1].text, 'USD 4,000');
});

test('italics are treated as bold, because the PDF has two fonts', () => {
  const blocks = parseDocument('<p>See <em>Schedule 1</em>.</p>');
  assert.ok((blocks[0].runs || []).some(run => run.bold && run.text === 'Schedule 1'));
});

test('an ordered list keeps its order flag', () => {
  const [block] = parseDocument('<ol><li>First</li><li>Second</li></ol>');
  assert.equal(block.kind, 'list');
  assert.equal(block.ordered, true);
  assert.equal(block.items?.length, 2);
});

test('a table with a header row is marked as having one', () => {
  const [block] = parseDocument(
    '<table><tr><th>Item</th><th>Amount</th></tr><tr><td>Fee</td><td>USD 500</td></tr></table>');
  assert.equal(block.kind, 'table');
  assert.equal(block.headerRow, true);
  assert.equal(block.rows?.length, 2);
  assert.equal(block.rows?.[1][1][0].text, 'USD 500');
});

test('a line break inside a paragraph is kept', () => {
  const [block] = parseDocument('<p>Line one<br>Line two</p>');
  assert.match(blocksToText([block]), /Line one\nLine two/);
});

// ─── What is not in the subset ───────────────────────────────────────────────

test('a script tag is dropped, tag and content alike reaching nothing executable', () => {
  const html = documentToHtml('<p>Terms</p><script>alert(1)</script>');
  assert.equal(/script/i.test(html), false);
  assert.equal(/alert/.test(html), true, 'its text is kept as text, which is harmless');
});

test('attributes are dropped, including event handlers and styles', () => {
  const html = documentToHtml('<p onclick="steal()" style="color:red" class="x">Hello</p>');
  assert.equal(html, '<p>Hello</p>');
});

test('a link becomes its text, never a link', () => {
  const html = documentToHtml('<p>Read the <a href="http://example.com">policy</a>.</p>');
  assert.equal(/href|<a/i.test(html), false);
  assert.match(html, /policy/);
});

test('an image cannot be placed in a contract', () => {
  assert.equal(/<img/i.test(documentToHtml('<p><img src="x.png"></p>')), false);
});

test('text pasted into a template cannot break out of its block', () => {
  const html = blocksToHtml([{ kind: 'paragraph', runs: [{ text: '</p><script>bad()</script>' }] }]);
  assert.equal(/<script/i.test(html), false);
  assert.match(html, /&lt;\/p&gt;/);
});

// ─── Plain text read as a document ───────────────────────────────────────────

test('a numbered clause title in capitals becomes a heading', () => {
  const blocks = parsePlainText('7. LIABILITY\n\nNeither party is liable for indirect loss.');
  assert.equal(blocks[0].kind, 'heading');
  assert.equal(blocks[1].kind, 'paragraph');
});

test('a blank line separates paragraphs and a dash starts a list', () => {
  const blocks = parsePlainText('First para.\n\n- one\n- two\n\nSecond para.');
  assert.deepEqual(blocks.map(b => b.kind), ['paragraph', 'list', 'paragraph']);
  assert.equal(blocks[1].items?.length, 2);
});

test('a row of dashes is a rule', () => {
  assert.equal(parsePlainText('Above\n\n--------\n\nBelow')[1].kind, 'rule');
});

test('an ordinary sentence is never mistaken for a heading', () => {
  const blocks = parsePlainText('The Client shall pay the Service Fee within 30 days of invoice.');
  assert.equal(blocks[0].kind, 'paragraph');
});

// ─── Flattening, which is what gets hashed ───────────────────────────────────

test('the same wording hashes the same whether written as text or as HTML', () => {
  const asText = 'TERMS\n\nThe fee is due in 30 days.';
  const asHtml = '<h2>TERMS</h2><p>The fee is due in 30 days.</p>';
  assert.equal(documentToText(asHtml), blocksToText(parsePlainText(asText)));
});

test('a list flattens with its numbering', () => {
  assert.match(blocksToText(parseDocument('<ol><li>One</li><li>Two</li></ol>')), /1\. One\n\n2\. Two/);
});

test('a table flattens to pipe-separated rows', () => {
  const text = blocksToText(parseDocument('<table><tr><td>Fee</td><td>500</td></tr></table>'));
  assert.equal(text, 'Fee | 500');
});

// ─── Upgrading a template ────────────────────────────────────────────────────

test('plain text promoted to HTML keeps every word', () => {
  const source = 'AGREEMENT\n\nThe parties agree as follows.\n\n- One\n- Two';
  const upgraded = textToHtml(source);
  assert.match(upgraded, /<h2>AGREEMENT<\/h2>/);
  assert.match(upgraded, /<li>One<\/li>/);
  assert.equal(documentToText(upgraded), blocksToText(parsePlainText(source)));
});

test('merge placeholders survive the round trip untouched', () => {
  const upgraded = textToHtml('Pay {{rate_amount}} on {{payday}}.');
  assert.match(upgraded, /\{\{rate_amount\}\}/);
  assert.match(documentToText(upgraded), /\{\{payday\}\}/);
});

// ─── Entities ────────────────────────────────────────────────────────────────

test('the entities a contract actually contains are decoded', () => {
  assert.equal(decodeEntities('Smith &amp; Co &mdash; 30&nbsp;days'), 'Smith & Co - 30 days');
});

test('escaping is the inverse where it matters', () => {
  assert.equal(escapeHtml('<b>&"'), '&lt;b&gt;&amp;&quot;');
});

// ─── Forgiving about structure ───────────────────────────────────────────────

test('an unclosed paragraph at the end is still a paragraph', () => {
  const blocks = parseDocument('<p>One</p><p>Two');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].runs?.[0].text, 'Two');
});

test('an empty body is an empty document, not a crash', () => {
  assert.deepEqual(parseDocument(''), []);
  assert.equal(blocksToText([]), '');
});
