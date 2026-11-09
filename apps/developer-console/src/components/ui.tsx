// Shared primitives, built to the values in the handoff's .dc.html files.
// Colours come from the --b-* tokens (tokens.css), so every piece follows the
// light/dark switch. Comments name the design element each one reproduces.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { styled } from '@mui/material/styles';

const MARK =
  'M 22.377 46.719 C 14.169 46.719 6.459 42.323 2.263 35.242 C 1.649 34.199 1.105 33.102 0.66 31.982 L 0.008 30.333 L 1.465 29.328 C 3.659 27.816 4.91 25.645 4.91 23.359 C 4.91 21.073 3.652 18.902 1.465 17.391 L 0 16.386 L 0.66 14.737 C 1.105 13.624 1.634 12.535 2.248 11.492 C 6.444 4.403 14.154 0 22.377 0 C 29.658 0 36.393 3.306 40.865 9.083 L 42.231 10.847 L 30.555 19.869 L 29.197 18.112 C 27.556 15.987 25.07 14.767 22.393 14.767 C 21.296 14.767 20.229 14.975 19.217 15.373 C 18.127 15.811 17.146 16.455 16.309 17.291 L 13.164 14.146 C 14.43 12.88 15.91 11.906 17.567 11.246 C 19.102 10.633 20.728 10.326 22.393 10.326 C 25.707 10.326 28.821 11.553 31.207 13.755 L 35.887 10.142 C 32.343 6.513 27.533 4.465 22.385 4.465 C 15.726 4.465 9.489 8.032 6.091 13.778 C 5.869 14.146 5.669 14.53 5.47 14.913 C 7.971 17.184 9.367 20.191 9.367 23.375 C 9.367 26.558 7.963 29.565 5.47 31.844 C 5.669 32.235 5.876 32.619 6.099 32.995 C 9.497 38.725 15.734 42.292 22.385 42.292 C 26.497 42.292 30.409 40.988 33.7 38.533 C 34.475 37.95 35.212 37.314 35.887 36.623 L 31.207 33.01 C 28.821 35.212 25.707 36.439 22.393 36.439 C 18.91 36.439 15.634 35.081 13.172 32.619 L 16.317 29.473 C 17.943 31.1 20.099 31.997 22.393 31.997 C 25.07 31.997 27.548 30.778 29.197 28.653 L 30.555 26.896 L 42.231 35.917 L 40.865 37.674 C 39.569 39.346 38.058 40.835 36.362 42.108 C 32.296 45.146 27.464 46.757 22.385 46.757 L 22.377 46.719 Z';

/** The Cere mark, rendered in violet. */
export function CereMark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 42.231 46.757" style={{ width: size, height: size, flex: 'none', color: 'var(--b-acc)' }} aria-hidden>
      <path d={MARK} fill="currentColor" />
    </svg>
  );
}

/** Overline: 10/800, letter-spacing 1px, uppercase. */
export const Overline = styled('div')({
  font: '800 10px/1 var(--font-sans)',
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: 'var(--b-tx2)',
});

/** Mono text with tabular figures. */
export const Mono = styled('span')({
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
});

/** Card: padding 20, radius 16, 1px line border. */
export const Card = styled('div')({
  padding: 20,
  borderRadius: 16,
  border: '1px solid var(--b-line)',
  background: 'var(--b-card)',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
});

// ── Pills ─────────────────────────────────────────────────────────────────
export type Tone = 'ok' | 'acc' | 'warn' | 'err' | 'chip';
const TONE: Record<Tone, [string, string]> = {
  ok: ['var(--b-ok-bg)', 'var(--b-ok-tx)'],
  acc: ['var(--b-acc-soft)', 'var(--b-acc-tx)'],
  warn: ['var(--b-warn-bg)', 'var(--b-warn-tx)'],
  err: ['var(--b-err-bg)', 'var(--b-err-tx)'],
  chip: ['var(--b-chip)', 'var(--b-tx2)'],
};

/** Status pill: 11/700, letter-spacing .04em, padding 3×8 (Settled, Estimated, Sent, …). */
export function StatusPill({ tone, children, pad = '3px 8px' }: { tone: Tone; children: ReactNode; pad?: string }) {
  const [bg, tx] = TONE[tone];
  return (
    <span
      style={{
        font: '700 11px/1 var(--font-sans)',
        letterSpacing: '.04em',
        padding: pad,
        borderRadius: 999,
        background: bg,
        color: tx,
        whiteSpace: 'nowrap',
        alignSelf: 'flex-start',
      }}
    >
      {children}
    </span>
  );
}

/** Tag pill: 10/700 uppercase, letter-spacing 1px, chip background (testnet, measured, current). */
export function TagPill({ children, pad = '4px 8px', accent = false }: { children: ReactNode; pad?: string; accent?: boolean }) {
  return (
    <span
      style={{
        font: '700 10px/1 var(--font-sans)',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        padding: pad,
        borderRadius: 999,
        background: accent ? 'var(--b-acc)' : 'var(--b-chip)',
        color: accent ? '#fff' : 'var(--b-tx2)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────
type Variant = 'primary' | 'secondary' | 'outline' | 'tertiary' | 'banner';
type Size = 'lg' | 'md' | 'sm' | 'xs';

const SIZE: Record<Size, CSSProperties> = {
  // Sign-in CTAs: 16/500, letter-spacing .8px, padding 14×24.
  lg: { font: '500 16px/1 var(--font-sans)', letterSpacing: '.8px', padding: '14px 24px' },
  // Card CTAs: 14/500, letter-spacing .5px, padding 12×20.
  md: { font: '500 14px/1 var(--font-sans)', letterSpacing: '.5px', padding: '12px 20px' },
  // Replace card / Sign out: padding 10×16.
  sm: { font: '500 14px/1 var(--font-sans)', letterSpacing: '.5px', padding: '10px 16px' },
  // Banner actions: 13/500, padding 8×12.
  xs: { font: '500 13px/1 var(--font-sans)', padding: '8px 12px' },
};

const VARIANT: Record<Variant, CSSProperties> = {
  primary: { border: '1px solid var(--b-acc)', background: 'var(--b-acc)', color: '#fff' },
  secondary: { border: '1px solid var(--b-acc)', background: 'transparent', color: 'var(--b-tx)' },
  outline: { border: '1px solid var(--b-line2)', background: 'transparent', color: 'var(--b-tx)' },
  tertiary: { border: '1px solid transparent', background: 'transparent', color: 'var(--b-acc-tx)' },
  banner: { border: '1px solid currentColor', background: 'transparent', color: 'inherit' },
};

const ButtonBase = styled('button')({
  borderRadius: 12,
  cursor: 'pointer',
  transition: 'background-color 160ms var(--ease-standard), border-color 160ms var(--ease-standard)',
  whiteSpace: 'nowrap',
  '&:focus-visible': { outline: '2px solid var(--b-acc)', outlineOffset: 2 },
  '&[data-variant="primary"]:hover:not(:disabled)': { background: 'var(--b-acc-hover)', borderColor: 'var(--b-acc-hover)' },
  '&[data-variant="secondary"]:hover:not(:disabled), &[data-variant="outline"]:hover:not(:disabled)': {
    background: 'var(--b-chip)',
  },
  '&:disabled': { cursor: 'default' },
});

// Disabled = the sign-in "Connecting…" look. Applied inline: the variant
// colours are inline too, and would win over a :disabled rule.
const DISABLED: CSSProperties = { border: '1px solid var(--b-line)', background: 'var(--b-line)', color: 'var(--b-tx3)' };

export function Btn({
  variant = 'primary',
  size = 'md',
  full = false,
  style,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  full?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <ButtonBase
      type="button"
      data-variant={variant}
      style={{
        ...SIZE[size],
        ...VARIANT[variant],
        ...(full ? { width: '100%' } : {}),
        ...style,
        ...(rest.disabled && variant !== 'tertiary' ? DISABLED : {}),
      }}
      {...rest}
    />
  );
}

/** A text link styled like the design's violet links ("All bills"). */
export const TextLink = styled('a')({
  font: '500 13px/1 var(--font-sans)',
  color: 'var(--b-acc-tx)',
  textDecoration: 'none',
  cursor: 'pointer',
  '&:hover': { textDecoration: 'underline' },
});

// ── Alerts and banners ────────────────────────────────────────────────────
const ALERT: Record<'warn' | 'err' | 'ok', { bg: string; bd: string; tx: string; fill: string }> = {
  warn: { bg: 'var(--b-warn-bg)', bd: 'var(--b-warn-bd)', tx: 'var(--b-warn-tx)', fill: 'var(--b-fill-warn)' },
  err: { bg: 'var(--b-err-bg)', bd: 'var(--b-err-bd)', tx: 'var(--b-err-tx)', fill: 'var(--b-fill-err)' },
  ok: { bg: 'var(--b-ok-bg)', bd: 'transparent', tx: 'var(--b-ok-tx)', fill: 'var(--b-fill-ok)' },
};

function AlertIcon({ tone }: { tone: 'warn' | 'err' | 'ok' }) {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: 99,
        background: ALERT[tone].fill,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '700 12px/1 var(--font-sans)',
        flex: 'none',
        marginTop: 1,
      }}
    >
      {tone === 'ok' ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        '!'
      )}
    </div>
  );
}

/** Alert / banner: radius 8, padding 12×14, 1px border, 20px round icon. */
export function Alert({
  tone,
  title,
  children,
  action,
  center = false,
}: {
  tone: 'warn' | 'err' | 'ok';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  center?: boolean;
}) {
  const t = ALERT[tone];
  return (
    <div
      role={tone === 'err' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: center || action ? 'center' : 'flex-start',
        flexWrap: 'wrap',
        padding: '12px 14px',
        borderRadius: 8,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        color: t.tx,
      }}
    >
      <AlertIcon tone={tone} />
      <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: title && children ? 2 : 0 }}>
        {title && <span style={{ font: '700 13px/1.3 var(--font-sans)' }}>{title}</span>}
        {children && <span style={{ font: title ? '400 12px/1.4 var(--font-sans)' : '400 13px/1.4 var(--font-sans)' }}>{children}</span>}
      </div>
      {action && <div style={{ display: 'flex', gap: 8 }}>{action}</div>}
    </div>
  );
}

// ── Loading ───────────────────────────────────────────────────────────────
/** Indeterminate bar: a violet 40% segment sliding (bslide). */
export function IndeterminateBar({ height = 3, seconds = 1.2 }: { height?: number; seconds?: number }) {
  return (
    <div style={{ height, borderRadius: 99, background: 'var(--b-skel)', overflow: 'hidden' }} role="progressbar">
      <div
        style={{
          width: '40%',
          height: '100%',
          background: 'var(--b-acc)',
          borderRadius: 99,
          animation: `bslide ${seconds}s var(--ease-standard) infinite`,
        }}
      />
    </div>
  );
}

/** Shimmer skeleton block (bshimmer, 1.4s). */
export function Skel({ w, h, r = 4, style }: { w: number | string; h: number; r?: number; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{ width: w, height: h, borderRadius: r, background: 'var(--b-skel)', animation: 'bshimmer 1.4s infinite', ...style }}
    />
  );
}

// ── Switch ────────────────────────────────────────────────────────────────
/** 40×22 switch: on #53b96a, off line2, 18px white knob; 40% opacity when disabled. */
export function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 99,
        border: 0,
        padding: 0,
        background: checked ? 'var(--b-switch-on)' : 'var(--b-line2)',
        position: 'relative',
        flex: 'none',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background-color 160ms var(--ease-standard)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: 99,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          transition: 'left 160ms var(--ease-standard)',
        }}
      />
    </button>
  );
}

// ── Hash with copy ────────────────────────────────────────────────────────
/**
 * A transaction hash, shortened, with a copy button. No explorer link yet:
 * the Cere explorer URL pattern is still to be confirmed.
 */
export function CopyHash({ hash, color = 'var(--b-acc-tx)' }: { hash: string; color?: string }) {
  const [copied, setCopied] = useState(false);
  const display = short(hash.startsWith('0x') ? hash : `0x${hash}`, 10, 4);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Mono style={{ font: '400 12px/1 var(--font-mono)', color }}>{display}</Mono>
      <button
        type="button"
        aria-label="Copy transaction hash"
        onClick={() => {
          navigator.clipboard?.writeText(hash).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        style={{ border: 0, background: 'transparent', padding: 2, cursor: 'pointer', color, display: 'inline-flex' }}
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </span>
  );
}

function short(s: string, head: number, tail: number) {
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

/** The centred message card used for empty / error / expired states. */
export function MessageCard({
  glyph,
  iconBg,
  iconTx,
  title,
  body,
  cta,
  onCta,
}: {
  glyph: string;
  iconBg: string;
  iconTx: string;
  title: string;
  body: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div
      style={{
        padding: '48px 24px',
        borderRadius: 16,
        border: '1px solid var(--b-line)',
        background: 'var(--b-card)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          background: iconBg,
          color: iconTx,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '700 20px/1 var(--font-sans)',
        }}
      >
        {glyph}
      </div>
      <div style={{ font: '500 20px/1.3 var(--font-sans)' }}>{title}</div>
      <div style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--b-tx2)', maxWidth: 420, textWrap: 'pretty' } as CSSProperties}>
        {body}
      </div>
      <Btn variant="primary" size="md" style={{ marginTop: 8 }} onClick={onCta}>
        {cta}
      </Btn>
    </div>
  );
}
