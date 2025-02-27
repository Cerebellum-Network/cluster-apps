import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { NavLink } from 'react-router-dom';
import { AnalyticsId } from '@cluster-apps/analytics';
import {
  Dropdown,
  AvatarIcon,
  Stack,
  Truncate,
  Button,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Typography,
  InfoOutlinedIcon,
} from '@cluster-apps/ui';

import { useAccountStore } from '~/hooks';
import { elementsRendered } from '../ApplicationTour';

export type AccountDropdownProps = {};

const AccountDropdown = () => {
  const account = useAccountStore();
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

  return (
    <Dropdown variant="header" open={open} onToggle={setOpen} label="Account" leftElement={<AvatarIcon />}>
      <Stack spacing={2} width={240}>
        <Card variant="outlined" size="small">
          <CardHeader
            title="Cere Wallet"
            action={
              <Typography variant="body2" fontWeight="bold" color="text.primary">
                <Truncate variant="hex" maxLength={8} text={account.address} />
              </Typography>
            }
          />
          <CardContent>
            <Typography fontWeight="bold">{account.balance === undefined ? '-' : `${account.balance} CERE`}</Typography>
          </CardContent>
        </Card>

        <Card variant="outlined" size="small">
          <CardHeader avatar={<InfoOutlinedIcon />} title="DDC Wallet" />
          <CardContent>
            <Typography fontWeight="bold">{account.deposit === undefined ? '-' : `${account.deposit} CERE`}</Typography>
          </CardContent>
          <CardActions>
            <Button component={NavLink} fullWidth variant="outlined" to="/top-up" onClick={handleClose}>
              Top Up
            </Button>
          </CardActions>
        </Card>

        <Card variant="outlined" size="small">
          <CardHeader title="Current Package" />
          <CardContent>
            <Typography fontWeight="bold">Starter Pack</Typography>
          </CardContent>
          {/* <CardActions>
            <Button fullWidth variant="outlined" color="success">
              Upgrade
            </Button>
          </CardActions> */}
        </Card>

        <Button
          className={AnalyticsId.signOut}
          variant="outlined"
          color="secondary"
          onClick={() => {
            account.disconnect();
            handleClose();
          }}
        >
          Log Out
        </Button>
      </Stack>
    </Dropdown>
  );
};

export default observer(AccountDropdown);
