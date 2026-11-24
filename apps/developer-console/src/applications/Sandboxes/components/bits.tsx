import { Fragment, ReactNode, useState } from 'react';
import { Box, Button, Stack, Typography, styled } from '@cluster-apps/ui';

import { color, mono, text } from '~/theme/tokens';
import { sbColor } from './ui';

/** Underlined text tabs, the same as the inference quickstart's. */
export const TabButton = styled('button', { shouldForwardProp: (p) => p !== 'active' })<{ active: boolean }>(
  ({ theme, active }) => ({
    appearance: 'none',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    padding: theme.spacing(1.25, 0),
    marginRight: theme.spacing(2.75),
    fontWeight: 600,
    fontSize: 14,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: active ? theme.palette.primary.main : theme.palette.text.secondary,
    borderBottom: `2px solid ${active ? theme.palette.primary.main : 'transparent'}`,
    '&:focus-visible': { outline: `2px solid ${color.primary}`, outlineOffset: 2, borderRadius: 2 },
  }),
);

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <Box role="tablist" display="flex" sx={{ overflowX: 'auto', borderBottom: `1px solid ${color.border}` }}>
      {tabs.map((t) => (
        <TabButton
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          active={value === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </TabButton>
      ))}
    </Box>
  );
}

/** Small count badge inside a tab label. */
export const Count = ({ n, tone = 'neutral' }: { n: number; tone?: 'neutral' | 'danger' }) => (
  <Box
    component="span"
    sx={{
      fontSize: 11,
      fontWeight: 700,
      minWidth: 18,
      height: 18,
      padding: '0 5px',
      borderRadius: 9,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: tone === 'danger' ? sbColor.deniedText : color.textSecondary,
      backgroundColor: tone === 'danger' ? sbColor.deniedTint : color.neutralFill,
    }}
  >
    {n}
  </Box>
);

const Code = styled('pre')({
  margin: 0,
  padding: '14px 16px',
  paddingRight: 84,
  borderRadius: 10,
  backgroundColor: color.codeBg,
  color: color.codeText,
  font: `12.5px/1.65 ${mono}`,
  overflowX: 'auto',
  whiteSpace: 'pre',
});

export function useCopy(): [boolean, (t: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (t: string) => {
    navigator.clipboard
      ?.writeText(t)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        /* clipboard blocked; the text is selectable */
      });
  };
  return [copied, copy];
}

export function CodeBlock({ code }: { code: string }) {
  const [copied, copy] = useCopy();
  return (
    <Box position="relative">
      <Box position="absolute" top={8} right={8}>
        <Button
          size="small"
          variant="outlined"
          color="secondary"
          onClick={() => copy(code)}
          sx={{ backgroundColor: color.surface, '&:hover': { backgroundColor: color.surface } }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Box>
      <Code>{code}</Code>
    </Box>
  );
}

/** Inline-only markdown: **bold** and `code`. */
function inline(s: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`'))
      return (
        <Box
          key={i}
          component="code"
          sx={{
            fontFamily: mono,
            fontSize: '0.9em',
            padding: '1px 5px',
            borderRadius: '4px',
            backgroundColor: color.neutralFill,
          }}
        >
          {p.slice(1, -1)}
        </Box>
      );
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/**
 * A small markdown renderer for agent output: headings, bullet and numbered
 * lists, paragraphs, inline bold and code. Enough for a status report.
 */
export function Markdown({ source }: { source: string }) {
  const lines = source.split('\n');
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    out.push(
      <Box
        key={out.length}
        component={Tag}
        sx={{ margin: '4px 0 10px', paddingLeft: '22px', '& li': { margin: '3px 0' } }}
      >
        {list.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Box>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*] (.*)$/.exec(line);
    const numbered = /^\s*\d+\. (.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = /^(#{1,3}) (.*)$/.exec(line);
    if (h) {
      out.push(
        <Typography
          key={out.length}
          sx={{
            fontSize: h[1].length === 1 ? 17 : 15,
            fontWeight: 700,
            margin: '12px 0 4px',
            '&:first-of-type': { marginTop: 0 },
          }}
        >
          {inline(h[2])}
        </Typography>,
      );
    } else {
      out.push(
        <Typography key={out.length} sx={{ ...text.body, margin: '4px 0 8px' }}>
          {inline(line)}
        </Typography>,
      );
    }
  }
  flush();
  return <Box sx={{ fontSize: 14, lineHeight: '21px', color: color.text }}>{out}</Box>;
}

/** Step header with a number, for real sequences only (quickstart steps). */
export const StepTitle = ({ no, title, done }: { no: number; title: string; done?: boolean }) => (
  <Stack direction="row" spacing={1.25} alignItems="center" marginBottom="10px">
    <Box
      component="span"
      sx={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
        color: done ? color.success : color.primaryDark,
        backgroundColor: done ? color.successTint : color.primaryTint,
      }}
    >
      {done ? '✓' : no}
    </Box>
    <Typography component="h3" sx={{ fontSize: 15, fontWeight: 700 }}>
      {title}
    </Typography>
  </Stack>
);
