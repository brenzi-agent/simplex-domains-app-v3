import { ONE_YEAR } from '@app/utils/time'

// SNRC SimpleX link encoding config (issue #11).

// A simplex.contact / simplex.channel text record holds an ordered list of SMP
// server URLs encoded as a single string joined by this separator. It MUST stay
// in lockstep with the SNRC REST resolver's split helper
// (simplexmq/scripts/resolver/snrc-resolve.py).
export const SIMPLEX_LINK_SEPARATOR = ';'

// Max links per category shown/editable in the UI. Pinned to 1 until multi-link
// is supported across the whole stack (dApp ↔ resolver ↔ smp-server). Set back
// to 5 to re-enable multi-link once that's true — no other change is required.
export const SIMPLEX_MAX_LINKS = 1

// SimplexController's term bounds, in the 365-day years it counts in: a payable
// registration runs two to three years, a renewal adds at least one, and no
// payable renewal may push the expiry more than three years out.
export const MIN_REGISTRATION_SECONDS = 2 * ONE_YEAR
export const MAX_REGISTRATION_SECONDS = 3 * ONE_YEAR
export const MIN_RENEWAL_SECONDS = ONE_YEAR
export const MAX_EXPIRY_HORIZON_SECONDS = 3 * ONE_YEAR
