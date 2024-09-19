import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { format, formatRelative } from 'date-fns';
import { AuthToken, AuthTokenOperation } from '@cere-ddc-sdk/ddc-client';
import { AccessRegistryEntity } from '@cluster-apps/api';
import { Accordion, AccordionDetails, AccordionSummary, Stack, styled, Typography } from '@cluster-apps/ui';

export type AccessListItemProps = {
  access: AccessRegistryEntity;
  expanded?: boolean;
  onRequestEdit?: (access: AccessRegistryEntity) => void;
  onRequestExpand?: (access: AccessRegistryEntity, expanded: boolean) => void;
};

const Item = styled(Accordion)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
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

const AccessListItem = ({ access, expanded, onRequestExpand }: AccessListItemProps) => {
  const accessToken = useMemo(() => AuthToken.maybeToken(access.accessToken)!, [access]);
  const expiresAt = useMemo(() => format(accessToken.expiresAt, 'MMMM do, yyyy, h:mm a'), [accessToken]);
  const operations = useMemo(() => accessToken.operations.map((op) => operationsMap[op]).join(', '), [accessToken]);

  return (
    <Item disableGutters expanded={expanded} onChange={(_event, expanded) => onRequestExpand?.(access, expanded)}>
      <AccordionSummary>
        <Stack direction="row" spacing={1}>
          <Typography>Bucket: </Typography>
          <Typography fontWeight="bold">{access.bucketId.toString()}</Typography>
          <Typography variant="body2" color="text.secondary">
            ({operations})
          </Typography>
        </Stack>
        <Typography marginLeft="auto" variant="caption" color="text.secondary" noWrap alignSelf="center">
          Updated {formatRelative(access.createdAt, new Date())}
        </Typography>
      </AccordionSummary>
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
