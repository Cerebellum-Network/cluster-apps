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
