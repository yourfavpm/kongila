/**
 * Kon lives in @kongila/ui.
 *
 * It was built here first, then moved to the shared package so the admin
 * portal could use the same mascot rather than a second copy that drifts.
 * This file stays as the local name every page in this app already imports,
 * so the move cost no call sites.
 */

export { Mascot, Mascot as default } from '@kongila/ui';
export type { MascotState, MascotTone, MascotProps } from '@kongila/ui';
