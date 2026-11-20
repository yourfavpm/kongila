import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CONTRACT_TEMPLATES,
  TEMPLATE_TOKENS,
  renderTemplate,
  unknownTokens,
  missingValues
} from './defaultTemplates.ts';

test('there is one template per service line per audience, with a stable key', () => {
  const clientLines = DEFAULT_CONTRACT_TEMPLATES
    .filter(entry => entry.audience === 'client')
    .map(entry => entry.serviceType).sort();
  assert.deepEqual(clientLines, ['managed_workforce', 'outsourcing', 'placement', 'project']);

  const keys = new Set(DEFAULT_CONTRACT_TEMPLATES.map(entry => entry.key));
  assert.equal(keys.size, DEFAULT_CONTRACT_TEMPLATES.length, 'two templates share a key');
});

test('every token used is one the editor knows about', () => {
  for (const template of DEFAULT_CONTRACT_TEMPLATES) {
    assert.deepEqual(
      unknownTokens(template.body), [],
      `${template.key} uses a token nothing will fill`
    );
  }
});

test('no template hardcodes a company name', () => {
  // Two hardcoded strings used to name two different companies. The entity
  // is a setting now, so there is one answer rather than two.
  for (const template of DEFAULT_CONTRACT_TEMPLATES) {
    assert.doesNotMatch(template.body, /KONGILA EOR SYSTEMS|KONGILA TALENT DEPLOYMENT/i, template.key);
    assert.match(template.body, /\{\{contracting_entity\}\}/, `${template.key} never names the entity`);
  }
});

test('no template mentions Remotan', () => {
  for (const template of DEFAULT_CONTRACT_TEMPLATES) {
    assert.doesNotMatch(template.body, /remotan/i, template.key);
  }
});

test('every template carries the clauses a contract cannot go out without', () => {
  const required = [
    /CONFIDENTIALITY/,
    /INTELLECTUAL PROPERTY/,
    /DATA PROTECTION/,
    /LIABILITY/,
    /TERMINATION/,
    /GOVERNING LAW/,
    /SIGNED/
  ];
  for (const template of DEFAULT_CONTRACT_TEMPLATES.filter(entry => entry.audience === 'client')) {
    for (const clause of required) {
      assert.match(template.body, clause, `${template.key} is missing ${clause}`);
    }
  }
});

test('each line says the thing that makes it that line', () => {
  const byLine = Object.fromEntries(
    DEFAULT_CONTRACT_TEMPLATES
      .filter(entry => entry.audience === 'client')
      .map(entry => [entry.serviceType, entry.body])
  );
  // A placement ends at the introduction. Saying so is the whole point.
  assert.match(byLine.placement, /does not supervise, pay, invoice for or\s+manage/);
  assert.match(byLine.placement, /\{\{placement_fee\}\}/);
  assert.match(byLine.outsourcing, /invoiced\s+monthly in arrears/);
  assert.match(byLine.managed_workforce, /per seat/);
  assert.match(byLine.managed_workforce, /\{\{seats\}\}/);
  assert.match(byLine.project, /invoiced\s+against milestones/);
});

test('a token with no value is left visible rather than blanked', () => {
  const rendered = renderTemplate('The role of {{role_title}} starts {{start_date}}.', {
    role_title: 'Backend Engineer'
  });
  // "The role of Backend Engineer starts ." would be signed without anybody
  // noticing the date was never filled in.
  assert.equal(rendered, 'The role of Backend Engineer starts [start date].');
});

test('rendering handles spacing and case inside the braces', () => {
  assert.equal(renderTemplate('{{ Role_Title }}', { role_title: 'Designer' }), 'Designer');
});

test('rendering leaves text with no tokens alone', () => {
  assert.equal(renderTemplate('No tokens here.', {}), 'No tokens here.');
  assert.equal(renderTemplate('', {}), '');
});

test('missingValues names what still has to be filled in', () => {
  const missing = missingValues('{{client_name}} and {{talent_name}} and {{role_title}}', {
    client_name: 'Acme',
    talent_name: '   '
  });
  assert.deepEqual(missing.sort(), ['role_title', 'talent_name']);
});

test('every documented token has a label and an example', () => {
  for (const token of TEMPLATE_TOKENS) {
    assert.ok(token.label.trim(), `${token.token} has no label`);
    assert.ok(token.example.trim(), `${token.token} has no example`);
  }
});

// ─── Client and candidate documents ──────────────────────────────────────────

test('every service line has both a client and a candidate template', () => {
  const lines = ['placement', 'outsourcing', 'managed_workforce', 'project'];
  for (const line of lines) {
    for (const audience of ['client', 'talent']) {
      const found = DEFAULT_CONTRACT_TEMPLATES.find(
        entry => entry.serviceType === line && entry.audience === audience
      );
      assert.ok(found, `${line} has no ${audience} template`);
    }
  }
  assert.equal(DEFAULT_CONTRACT_TEMPLATES.length, 8);
});

test('a candidate never reads the client fee, and a client never reads the payout', () => {
  // The whole reason these are two documents. One template carrying both is
  // how a candidate learns the margin.
  for (const template of DEFAULT_CONTRACT_TEMPLATES) {
    if (template.audience === 'talent') {
      assert.doesNotMatch(template.body, /\{\{placement_fee\}\}/, template.key);
      assert.doesNotMatch(template.body, /Kongila service fee/i, template.key);
    } else {
      assert.doesNotMatch(template.body, /\{\{talent_pay\}\}/, template.key);
      assert.doesNotMatch(template.body, /\{\{talent_commission_pct\}\}/, template.key);
    }
  }
});

test('every candidate template says what they are paid and when', () => {
  for (const template of DEFAULT_CONTRACT_TEMPLATES.filter(entry => entry.audience === 'talent')) {
    if (template.serviceType === 'placement') {
      // A direct hire is paid by the client, so Kongila's document says so
      // rather than quoting a payday it has no part in.
      assert.match(template.body, /employed by \{\{client_name\}\}\s+directly/);
      assert.match(template.body, /deducts nothing/);
      continue;
    }
    assert.match(template.body, /\{\{talent_pay\}\}/, `${template.key} never says the pay`);
    assert.match(template.body, /\{\{payday\}\}/, `${template.key} never says the payday`);
    assert.match(template.body, /\{\{first_payday\}\}/, `${template.key} never says the first payday`);
  }
});

test('every candidate template carries the clauses it cannot go out without', () => {
  const required = [/CONFIDENTIALITY/, /INTELLECTUAL PROPERTY/, /DATA PROTECTION/, /TERMINATION/, /SIGNED/];
  for (const template of DEFAULT_CONTRACT_TEMPLATES.filter(entry => entry.audience === 'talent')) {
    for (const clause of required) {
      assert.match(template.body, clause, `${template.key} is missing ${clause}`);
    }
  }
});

test('an outsourced candidate is told they are paid whether the client has paid or not', () => {
  const outsourcing = DEFAULT_CONTRACT_TEMPLATES.find(
    entry => entry.serviceType === 'outsourcing' && entry.audience === 'talent'
  )!;
  assert.match(outsourcing.body, /whether or not the\s+client has paid/);
});

test('a managed team candidate takes direction from Kongila, not the client', () => {
  const managed = DEFAULT_CONTRACT_TEMPLATES.find(
    entry => entry.serviceType === 'managed_workforce' && entry.audience === 'talent'
  )!;
  assert.match(managed.body, /do not take\s+direction from the client/);
  assert.match(managed.body, /\{\{supervisor_name\}\}/);
});
