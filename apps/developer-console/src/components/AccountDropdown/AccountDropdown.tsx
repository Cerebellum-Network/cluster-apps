import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { NavLink } from 'react-router-dom';
import { AnalyticsId } from '@cluster-apps/analytics';
import { Dropdown, AvatarIcon, Box, Stack, Truncate, Button, Typography } from '@cluster-apps/ui';

import { useAccountStore } from '~/hooks';
import { useSession } from '~/wallet/session';
import { useBalance } from '~/billing/useBilling';
import { money } from '~/billing/format';
import { elementsRendered } from '../ApplicationTour';

export type AccountDropdownProps = {};

const Row = ({ label, value }: { label: string; value: string }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={600} color="text.primary">
      {value}
    </Typography>
  </Stack>
);

const AccountDropdown = () => {
  const account = useAccountStore();
  const session = useSession();
  const balance = useBalance();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    elementsRendered.initialScreen = true;

    return () => {
      elementsRendered.initialScreen = false;
    };
  }, []);

  if (!account.address) {
    return null;
  }

  const handleClose = () => setOpen(false);
  const usdBalance = balance.loading && balance.data == null ? '…' : money(balance.data);

  return (
    <Dropdown
      variant="header"
      open={open}
      onToggle={setOpen}
      label={account.email || 'Account'}
      leftElement={<AvatarIcon />}
    >
      <Stack spacing={2} width={260} paddingY={1}>
        {/* Who you are */}
        <Stack spacing={0.25}>
          <Typography variant="caption" color="text.secondary">
            Signed in as
          </Typography>
          {account.email && (
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {account.email}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            <Truncate variant="hex" maxLength={8} text={account.address} />
          </Typography>
        </Stack>

        {/* Balance — one USD balance (the mockup's), from payment-service. A direct
            CERE deposit stays as a minor link. "Add funds" opens the Add funds
            dialog on the Billing page (#190/#192 review). */}
        <Stack spacing={1} padding={1.5} border={(theme) => `1px solid ${theme.palette.divider}`} borderRadius={2}>
          <Row label="Balance" value={usdBalance} />
          <Button component={NavLink} fullWidth to="/billing?add=1" onClick={handleClose}>
            Add funds
          </Button>
          <Button
            component={NavLink}
            size="small"
            variant="text"
            color="secondary"
            to="/top-up"
            onClick={handleClose}
            sx={{ alignSelf: 'center', textTransform: 'none' }}
          >
            Add CERE directly
          </Button>
        </Stack>

        {/* Links */}
        <Button component={NavLink} variant="outlined" color="secondary" fullWidth to="/billing" onClick={handleClose}>
          Billing
        </Button>

        <Box borderTop={(theme) => `1px solid ${theme.palette.divider}`} paddingTop={2}>
          <Button
            className={AnalyticsId.signOut}
            variant="text"
            color="secondary"
            fullWidth
            onClick={() => {
              session.signOut();
              handleClose();
            }}
          >
            Sign out
          </Button>
        </Box>
      </Stack>
    </Dropdown>
  );
};

export default observer(AccountDropdown);
