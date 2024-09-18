import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Stack, Typography, AddCircleOutlinedIcon } from '@cluster-apps/ui';

import { ShareDialog } from '~/components';

const AccessList = () => {
  const [isDialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="h2" component="h1">
          Access List
        </Typography>

        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlinedIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Share Access
        </Button>
      </Stack>

      <ShareDialog open={isDialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
};

export default observer(AccessList);
