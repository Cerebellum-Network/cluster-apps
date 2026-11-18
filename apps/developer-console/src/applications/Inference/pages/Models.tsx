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
import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useModels } from '~/inference/useInference';
import { useBalance } from '~/billing/useBilling';
import { usd } from '~/billing/format';
import { PageHeader, Section } from '~/components';
import { atCapacityNotice, taskLabel, type ModelCard, type StatusTone } from '~/inference/model';
import type { GatewayModelStatus } from '~/inference/gateway';
import ShowMeHowDialog from '../ShowMeHowDialog';

const TONE_COLOR: Record<StatusTone, string> = {
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  neutral: '#9e9e9e',
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

const Hero = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(3),
  flexWrap: 'wrap',
  padding: theme.spacing(3, 4),
  borderRadius: 12,
  backgroundColor: '#1e1b3f',
  color: '#fff',
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
  const [howOpen, setHowOpen] = useState(false);

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
            <Typography variant="body2" color="text.secondary">
              {balance.loading ? 'Balance …' : `Balance ${usd(balance.data ?? 0)}`}
            </Typography>
          }
        />
      </Box>

      {/* Hero: create a key + call a model. */}
      <Hero marginBottom="16px">
        <Box minWidth={0}>
          <Typography variant="h4" sx={{ color: '#fff' }}>
            Create an API key and call any model from your laptop or app
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', marginTop: '6px' }}>
            Works with the OpenAI and Anthropic SDKs. Speech models take plain HTTP.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} flexShrink={0}>
          <Button
            variant="outlined"
            onClick={() => setHowOpen(true)}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: '#fff' } }}
          >
            Show me how
          </Button>
          <Button
            component={NavLink}
            to="/inference/keys"
            sx={{ backgroundColor: '#fff', color: '#1e1b3f', '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' } }}
          >
            Create API key
          </Button>
        </Stack>
      </Hero>

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
          sx={{ backgroundColor: '#fdf6e3', border: '1px solid #f0e4c0' }}
        >
          <Typography variant="body2">
            Add a card or CERE to start: you get $10 to try, then pay only for what you use.
          </Typography>
          <Button component={NavLink} to="/billing?add=1" sx={{ flexShrink: 0 }}>
            Add funds
          </Button>
        </Stack>
      )}

      {/* Plan line (informational; plans attach later). */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        marginBottom="20px"
        padding="12px 20px"
        borderRadius="12px"
        sx={{ backgroundColor: 'var(--i-chip, #f5f7fa)' }}
      >
        <Typography variant="body2" color="text.secondary">
          <strong style={{ color: 'var(--i-tx)' }}>Free:</strong> up to 8 requests at once across all models. Pro: 20 at
          once for $50 a month.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          See plans
        </Typography>
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
            {error}
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
          <TableContainer sx={{ '& td': { paddingTop: '16px', paddingBottom: '16px' } }}>
            <Table>
            <TableHead>
              <TableRow>
                <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>
                  {cards.length} models
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  Status is live
                </TableCell>
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
                    <Typography variant="body2" color="text.secondary">
                      {taskLabel(card.task)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <PriceCell card={card} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ color: TONE_COLOR[card.capacity.tone] }} title={card.capacity.detail || undefined}>
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

      <ShowMeHowDialog open={howOpen} onClose={() => setHowOpen(false)} cards={cards} />
    </Box>
  );
};

export default Models;
