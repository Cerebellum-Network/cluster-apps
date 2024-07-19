import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Dropdown,
  Avatar,
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

  if (!account.isConnected()) {
    return null;
  }

  return (
    <Dropdown
      open={open}
      onToggle={setOpen}
      label={<Truncate text={account.userInfo.email} variant="email" maxLength={20} />}
      leftElement={<Avatar />}
    >
      <Stack spacing={2} width={240}>
        <Card variant="outlined">
          <CardHeader
            title="Cere Wallet"
            action={
              <Typography variant="body2" fontWeight="bold" color="text.primary">
                <Truncate variant="hex" maxLength={8} text={account.address} />
              </Typography>
            }
          />
          <CardContent>
            <Typography fontWeight="bold">{account.balance} CERE</Typography>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader avatar={<InfoOutlinedIcon />} title="DDC Wallet" />
          <CardContent>
            <Typography fontWeight="bold">0 CERE</Typography>
          </CardContent>
          <CardActions>
            <Button fullWidth variant="outlined">
              Top Up
            </Button>
          </CardActions>
        </Card>

        <Card variant="outlined">
          <CardHeader title="Current Package" />
          <CardContent>
            <Typography fontWeight="bold">Starter Pack</Typography>
          </CardContent>
          <CardActions>
            <Button fullWidth variant="outlined" color="success">
              Upgrade
            </Button>
          </CardActions>
        </Card>

        <Button variant="outlined" color="secondary" onClick={() => account.disconnect()}>
          Log Out
        </Button>
      </Stack>
    </Dropdown>
  );
};

export default observer(AccountDropdown);
