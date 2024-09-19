import { observer } from 'mobx-react-lite';
import { Stack } from '@cluster-apps/ui';
import { AccessRegistryEntity } from '@cluster-apps/api';

import AccessListItem, { AccessListItemProps } from './AccessListItem';

export type AccessListProps = Pick<AccessListItemProps, 'onRequestEdit'> & {
  list: AccessRegistryEntity[];
  loading?: boolean;
  expanded?: number;
  onRequestExpand?: (access: AccessListItemProps['access'], expanded: boolean) => void;
};

const AccessList = ({ list, expanded, ...props }: AccessListProps) => {
  return (
    <Stack spacing={1}>
      {list.map((access) => (
        <AccessListItem key={access.id} {...props} access={access} expanded={expanded === access.id} />
      ))}
    </Stack>
  );
};

export default observer(AccessList);
