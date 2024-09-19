import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Stack, Typography, AddCircleOutlinedIcon } from '@cluster-apps/ui';

import { useRegistryStore } from '~/hooks';
import { ShareDialog, AccessList as List } from '~/components';
import { AccessRegistryEntity } from '@cluster-apps/api';

const AccessList = () => {
  const registry = useRegistryStore();
  const [open, setOpen] = useState(false);
  const [edited, setEdited] = useState<AccessRegistryEntity>();
  const [expanded, setExpanded] = useState<AccessRegistryEntity>();

  return (
    <>
      <Stack direction="row" justifyContent="space-between" marginBottom={4}>
        <Typography variant="h2" component="h1">
          Access List
        </Typography>

        <Button
          size="large"
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlinedIcon />}
          onClick={() => setOpen(true)}
        >
          Share Access
        </Button>
      </Stack>

      <List
        list={registry.list}
        loading={registry.isListLoading}
        expanded={expanded?.id}
        onRequestExpand={(item, expanded) => setExpanded(expanded ? item : undefined)}
        onRequestEdit={(item) => {
          setEdited(item);
          setOpen(true);
        }}
      />

      <ShareDialog
        access={edited}
        open={open}
        onClose={() => setOpen(false)}
        onExited={() => {
          setEdited(undefined);
        }}
        onSave={(item) => {
          setOpen(false);
          setExpanded(item);
        }}
      />
    </>
  );
};

export default observer(AccessList);
