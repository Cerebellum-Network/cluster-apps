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

export type AccountDropdownProps = {};

const AccountDropdown = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dropdown
      open={open}
      onToggle={setOpen}
      label={<Truncate text="account@cere.io" variant="email" maxLength={20} />}
      leftElement={<Avatar />}
    >
      <Stack spacing={2} width={240}>
        <Card variant="outlined">
          <CardHeader
            title="Cere Wallet"
            action={
              <Typography variant="body2" fontWeight="bold" color="text.primary">
                <Truncate variant="hex" maxLength={8} text="5G23000J42F" />
              </Typography>
            }
          />
          <CardContent>
            <Typography fontWeight="bold">100 CERE</Typography>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader avatar={<InfoOutlinedIcon />} title="DDC Wallet" />
          <CardContent>
            <Typography fontWeight="bold">100 CERE</Typography>
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

        <Button variant="outlined" color="secondary">
          Log Out
        </Button>
      </Stack>
    </Dropdown>
  );
};

export default observer(AccountDropdown);
