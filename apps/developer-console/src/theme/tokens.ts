/**
 * The console's design tokens: one place for every colour and text style a page
 * uses, so pages don't carry their own hex values or font sizes.
 *
 * Type scale: a money amount 28 bold, page title 22 bold, card and dialog
 * titles 18 bold, a card's main value 16 semibold, body 14, secondary 13,
 * captions and table headers 12.
 */
export const color = {
  primary: '#5865F2',
  /** Selected / filter-chip fill. */
  primaryTint: '#EEF0FE',
  primaryDark: '#3A45C4',
  text: '#1D1B20',
  /** Secondary text (13px and up). */
  textSecondary: '#5E5C6B',
  /** Tertiary: captions, axis labels, placeholders. */
  textTertiary: '#818083',
  border: '#E3E4EE',
  /** Chart gridlines and progress-bar tracks. */
  grid: '#EEEFF5',
  page: '#F5F7FA',
  surface: '#FFFFFF',
  /** Insets inside a card (details panel, balance box). */
  inset: '#FAFAFC',
  /** Neutral pill (Coming soon) and the active nav item. */
  neutralFill: '#ECEDF3',
  success: '#1C6B38',
  successTint: '#E6F4EA',
  warning: '#B4410C',
  /** Refusals because the model was full, not the account's limit. */
  warningSoft: '#F0B98F',
  warningTint: '#FDF0E6',
  danger: '#C62828',
  /** Code sample surface. */
  codeBg: '#0F1729',
  codeText: '#E2E8F0',
} as const;

/**
 * Series colours for charts by model, in rank order (most used first), the
 * same in every chart and table; `chartOther` is the folded "Other" series.
 */
export const chartPalette = ['#5b2bc9', '#2f7fd8', '#1f9e8f', '#e3892b', '#c2417a', '#8a6d00', '#9b7be8', '#3bb3a2', '#b4410c', '#5d7a99', '#6f8f1f', '#d95f8e'] as const;
export const chartOther = '#c9c5d3';

export const text = {
  /** A money amount that is the card's point (the balance). */
  amount: { fontSize: 28, lineHeight: '34px', fontWeight: 700, color: color.text },
  pageTitle: { fontSize: 22, lineHeight: '28px', fontWeight: 700, color: color.text },
  title: { fontSize: 18, lineHeight: '24px', fontWeight: 700, color: color.text },
  /** A card's main line (plan name, card on file). */
  value: { fontSize: 16, lineHeight: '22px', fontWeight: 600, color: color.text },
  body: { fontSize: 14, lineHeight: '20px' },
  secondary: { fontSize: 13, lineHeight: '18px', color: color.textSecondary },
  caption: { fontSize: 12, lineHeight: '16px', color: color.textSecondary },
  /** Small heading inside a card (table headers, panel labels). */
  label: { fontSize: 12, lineHeight: '16px', fontWeight: 600, color: color.textSecondary },
} as const;

export const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Height of compact page-header controls (period toggle, Refresh, selects). */
export const CONTROL_HEIGHT = 32;
