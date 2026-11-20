-- Keep an edited invoice's scheduled due amounts in sync with its new total.
-- Run after the 2026-11-19 offer margin billing migration.
begin;

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
    amount_total := amount_total + round(qty * unit, 2);
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
