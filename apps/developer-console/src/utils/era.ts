/**
 * Calculate Era ID based on timestamp, period duration, and offset
 *
 * @param timestampMs - Timestamp in milliseconds
 * @param periodDuration - Period duration in milliseconds
 * @param periodOffset - Period offset
 * @returns Calculated Era ID
 */
export function calculateEraId(timestampMs: number, periodDuration: number, periodOffset: number): number {
  return Math.floor(timestampMs / periodDuration) + periodOffset;
}

/**
 * Calculate Payment Era ID from TCA Era ID
 *
 * @param tcaEraId - TCA Era ID
 * @param tcaEraDuration - TCA Era Duration in milliseconds
 * @param paymentEraDuration - Payment Era Duration in milliseconds
 * @returns Payment Era ID
 */
export function paymentEraIdFromTcaEraId(tcaEraId: number, tcaEraDuration: number, paymentEraDuration: number): number {
  const timestampMs = tcaEraId * tcaEraDuration;
  return calculateEraId(timestampMs, paymentEraDuration, 0);
}

/**
 * Calculate the first TCA timestamp in milliseconds from a Payment Era ID
 *
 * @param paymentEraId - Payment Era ID
 * @param tcaEraDuration - TCA Era Duration in milliseconds
 * @param paymentEraDuration - Payment Era Duration in milliseconds
 * @returns First TCA timestamp in milliseconds
 */
export function firstTcaTimestampMsFromPaymentEraId(
  paymentEraId: number,
  tcaEraDuration: number,
  paymentEraDuration: number,
): number {
  const tcaEraId = tcaEraIdsFromPaymentEraId(paymentEraId, tcaEraDuration, paymentEraDuration)[0];
  return tcaEraId * tcaEraDuration;
}

/**
 * Calculate TCA Era IDs from Payment Era ID
 *
 * @param paymentEraId - Payment Era ID
 * @param tcaEraDuration - TCA Era Duration in milliseconds
 * @param paymentEraDuration - Payment Era Duration in milliseconds
 * @returns Array of TCA Era IDs contained in the Payment Era
 */
export function tcaEraIdsFromPaymentEraId(
  paymentEraId: number,
  tcaEraDuration: number,
  paymentEraDuration: number,
): number[] {
  const startMs = paymentEraId * paymentEraDuration;
  const endMs = startMs + paymentEraDuration;

  const startTcaId = Math.floor(startMs / tcaEraDuration);
  const endTcaId = Math.floor(endMs / tcaEraDuration);

  const tcaIds: number[] = [];
  for (let i = startTcaId; i < endTcaId; i++) {
    tcaIds.push(i);
  }

  return tcaIds;
}

/**
 * Get current TCA ID and Payment Era ID based on environment settings
 *
 * @param environment - 'devnet' or 'qanet'
 * @returns Object containing current TCA ID and Payment Era ID
 */
export function getCurrentEraIds(environment: 'devnet' | 'qanet' = 'devnet'): {
  currentTcaId: number;
  currentPaymentEraId: number;
} {
  // Duration settings based on environment
  const tcaEraDuration = 60 * 1000; // 1 minute in milliseconds
  const paymentEraDuration =
    environment === 'devnet'
      ? 20 * 60 * 1000 // 20 minutes for devnet
      : 60 * 60 * 1000; // 1 hour for qanet

  const currentTimestampMs = Date.now();
  const currentTcaId = Math.floor(currentTimestampMs / tcaEraDuration);
  const currentPaymentEraId = paymentEraIdFromTcaEraId(currentTcaId, tcaEraDuration, paymentEraDuration);

  return {
    currentTcaId,
    currentPaymentEraId,
  };
}
