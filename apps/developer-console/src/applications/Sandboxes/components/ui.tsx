import { ReactNode } from 'react';
import { Alert, Box, Button, Stack, Typography, styled } from '@cluster-apps/ui';
import { keyframes } from '@mui/material';
import { NavLink } from 'react-router-dom';

import { exitReasonInfo } from '~/compute/exitReasons';
import { endedBadly, type EgressDecision, type SandboxStatus } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';

/** Sandbox-specific colours, on top of the console tokens. */
export const sbColor = {
  starting: color.primary,
  running: color.success,
  terminated: color.textTertiary,
  failed: color.danger,
  unknown: color.warning,
  deniedTint: '#FDECEC',
  deniedText: '#A61B1B',
  credential: color.primaryDark,
  credentialTint: color.primaryTint,
  /** Terminal panel (the console's code surface). */
  termBg: color.codeBg,
  termText: color.codeText,
  termDim: '#8792A8',
  termErr: '#FF9C9C',
  termAccent: '#A5ADFF',
  termOk: '#7EE2A8',
  termWarn: '#FFC27A',
} as const;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(88, 101, 242, 0.45); }
  70% { box-shadow: 0 0 0 6px rgba(88, 101, 242, 0); }
  100% { box-shadow: 0 0 0 0 rgba(88, 101, 242, 0); }
`;

export const STATUS_LABEL: Record<SandboxStatus, string> = {
  starting: 'Starting',
  running: 'Running',
  terminated: 'Finished',
  failed: 'Failed',
  unknown: 'Node silent',
};

export const StatusDot = styled('span', { shouldForwardProp: (p) => p !== 'status' })<{ status: SandboxStatus }>(
  ({ status }) => ({
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
    backgroundColor: sbColor[status] ?? color.textTertiary,
    ...(status === 'starting' && { animation: `${pulse} 1.2s ease-out infinite` }),
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  }),
);

/**
 * An exit reason in plain words ("Out of memory", "Memory reclaimed", "Token
 * expired"), with what happened and what to do in its tooltip; any other
 * reason as the node wrote it. `sb` adds the numbers (its limit, request,
 * peak) when the sandbox is at hand.
 */
export const ExitReason = ({ reason, sb }: { reason: string; sb?: Parameters<typeof exitReasonInfo>[1] }) => {
  const info = exitReasonInfo(reason, sb);
  const title = [info.detail, info.action].filter(Boolean).join(' ');
  return title ? (
    <Box component="span" title={title}>
      {info.label}
    </Box>
  ) : (
    <>{info.label}</>
  );
};

/**
 * Dot + word, for tables and headers. A sandbox that ended badly (out of
 * memory, memory reclaimed, lost, a non-zero exit) reads Failed, as the list's
 * Failed filter counts it, whatever status the API gives it.
 */
export const SandboxStatusLabel = ({ status: given, reason }: { status: SandboxStatus; reason?: string | null }) => {
  const status: SandboxStatus = endedBadly({ status: given, exit_reason: reason ?? null }) ? 'failed' : given;
  return (
    <Stack direction="row" alignItems="center" gap="8px" component="span">
      <StatusDot status={status} />
      <Typography
        component="span"
        title={
          status === 'unknown' ? 'The node has not reported for a while. The sandbox may still be running.' : undefined
        }
        sx={{ fontSize: 14, fontWeight: 600, color: status === 'terminated' ? color.textSecondary : sbColor[status] }}
      >
        {STATUS_LABEL[status] ?? status}
      </Typography>
      {reason && (
        <Typography component="span" sx={text.caption}>
          <ExitReason reason={reason} />
        </Typography>
      )}
    </Stack>
  );
};

/** Inline code-ish value: ids, hosts, paths, images. */
export const Mono = styled('span')({
  fontFamily: mono,
  fontSize: '0.92em',
  letterSpacing: '-0.01em',
});

/** The dark panel used for logs, exec output and agent output. */
export const Terminal = styled(Box)({
  backgroundColor: sbColor.termBg,
  color: sbColor.termText,
  fontFamily: mono,
  fontSize: 12.5,
  lineHeight: 1.6,
  borderRadius: 12,
  padding: '12px 14px',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});

const DECISION = {
  allowed: { label: 'Allowed', fg: color.success, bg: color.successTint },
  denied: { label: 'Denied', fg: sbColor.deniedText, bg: sbColor.deniedTint },
  error: { label: 'Upstream error', fg: color.warning, bg: color.warningTint },
  policy: { label: 'Rules changed', fg: color.primaryDark, bg: color.primaryTint },
} as const;

export const DecisionPill = ({ decision }: { decision: EgressDecision }) => {
  const d = DECISION[decision] ?? DECISION.error;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: d.fg,
        backgroundColor: d.bg,
      }}
    >
      {d.label}
    </Box>
  );
};

/** A credential the egress proxy added, by name only. */
export const CredentialChip = ({ name }: { name: string | null | undefined }) =>
  name ? (
    <Box
      component="span"
      title="Added by the egress proxy. The sandbox never sees the value."
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        height: 22,
        padding: '0 8px',
        borderRadius: '6px',
        fontFamily: mono,
        fontSize: '12px',
        whiteSpace: 'nowrap',
        color: sbColor.credential,
        backgroundColor: sbColor.credentialTint,
      }}
    >
      <KeyGlyph />
      {name}
    </Box>
  ) : (
    <Typography component="span" sx={{ ...text.caption, color: color.textTertiary }}>
      none
    </Typography>
  );

/** What a rule sends: its credential, or the credentials the sandbox picks per request (placeholders). */
export const RuleCredentials = ({ rule }: { rule: { credential?: string; placeholders?: string[] } }) =>
  rule.placeholders?.length ? (
    <Stack
      direction="row"
      gap="4px"
      alignItems="center"
      flexWrap="wrap"
      justifyContent="flex-end"
      title="The sandbox names one per request (cere:<name> in a header); the egress proxy swaps in its value."
    >
      <Typography component="span" sx={{ ...text.caption, marginRight: '2px' }}>
        per request
      </Typography>
      {rule.placeholders.map((n) => (
        <CredentialChip key={n} name={n} />
      ))}
    </Stack>
  ) : (
    <CredentialChip name={rule.credential ?? null} />
  );

export const KeyGlyph = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l8-8M16 7l3 3M14 9l2 2" />
  </svg>
);

/** Small key/value row for detail side panels. */
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <Stack
    direction="row"
    justifyContent="space-between"
    alignItems="baseline"
    gap={2}
    sx={{ padding: '7px 0', borderBottom: `1px solid ${color.grid}`, '&:last-of-type': { borderBottom: 'none' } }}
  >
    <Typography sx={{ ...text.secondary, flexShrink: 0 }}>{label}</Typography>
    <Box sx={{ fontSize: 14, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{children}</Box>
  </Stack>
);

/** A thin bar for "used of allocated". */
export const Meter = ({
  value,
  max,
  tone = color.primary,
  height = 6,
}: {
  value: number;
  max: number;
  tone?: string;
  height?: number;
}) => (
  <Box sx={{ height, borderRadius: height, backgroundColor: color.grid, overflow: 'hidden' }}>
    <Box
      sx={{
        height: '100%',
        width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%`,
        backgroundColor: tone,
        borderRadius: height,
        transition: 'width 600ms ease',
      }}
    />
  </Box>
);

/**
 * Use against a request and a limit: the track runs to the limit, the part up
 * to the request is shaded (guaranteed), a tick marks the request, and the
 * fill is the use. With no limit above the request (a gateway before limits)
 * it is a plain meter of the request.
 */
export const RangeMeter = ({
  value,
  request,
  limit,
  tone = color.primary,
  height = 6,
  label,
}: {
  value: number;
  request: number;
  limit: number;
  tone?: string;
  height?: number;
  /** Read by screen readers: what is measured, e.g. "Memory peak". */
  label?: string;
}) => {
  const max = Math.max(limit, request, 0);
  const pct = (v: number) => `${Math.min(100, max > 0 ? (v / max) * 100 : 0)}%`;
  const ranged = limit > request;
  return (
    <Box
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      sx={{ position: 'relative', height, borderRadius: height, backgroundColor: color.grid }}
    >
      {ranged && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            width: pct(request),
            borderRadius: `${height}px 0 0 ${height}px`,
            backgroundColor: `${tone}2E`,
          }}
        />
      )}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          width: pct(value),
          backgroundColor: tone,
          borderRadius: height,
          transition: 'width 600ms ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
      />
      {ranged && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: pct(request),
            top: -3,
            bottom: -3,
            width: 2,
            marginLeft: '-1px',
            borderRadius: 1,
            backgroundColor: color.text,
          }}
        />
      )}
    </Box>
  );
};

/** A page's "Bucket N" chip: every sandbox, secret and record on the page belongs to it. */
export const BucketChip = ({ bucketId }: { bucketId: string | null }) =>
  bucketId ? (
    <Box
      component="span"
      title="The bucket your access token is for: sandboxes, secrets and usage on these pages belong to it, and usage is metered to it. Agent definitions are kept in your storage buckets on the DDC S3 gateway instead."
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 26,
        padding: '0 10px',
        borderRadius: '999px',
        fontSize: 12,
        fontWeight: 600,
        border: `1px solid ${color.border}`,
        backgroundColor: color.surface,
        color: color.textSecondary,
        whiteSpace: 'nowrap',
      }}
    >
      Compute bucket {bucketId}
    </Box>
  ) : null;

/** The gateway's 403 when the bucket's owner has no balance (it checks on every call). */
export const isNoBalance = (error: string) => /insufficient balance/i.test(error);

/**
 * The gateway refused for balance: say what to do (top up, in Billing) with a
 * button, and keep its own words visible. The page keeps reading, so it fills
 * in by itself once the balance is there.
 */
export const NoBalance = ({ what, error }: { what: string; error: string }) => (
  <Alert
    severity="warning"
    action={
      <Button component={NavLink} to="/billing" variant="contained" size="small" sx={{ whiteSpace: 'nowrap' }}>
        Top up in Billing
      </Button>
    }
    sx={{ alignItems: 'center' }}
  >
    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Top up to see {what}.</Typography>
    <Typography sx={{ fontSize: 13 }}>
      The API answered “{error}”: it serves a bucket only while the bucket’s owner has a balance (the deposit on chain).
      Add funds in Billing; this page reads again by itself.
    </Typography>
  </Alert>
);

/** A failed read, in words, with the raw message as a tooltip; a refusal for balance says to top up. */
export const ReadError = ({ what, error }: { what: string; error: string }) =>
  isNoBalance(error) ? (
    <NoBalance what={what} error={error} />
  ) : (
    <Typography color="error" variant="body2" title={error}>
      Couldn’t read {what}: {error}
    </Typography>
  );
