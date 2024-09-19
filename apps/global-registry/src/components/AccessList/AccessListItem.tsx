import { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { format, formatRelative } from 'date-fns';
import { AuthToken, AuthTokenOperation } from '@cere-ddc-sdk/ddc-client';
import { AccessRegistryEntity } from '@cluster-apps/api';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  IconButton,
  Stack,
  styled,
  Typography,
  ContextMenuIcon,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  EditIcon,
  RevokeAccessIcon,
  Truncate,
} from '@cluster-apps/ui';

export type AccessListItemProps = {
  access: AccessRegistryEntity;
  expanded?: boolean;
  onRequestEdit?: (access: AccessRegistryEntity) => void;
  onRequestExpand?: (access: AccessRegistryEntity, expanded: boolean) => void;
  onRequestRevoke?: (access: AccessRegistryEntity) => void;
};

const Item = styled(Accordion)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
}));

const ItemSummary = styled(AccordionSummary)(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(1),
}));

const Label = styled(Typography)(() => ({
  width: 120,
}));

const Value = styled(Typography)(() => ({
  wordBreak: 'break-word',
  flex: 1,
}));

const operationsMap = {
  [AuthTokenOperation.GET]: 'Read',
  [AuthTokenOperation.PUT]: 'Write',
  [AuthTokenOperation.DELETE]: 'Delete',
  [AuthTokenOperation.UNKNOWN]: 'Unknown',
};

const AccessListItem = ({ access, expanded, onRequestExpand, onRequestEdit, onRequestRevoke }: AccessListItemProps) => {
  const [menu, setMenu] = useState<HTMLButtonElement>();
  const accessToken = useMemo(() => AuthToken.maybeToken(access.accessToken)!, [access]);
  const expiresAt = useMemo(() => format(accessToken.expiresAt, 'MMMM do, yyyy, h:mm a'), [accessToken]);
  const operations = useMemo(() => accessToken.operations.map((op) => operationsMap[op]).join(', '), [accessToken]);

  return (
    <Item disableGutters expanded={expanded} onChange={(_event, expanded) => onRequestExpand?.(access, expanded)}>
      <ItemSummary>
        <Stack direction="row" spacing={1} alignSelf="center">
          <Typography>Bucket: </Typography>
          <Typography fontWeight="bold">{access.bucketId.toString()}</Typography>
          <Typography variant="body2" color="text.secondary">
            ({operations})
          </Typography>

          <Typography variant="body2">
            - <Truncate variant="hex" maxLength={8} text={access.accountId} />
          </Typography>
        </Stack>

        <Typography marginLeft="auto" variant="caption" color="text.secondary" noWrap alignSelf="center">
          Updated {formatRelative(access.createdAt, new Date())}
        </Typography>

        <Box marginLeft={1} onClick={(event) => event.stopPropagation()}>
          <IconButton onClick={(event) => setMenu(event.currentTarget)}>
            <ContextMenuIcon />
          </IconButton>

          <Menu
            anchorEl={menu}
            open={!!menu}
            onClose={() => setMenu(undefined)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem
              onClick={() => {
                onRequestEdit?.(access);
                setMenu(undefined);
              }}
            >
              <ListItemIcon>
                <EditIcon />
              </ListItemIcon>
              <ListItemText primary="Edit access" />
            </MenuItem>

            <MenuItem
              disabled
              onClick={() => {
                onRequestRevoke?.(access);
                setMenu(undefined);
              }}
            >
              <ListItemIcon>
                <RevokeAccessIcon />
              </ListItemIcon>
              <ListItemText color="text.error" primary="Revoke access" />
            </MenuItem>
          </Menu>
        </Box>
      </ItemSummary>
      <AccordionDetails>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1}>
            <Label>Account:</Label>
            <Value>{accessToken.subject}</Value>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Label>Can delegate:</Label>
            <Value>{accessToken.canDelegate ? 'Yes' : 'No'}</Value>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Label>Operations:</Label>
            <Value>{operations}</Value>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Label>Expiration:</Label>
            <Value>{expiresAt}</Value>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Label>Access token:</Label>
            <Value variant="caption">{access.accessToken}</Value>
          </Stack>
        </Stack>
      </AccordionDetails>
    </Item>
  );
};

export default observer(AccessListItem);
