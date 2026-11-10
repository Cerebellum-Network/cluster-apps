// Card-brand marks for the payment-method tile (48×32, radius 6). The design's
// dashed "VISA" box is a placeholder; the handoff asks for real brand marks.

export function CardBrand({ brand }: { brand: string | null | undefined }) {
  const b = (brand ?? '').toLowerCase();
  const box = { width: 48, height: 32, borderRadius: 6, flex: 'none', display: 'block' } as const;

  if (b === 'visa') {
    return (
      <svg viewBox="0 0 48 32" style={box} role="img" aria-label="Visa">
        <rect width="48" height="32" rx="6" fill="#fff" stroke="var(--b-line)" />
        <text
          x="24"
          y="20.5"
          textAnchor="middle"
          fill="#1a1f71"
          style={{ font: 'italic 800 13px/1 Arial, Helvetica, sans-serif', letterSpacing: '.02em' }}
        >
          VISA
        </text>
      </svg>
    );
  }
  if (b === 'mastercard') {
    return (
      <svg viewBox="0 0 48 32" style={box} role="img" aria-label="Mastercard">
        <rect width="48" height="32" rx="6" fill="#fff" stroke="var(--b-line)" />
        <circle cx="19.5" cy="16" r="8" fill="#eb001b" />
        <circle cx="28.5" cy="16" r="8" fill="#f79e1b" />
        <path d="M24 9.38a8 8 0 0 1 0 13.24 8 8 0 0 1 0-13.24Z" fill="#ff5f00" />
      </svg>
    );
  }
  if (b === 'amex' || b === 'american_express') {
    return (
      <svg viewBox="0 0 48 32" style={box} role="img" aria-label="American Express">
        <rect width="48" height="32" rx="6" fill="#2e77bc" />
        <text x="24" y="20" textAnchor="middle" fill="#fff" style={{ font: '800 10px/1 Arial, Helvetica, sans-serif', letterSpacing: '.06em' }}>
          AMEX
        </text>
      </svg>
    );
  }
  return (
    <div
      style={{
        ...box,
        border: '1px dashed var(--b-line2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '700 10px/1 var(--font-sans)',
        letterSpacing: '.06em',
        color: 'var(--b-tx2)',
        textTransform: 'uppercase',
      }}
    >
      {(brand ?? 'card').slice(0, 5)}
    </div>
  );
}
