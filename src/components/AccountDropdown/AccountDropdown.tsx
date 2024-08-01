import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { NavLink } from 'react-router-dom';
import { AnalyticsId } from '@developer-console/analytics';
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
} from '@developer-console/ui';

import { useAccountStore } from '~/hooks';

export type AccountDropdownProps = {};

const AccountDropdown = () => {
  const account = useAccountStore();
  const [open, setOpen] = useState(false);

  if (!account.userInfo || !account.address) {
    return null;
  }

  return (
    <Dropdown open={open} onToggle={setOpen} label="Account" leftElement={<AvatarIcon />}>
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
            <Button component={NavLink} fullWidth variant="outlined" to="/top-up">
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
          onClick={() => account.disconnect()}
        >
          Log Out
        </Button>
      </Stack>
    </Dropdown>
  );
};

export default observer(AccountDropdown);
