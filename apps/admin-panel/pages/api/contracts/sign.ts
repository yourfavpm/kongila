import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient, complianceGate } from '@kongila/database';
import { canTransitionRequest, coerceRequestStatus, explainTransition } from '@kongila/workflows';

/**
 * Records a contract as signed, and moves the request it belongs to into
 * Onboarding.
 *
 * Hired means a signed contract. Nothing moved a request to Onboarding, so
 * nothing could ever reach Hired and the client portal's Hired tab stayed
 * empty no matter what operations did. The pipeline advances from the
 * contract, not from an operator remembering to change a dropdown.
 *
 * The chain is contract → offer → request. A contract created from an
 * accepted offer carries offer_id, so the request is found rather than
 * guessed at.
 *
 * This is deliberately not e-signature. When real signing lands it should
 * call this, rather than reimplementing the pipeline move.
 */

/** Legal values, per contracts_status_check. 'signed' is not one of them. */
const SIGNED_STATUS = 'fully_signed';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn(`[contracts/sign] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  const { contractId, activate } = req.body || {};
  if (!contractId) return res.status(400).json({ error: 'contractId is required' });

  const supabase = getSupabaseClient();
  const warnings: string[] = [];

  try {
    const { data: contract, error: loadError } = await supabase
      .from('contracts')
      .select('id, status, offer_id, talent_id, client_id')
      .eq('id', contractId)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    if (['ended', 'terminated', 'closed'].includes(String(contract.status))) {
      return res.status(409).json({
        error: `This contract is ${contract.status} and cannot be signed.`
      });
    }

    // A contract is not marked signed for a candidate with outstanding
    // compliance documents.
    const refusal = await complianceGate('issue_contract', String(contract.talent_id));
    if (refusal) return res.status(409).json({ error: refusal });

    const now = new Date().toISOString();
    const nextStatus = activate ? 'active' : SIGNED_STATUS;

    const { error: updateError } = await supabase
      .from('contracts')
      .update({ status: nextStatus })
      .eq('id', contractId);

    if (updateError) {
      console.error('[contracts/sign] contract update failed:', updateError.message);
      return res.status(500).json({ error: `Could not sign the contract: ${updateError.message}` });
    }

    // ── Advance the request ───────────────────────────────────────────────────
    let requestMoved: { from: string; to: string } | null = null;

    if (contract.offer_id) {
      const { data: offer } = await supabase
        .from('offers')
        .select('id, request_id')
        .eq('id', contract.offer_id)
        .maybeSingle();

      if (offer?.request_id) {
        const { data: requestRows } = await supabase
          .from('talent_requests')
          .select('id, payload')
          .or(`id.eq.${offer.request_id},payload->>id.eq.${offer.request_id}`)
          .limit(1);

        const row = requestRows && requestRows[0];
        if (row) {
          const payload = row.payload || {};
          const from = coerceRequestStatus(payload.status);

          if (canTransitionRequest(from, 'Onboarding')) {
            const { error: reqError } = await supabase
              .from('talent_requests')
              .update({ payload: { ...payload, status: 'Onboarding' } })
              .eq('id', row.id);

            if (reqError) {
              warnings.push(`The contract is signed, but the request did not advance: ${reqError.message}`);
            } else {
              requestMoved = { from, to: 'Onboarding' };
            }
          } else {
            // Not fatal: the contract is signed either way, and an operator
            // can correct the pipeline. But say so rather than hide it.
            warnings.push(
              `The contract is signed, but the request was not advanced. ${explainTransition(from, 'Onboarding')}`
            );
          }
        } else {
          warnings.push('The contract is signed, but its request could not be found to advance.');
        }
      } else {
        warnings.push('The contract is signed, but its offer has no request to advance.');
      }
    } else {
      warnings.push(
        'The contract is signed. It was not created from an offer, so there is no request to advance.'
      );
    }

    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor: actor.email || actor.userId,
      action: activate ? 'Activate Contract' : 'Sign Contract',
      details:
        `Contract ${contractId} set to ${nextStatus}` +
        (requestMoved ? `; request moved ${requestMoved.from} to ${requestMoved.to}` : ''),
      timestamp: now
    });
    if (auditError) console.warn('[contracts/sign] audit entry not written:', auditError.message);

    return res.status(200).json({ ok: true, status: nextStatus, requestMoved, warnings });
  } catch (error: any) {
    console.error('[contracts/sign] unexpected failure:', error);
    return res.status(500).json({ error: error.message || 'Could not sign the contract' });
  }
}
