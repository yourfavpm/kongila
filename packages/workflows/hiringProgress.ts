const SIGNED_CONTRACT_STATUSES = new Set(['fully_signed', 'active']);

export function requestedHeadcount(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function isSignedHireContract(contract: { status?: unknown }): boolean {
  return SIGNED_CONTRACT_STATUSES.has(String(contract.status));
}

export function countSignedHires(contracts: ReadonlyArray<{ status?: unknown }>): number {
  return contracts.filter(isSignedHireContract).length;
}

export function hasReachedHireTarget(
  numberOfHires: unknown,
  contracts: ReadonlyArray<{ status?: unknown }>
): boolean {
  return countSignedHires(contracts) >= requestedHeadcount(numberOfHires);
}

export function hasOfferCapacity(numberOfHires: unknown, offersInProgress: number): boolean {
  return offersInProgress < requestedHeadcount(numberOfHires);
}
