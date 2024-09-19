import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Stack, Typography, AddCircleOutlinedIcon } from '@cluster-apps/ui';

import { useRegistryStore } from '~/hooks';
import { ShareDialog, AccessList as List } from '~/components';

const AccessList = () => {
  const registry = useRegistryStore();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState<number>();

  return (
    <>
      <Stack direction="row" justifyContent="space-between" marginBottom={4}>
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

      <List
        list={registry.list}
        expanded={expanded}
        onRequestExpand={({ id }, expanded) => setExpanded(expanded ? id : undefined)}
      />
      <ShareDialog
        open={isDialogOpen}
        onClose={() => {
          setDialogOpen(false);
        }}
        onSave={({ id }) => {
          setExpanded(id);
          setDialogOpen(false);
        }}
      />
    </>
  );
};

export default observer(AccessList);
