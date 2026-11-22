import { Box, Typography, Stack, Button, LoadingButton, IconButton, Alert } from '@cluster-apps/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Close, CreditCard, LockOutlined } from '@mui/icons-material';
import { useState } from 'react';

import { payment, type CardSummary } from '~/billing/api';
import { brandName } from '~/billing/format';
import { color, text } from '~/theme/tokens';

/**
 * Replace (or add) the card on file without charging it. The new card is entered
 * on Stripe Checkout in setup mode; back on `/billing?checkout=card` the page
 * confirms and reloads the profile. Separate from Add funds on purpose: changing
 * a card is not a payment.
 */
export function ReplaceCardDialog({
  open,
  account,
  card,
  onClose,
}: {
  open: boolean;
  /** Lowercase-hex, no 0x — the payment account key. */
  account: string;
  /** The card on file, or null when there is none ("Add card"). */
  card: CardSummary | null;
  onClose: () => void;
}) {
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = card ? 'Replace card' : 'Add card';

  const go = async () => {
    setRedirecting(true);
    setError(null);
    try {
      const url = await payment.replaceCard(account, `${window.location.origin}/billing`);
      window.location.assign(url);
    } catch (e) {
      setRedirecting(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const close = () => {
    if (redirecting) return;
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ paddingBottom: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          {title}
          <IconButton size="small" aria-label="Close" onClick={close}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing="16px">
          {card && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: `1px solid ${color.border}`,
                borderRadius: '12px',
                padding: '12px 14px',
              }}
            >
              <CreditCard sx={{ fontSize: 20, color: color.textSecondary }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                  {`${brandName(card.brand)} ···· ${card.last4 ?? '••••'}`}
                </Typography>
                {card.exp_month && card.exp_year && (
                  <Typography sx={text.secondary}>
                    {`Expires ${String(card.exp_month).padStart(2, '0')}/${card.exp_year}`}
                  </Typography>
                )}
              </Box>
              <Typography sx={text.secondary}>Current</Typography>
            </Box>
          )}
          <Typography variant="body2">
            {card
              ? 'Enter the new card on Stripe. It replaces this one for top-ups and auto top-up.'
              : 'Enter a card on Stripe. It is used for top-ups and auto top-up.'}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <LockOutlined sx={{ fontSize: 16, color: color.textSecondary }} />
            <Typography sx={text.secondary}>Nothing is charged now. Card details stay with Stripe.</Typography>
          </Stack>
          {error && <Alert severity="error">{`Couldn't open the card form. ${error}`}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ padding: '8px 24px 20px' }}>
        <Button variant="outlined" color="secondary" onClick={close} disabled={redirecting}>
          Cancel
        </Button>
        <LoadingButton variant="contained" onClick={go} loading={redirecting}>
          Continue to Stripe
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
