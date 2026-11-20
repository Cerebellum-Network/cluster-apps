import {
  Box,
  Typography,
  Stack,
  CircularProgress,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  styled,
} from '@cluster-apps/ui';
import { useMemo } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { QuickstartDialog } from './Quickstart';

import { useModels } from '~/inference/useInference';
import { useBalance } from '~/billing/useBilling';
import { usd } from '~/billing/format';
import { PageHeader, Section, ComingSoon, Pill } from '~/components';
import { color, text } from '~/theme/tokens';
import { atCapacityNotice, taskLabel, type ModelCard, type StatusTone } from '~/inference/model';
import type { GatewayModelStatus } from '~/inference/gateway';

const TONE_COLOR: Record<StatusTone, string> = {
  success: color.success,
  warning: color.warning,
  error: color.danger,
  neutral: color.textTertiary,
};

const STATUS_TEXT: Record<GatewayModelStatus, string> = {
  available: 'Available',
  busy: 'Busy',
  saturated: 'Full right now',
  unavailable: 'Unavailable',
};

const Dot = styled('span', { shouldForwardProp: (p) => p !== 'tone' })<{ tone: StatusTone }>(({ tone }) => ({
  display: 'inline-block',
  width: 9,
  height: 9,
  borderRadius: '50%',
  backgroundColor: TONE_COLOR[tone],
  flexShrink: 0,
}));

function PriceCell({ card }: { card: ModelCard }) {
  if (!card.pricePerMillion) {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }
  return (
    <Box>
      <Typography variant="body2" fontWeight={600}>
        {card.pricePerMillion.amount}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {card.pricePerMillion.note}
      </Typography>
    </Box>
  );
}

const Models = () => {
  const { cards, loading, error, reload } = useModels();
  const balance = useBalance();
  // Get started opens as a dialog here; `?quickstart=1` deep-links to it.
  const [searchParams, setSearchParams] = useSearchParams();
  const quickstartOpen = searchParams.get('quickstart') === '1';
  const openQuickstart = () => {
    searchParams.set('quickstart', '1');
    setSearchParams(searchParams);
  };
  const closeQuickstart = () => {
    searchParams.delete('quickstart');
    setSearchParams(searchParams, { replace: true });
  };

  const sorted = useMemo(() => {
    const rank: Record<string, number> = { available: 0, busy: 1, saturated: 2, unavailable: 3 };
    return [...cards].sort(
      (a, b) => (rank[a.capacity.status] - rank[b.capacity.status]) || a.name.localeCompare(b.name),
    );
  }, [cards]);

  const notice = useMemo(
    () => atCapacityNotice(cards.filter((c) => c.capacity.status === 'saturated').map((c) => c.name)),
    [cards],
  );

  const hasBalance = (balance.data ?? 0) > 0;

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Models"
          actions={
            <Typography sx={text.secondary}>
              {balance.loading ? 'Balance …' : `Balance ${usd(balance.data ?? 0)}`}
            </Typography>
          }
        />
      </Box>

      {/* Get started: same card and type scale as the rest of the console. */}
      <Box marginBottom="16px">
        <Section
          title="Call a model from your laptop or app"
          actions={
            <Stack direction="row" spacing={1.5}>
              <Button component={NavLink} to="/inference/keys" variant="outlined" color="secondary">
                API keys
              </Button>
              <Button variant="contained" onClick={openQuickstart}>
                Get started
              </Button>
            </Stack>
          }
        >
          <Typography sx={text.secondary}>
            Works with the OpenAI and Anthropic SDKs, Claude Code, and editors like Cursor. Speech models take plain HTTP.
          </Typography>
        </Section>
      </Box>

      {/* Funds notice (no balance yet). */}
      {!balance.loading && !hasBalance && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
          marginBottom="16px"
          padding="14px 20px"
          borderRadius="12px"
          sx={{ backgroundColor: color.primaryTint, border: `1px solid ${color.border}` }}
        >
          <Typography variant="body2">
            Add a card or CERE to start: you get $10 to try, then pay only for what you use.
          </Typography>
          <Button component={NavLink} to="/billing?add=1" sx={{ flexShrink: 0 }}>
            Add funds
          </Button>
        </Stack>
      )}

      {/* Plan line (informational; paid plans attach later — #191 review: no
          hardcoded "Free"/"Pro", no dead "See plans" link). */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        marginBottom="20px"
        padding="0 22px"
      >
        <Typography sx={text.secondary}>
          Up to 8 requests at once across all models. Plans with higher limits are on the way.
        </Typography>
        <ComingSoon />
      </Stack>

      {notice && (
        <Typography variant="body2" sx={{ color: TONE_COLOR.error }} marginBottom="12px">
          {notice}
        </Typography>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" padding="40px">
          <CircularProgress size={24} />
        </Box>
      ) : error ? (
        <Stack spacing={1} alignItems="flex-start">
          <Typography color="error" variant="body2">
            The model list isn’t available right now. Try again in a moment.
          </Typography>
          <Button variant="outlined" color="secondary" onClick={reload}>
            Retry
          </Button>
        </Stack>
      ) : cards.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No models available.
        </Typography>
      ) : (
        <Section flush>
          <TableContainer sx={{ '& td': { paddingTop: '12px', paddingBottom: '12px' } }}>
            <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 24, paddingRight: 0 }} />
                <TableCell>{`${cards.length} models`}</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Price</TableCell>
                <TableCell align="right">Live status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((card) => (
                <TableRow key={card.id} hover>
                  <TableCell sx={{ width: 24, paddingRight: 0 }}>
                    <Dot tone={card.capacity.tone} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">{card.name}</Typography>
                    {card.hosting.external && (
                      <Typography variant="caption" sx={{ color: TONE_COLOR.warning }}>
                        Runs at {card.hosting.label.replace(/^External · /, '')}, outside Dragon 1
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Pill>{taskLabel(card.task)}</Pill>
                  </TableCell>
                  <TableCell>
                    <PriceCell card={card} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ color: TONE_COLOR[card.capacity.tone], fontWeight: 600 }} title={card.capacity.detail || undefined}>
                      {STATUS_TEXT[card.capacity.status]}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Section>
      )}

      <QuickstartDialog open={quickstartOpen} onClose={closeQuickstart} />
    </Box>
  );
};

export default Models;
