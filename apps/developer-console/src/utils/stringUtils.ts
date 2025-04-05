/**
 * Trunca una dirección de wallet Ethereum para mostrar en la UI
 * @param address Dirección completa del wallet
 * @param startChars Número de caracteres a mostrar al inicio
 * @param endChars Número de caracteres a mostrar al final
 * @returns Dirección truncada con formato "0xABC...XYZ"
 */
export function truncateAddress(
  address: string | undefined,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!address) return '';
  
  if (address.length <= startChars + endChars) {
    return address;
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Formatea un valor numérico con un símbolo de moneda
 * @param amount Cantidad a formatear
 * @param currency Símbolo de la moneda
 * @param decimals Número de decimales a mostrar
 * @returns Cantidad formateada con símbolo de moneda
 */
export function formatCurrency(
  amount: number,
  currency: string,
  decimals: number = 2
): string {
  // Obtener el símbolo de la moneda
  const symbol = getCurrencySymbol(currency);
  
  // Formatear el número con los decimales especificados
  const formattedAmount = amount.toFixed(decimals);
  
  // Devolver el formato adecuado según el símbolo
  if (symbol === '$' || symbol === '€') {
    return `${symbol}${formattedAmount}`;
  } else {
    return `${formattedAmount} ${symbol}`;
  }
}

/**
 * Obtiene el símbolo correspondiente a un código de moneda
 * @param currency Código de moneda (ej: 'USD', 'USDC')
 * @returns Símbolo de la moneda
 */
export function getCurrencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'USDC':
    case 'USDT':
      return currency.toUpperCase();
    case 'CERE':
      return 'CERE';
    default:
      return currency;
  }
} 