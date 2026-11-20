-- Snapshot service margins on accepted offers and apply them consistently to
-- one-time and milestone invoices. This migration is proposed only; apply it
-- through the normal database change process after review.
begin;

alter table public.contracts
  add column if not exists client_fee_pct_snapshot numeric(6,4),
  add column if not exists talent_commission_pct_snapshot numeric(6,4);

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_client_fee_snapshot_check') then
    alter table public.contracts add constraint contracts_client_fee_snapshot_check
      check (client_fee_pct_snapshot is null or client_fee_pct_snapshot between 0 and 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contracts_talent_commission_snapshot_check') then
    alter table public.contracts add constraint contracts_talent_commission_snapshot_check
      check (talent_commission_pct_snapshot is null or talent_commission_pct_snapshot between 0 and 1);
  end if;
end
$constraints$;

alter table public.invoices
  add column if not exists platform_margin_usd numeric(12,2);

-- Four service-specific starter records. These are deliberately drafts, not
-- legal templates. They can be attached only after counsel-approved terms
-- have been supplied and the operator publishes them in Template Manager.
insert into public.contract_templates(id, name, service_type, body, status, version)
values
  ('starter_contract_placement', 'Direct Hire / Placement — starter draft', 'placement',
   E'DRAFT ONLY — Replace this notice with counsel-approved terms before publishing.\n\nClient: {{client_company}}\nProfessional: {{talent_name}}\nRole: {{role_title}}\nClient service amount including Kongila fee: USD {{client_service_rate_usd}}', 'draft', 1),
  ('starter_contract_outsourcing', 'Talent Outsourcing — starter draft', 'outsourcing',
   E'DRAFT ONLY — Replace this notice with counsel-approved terms before publishing.\n\nClient: {{client_company}}\nProfessional: {{talent_name}}\nRole: {{role_title}}\nMonthly client service amount including Kongila fee: USD {{client_service_rate_usd}}', 'draft', 1),
  ('starter_contract_managed_workforce', 'Managed Workforce — starter draft', 'managed_workforce',
   E'DRAFT ONLY — Replace this notice with counsel-approved terms before publishing.\n\nClient: {{client_company}}\nProfessional: {{talent_name}}\nRole: {{role_title}}\nMonthly client service amount including Kongila fee: USD {{client_service_rate_usd}}', 'draft', 1),
  ('starter_contract_project', 'Project Execution — starter draft', 'project',
   E'DRAFT ONLY — Replace this notice with counsel-approved terms before publishing.\n\nClient: {{client_company}}\nProfessional: {{talent_name}}\nProject role: {{role_title}}\nAgreed project amount including Kongila fee: USD {{client_service_rate_usd}}', 'draft', 1)
on conflict (id) do nothing;

create or replace function public.invoice_placement_activation(p_contract_id text, p_due_date date)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  c public.contracts%rowtype;
  invoice_id_value text;
  guarantee_months_value integer;
  fee_pct numeric;
  base_fee numeric;
  service_fee numeric;
  client_total numeric;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found then raise exception 'Contract not found'; end if;
  if c.offer_id is null then raise exception 'A placement offer must exist before activation'; end if;
  if lower(coalesce(c.service_type,'')) not in ('hire talent','direct hire','direct_hire','placement') then
    raise exception 'This contract is not a direct-hire placement';
  end if;
  if c.status not in ('pending_signatures','client_signed','talent_signed','fully_signed') then
    raise exception 'The placement invoice is available after the offer and contract have been sent for signature';
  end if;
  if c.start_date is null then raise exception 'Confirm the placement start date before activation'; end if;
  if c.placement_fee_invoiced_at is not null then
    return jsonb_build_object('invoice_id', (select id from public.invoices where contract_id = c.id and invoice_trigger = 'placement_activation' limit 1), 'already_invoiced', true);
  end if;
  if c.placement_fee_usd is null or c.placement_fee_usd <= 0 then raise exception 'Placement fee is not configured'; end if;
  select coalesce(c.client_fee_pct_snapshot, fc.client_fee_pct) into fee_pct
    from public.fee_config fc where fc.service_line = 'placement';
  if fee_pct is null then fee_pct := c.client_fee_pct_snapshot; end if;
  if fee_pct is null then raise exception 'Placement client fee is not configured'; end if;
  base_fee := round(c.placement_fee_usd, 2);
  service_fee := round(base_fee * fee_pct, 2);
  client_total := base_fee + service_fee;
  select coalesce((value #>> '{}')::integer, 4) into guarantee_months_value
    from public.platform_settings where key = 'placement_guarantee_months';
  guarantee_months_value := coalesce(guarantee_months_value, 4);
  insert into public.invoices(id, invoice_number, client_id, contract_id, period, service_line,
    invoice_trigger, amount, subtotal_usd, tax_amount_usd, total_usd, total_amount_usd,
    platform_margin_usd, currency, usd_rate, status, due_date, created_at)
  values ('inv_' || gen_random_uuid()::text,
    'KNG-PLACE-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text,1,6)),
    c.client_id, c.id, 'placement-activation', 'placement', 'placement_activation',
    client_total, client_total, 0, client_total, client_total,
    client_total, coalesce(nullif(to_jsonb(c)->>'currency',''),'USD'), 1, 'draft', p_due_date, now())
  returning id into invoice_id_value;
  insert into public.invoice_line_items(id, invoice_id, description, quantity, unit_amount, amount)
  values ('line_' || gen_random_uuid()::text, invoice_id_value, 'Placement activation fee', 1, base_fee, base_fee);
  if service_fee > 0 then
    insert into public.invoice_line_items(id, invoice_id, description, quantity, unit_amount, amount)
    values ('line_' || gen_random_uuid()::text, invoice_id_value, 'Kongila service fee', 1, service_fee, service_fee);
  end if;
  update public.contracts set placement_fee_invoiced_at = now(), placement_activated_at = now(),
    placement_guarantee_months = guarantee_months_value,
    client_fee_pct_snapshot = fee_pct
  where id = c.id;
  return jsonb_build_object('invoice_id', invoice_id_value, 'already_invoiced', false,
    'client_id', c.client_id, 'talent_id', c.talent_id,
    'base_fee', base_fee, 'client_fee', service_fee, 'client_total', client_total,
    'guarantee_months', guarantee_months_value);
end
$fn$;
revoke all on function public.invoice_placement_activation(text,date) from public, anon, authenticated;
grant execute on function public.invoice_placement_activation(text,date) to service_role;

create or replace function public.invoice_completed_project_milestone(p_milestone_id text, p_due_date date)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  m public.project_milestones%rowtype;
  p public.projects%rowtype;
  c public.contracts%rowtype;
  invoice_id_value text;
  client_fee_pct numeric;
  talent_fee_pct numeric;
  base_value numeric;
  client_fee numeric;
  client_total numeric;
  net_value numeric;
begin
  select * into m from public.project_milestones where id = p_milestone_id for update;
  if not found then raise exception 'Milestone not found'; end if;
  if m.status <> 'completed' then raise exception 'Only a completed milestone can be invoiced'; end if;
  if m.invoice_id is not null then return jsonb_build_object('invoice_id',m.invoice_id,'already_invoiced',true); end if;
  select * into p from public.projects where id = m.project_id;
  select * into c from public.contracts where id = m.contract_id;
  select coalesce(c.client_fee_pct_snapshot, fc.client_fee_pct),
         coalesce(c.talent_commission_pct_snapshot, fc.talent_commission_pct)
    into client_fee_pct, talent_fee_pct
    from public.fee_config fc where fc.service_line = 'project';
  if client_fee_pct is null then client_fee_pct := c.client_fee_pct_snapshot; end if;
  if talent_fee_pct is null then talent_fee_pct := c.talent_commission_pct_snapshot; end if;
  if client_fee_pct is null or talent_fee_pct is null then raise exception 'Project margins are not configured'; end if;
  base_value := round(m.amount_usd, 2);
  client_fee := round(base_value * client_fee_pct, 2);
  client_total := base_value + client_fee;
  net_value := round(base_value * (1 - talent_fee_pct), 2);
  insert into public.invoices(id, invoice_number, client_id, contract_id, period, service_line,
    project_milestone_id, invoice_trigger, amount, subtotal_usd, tax_amount_usd,
    total_usd, total_amount_usd, platform_margin_usd, currency, usd_rate, status, due_date, created_at)
  values ('inv_' || gen_random_uuid()::text,
    'KNG-MILE-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text,1,6)),
    p.client_id, c.id, 'milestone-' || m.id, 'project', m.id, 'project_milestone',
    client_total, client_total, 0, client_total, client_total,
    client_total - net_value, 'USD', 1, 'draft', p_due_date, now())
  returning id into invoice_id_value;
  insert into public.invoice_line_items(id, invoice_id, description, quantity, unit_amount, amount)
  values ('line_' || gen_random_uuid()::text, invoice_id_value, 'Project milestone: ' || m.title, 1, base_value, base_value);
  if client_fee > 0 then
    insert into public.invoice_line_items(id, invoice_id, description, quantity, unit_amount, amount)
    values ('line_' || gen_random_uuid()::text, invoice_id_value, 'Kongila service fee', 1, client_fee, client_fee);
  end if;
  insert into public.talent_payouts(id, talent_id, contract_id, invoice_id, period, gross_amount,
    commission_pct, net_amount, amount, currency, usd_rate, net_amount_usd, status, created_at)
  values ('payout_' || gen_random_uuid()::text, c.talent_id, c.id, invoice_id_value,
    'milestone-' || m.id, base_value, talent_fee_pct, net_value, net_value, 'USD', 1, net_value, 'pending', now());
  update public.project_milestones set status = 'invoiced', invoice_id = invoice_id_value where id = m.id;
  return jsonb_build_object('invoice_id', invoice_id_value, 'already_invoiced', false,
    'base_amount', base_value, 'client_fee', client_fee, 'client_total', client_total,
    'talent_gross', base_value, 'talent_commission_pct', talent_fee_pct, 'talent_net', net_value);
end
$fn$;
revoke all on function public.invoice_completed_project_milestone(text,date) from public, anon, authenticated;
grant execute on function public.invoice_completed_project_milestone(text,date) to service_role;

-- Admin edits replace draft lines atomically; issued invoices are immutable.
create or replace function public.update_draft_invoice(p_invoice_id text, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  inv public.invoices%rowtype;
  line jsonb;
  qty numeric;
  unit numeric;
  amount_total numeric := 0;
  line_amount numeric;
  payout_net numeric := 0;
  last_sequence integer;
  instalment_total numeric := 0;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status <> 'draft' then raise exception 'Only a draft invoice can be edited'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'At least one invoice line is required'; end if;
  for line in select * from jsonb_array_elements(p_lines) loop
    qty := (line->>'quantity')::numeric;
    unit := (line->>'unit_amount')::numeric;
    if length(trim(coalesce(line->>'description',''))) = 0 or qty <= 0 or unit < 0 then
      raise exception 'Invoice lines need a description, positive quantity and non-negative amount';
    end if;
    line_amount := round(qty * unit, 2);
    amount_total := amount_total + line_amount;
  end loop;
  delete from public.invoice_line_items where invoice_id = inv.id;
  for line in select * from jsonb_array_elements(p_lines) loop
    qty := (line->>'quantity')::numeric;
    unit := (line->>'unit_amount')::numeric;
    insert into public.invoice_line_items(id, invoice_id, description, quantity, unit_amount, amount)
    values ('line_' || gen_random_uuid()::text, inv.id, trim(line->>'description'), qty, unit, round(qty * unit, 2));
  end loop;
  select coalesce(sum(net_amount),0) into payout_net from public.talent_payouts where invoice_id = inv.id;
  update public.invoices set amount = amount_total, subtotal_usd = amount_total, total_usd = amount_total,
    total_amount_usd = amount_total * coalesce(usd_rate,1),
    platform_margin_usd = amount_total - payout_net
  where id = inv.id;
  select max(sequence), coalesce(sum(amount),0) into last_sequence, instalment_total
    from public.invoice_instalments where invoice_id = inv.id;
  if instalment_total > 0 then
    update public.invoice_instalments part set amount = case
      when part.sequence = last_sequence then amount_total - (
        select coalesce(sum(round(amount_total * other.percent / 100, 2)),0)
        from public.invoice_instalments other
        where other.invoice_id = inv.id and other.sequence <> last_sequence
      )
      else round(amount_total * part.percent / 100, 2)
    end
    where part.invoice_id = inv.id;
    update public.invoices set
      amount_due_now = (select amount from public.invoice_instalments where invoice_id = inv.id order by sequence limit 1),
      next_due_amount = (select amount from public.invoice_instalments where invoice_id = inv.id order by sequence limit 1 offset 1)
    where id = inv.id;
  end if;
  return jsonb_build_object('invoice_id', inv.id, 'total', amount_total, 'platform_margin', amount_total - payout_net);
end
$fn$;
revoke all on function public.update_draft_invoice(text,jsonb) from public, anon, authenticated;
grant execute on function public.update_draft_invoice(text,jsonb) to service_role;

commit;
