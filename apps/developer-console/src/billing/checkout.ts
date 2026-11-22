import type { CardSummary } from './api';

/**
 * The amount handed to Stripe Checkout, stashed across the redirect so the
 * success message that shows after the return can name it. sessionStorage
 * survives the redirect in the same tab; a blocked store just means the success
 * message falls back to a plain reload.
 *
 * Shared because the Checkout is started inside the Add funds dialog
 * (BillingPayments) but the return lands on /billing with the dialog closed, so
 * the page (Billing) handles it (#190 review).
 */
const CHECKOUT_KEY = 'dc-billing:checkout-amount';

export function saveCheckoutAmount(amount: number): void {
  try {
    sessionStorage.setItem(CHECKOUT_KEY, amount.toFixed(2));
  } catch {
    /* ignore: the success message falls back to a reload */
  }
}

/** Reads and clears the stashed amount; null when absent or storage is blocked. */
export function readCheckoutAmount(): number | null {
  try {
    const v = sessionStorage.getItem(CHECKOUT_KEY);
    sessionStorage.removeItem(CHECKOUT_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

// ── Replace card ─────────────────────────────────────────────────────────────


const CARD_KEY = 'dc-billing:card-before';

/** A card as one comparable string; '' for no card. */
export const cardSignature = (c: CardSummary | null): string =>
  c ? [c.brand, c.last4, c.exp_month, c.exp_year].map((v) => v ?? '').join('|') : '';

/** Stash the card on file before leaving for Stripe, so the return can tell when the new one has landed. */
export function saveCardBefore(card: CardSummary | null): void {
  try {
    sessionStorage.setItem(CARD_KEY, cardSignature(card));
  } catch {
    /* ignore: the return then trusts any card it sees */
  }
}

/** Reads and clears the stashed card; null when absent or storage is blocked. */
export function readCardBefore(): string | null {
  try {
    const v = sessionStorage.getItem(CARD_KEY);
    sessionStorage.removeItem(CARD_KEY);
    return v;
  } catch {
    return null;
  }
}

/**
 * Back from Stripe at `?checkout=card`, the card on file changes only once the
 * PSP webhook lands, which can be after the return:
 * - `saving` until the profile shows a different card than before;
 * - `updated` once it does;
 * - `slow` when the reload poll ended with no change.
 * `now` is undefined while the profile hasn't loaded. With no stashed card
 * (`before` null: storage blocked, or another tab) any card counts as the new one.
 */
export function cardReturnStatus(before: string | null, now: CardSummary | null | undefined, pollDone: boolean): 'saving' | 'updated' | 'slow' {
  if (now) {
    const sig = cardSignature(now);
    if (before === null || sig !== before) return 'updated';
  }
  return pollDone ? 'slow' : 'saving';
}
