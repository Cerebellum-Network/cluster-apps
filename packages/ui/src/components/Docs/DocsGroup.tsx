import { PropsWithChildren } from 'react';
import { CardContent, Stack, Typography } from '@mui/material';

export type DocsGroupProps = PropsWithChildren<{
  title: string;
}>;

export const DocsGroup = ({ title, children }: DocsGroupProps) => {
  return (
    <CardContent>
      <Stack spacing={2}>
        <Typography variant="h4">{title}</Typography>
        <Stack spacing={1}>{children}</Stack>
      </Stack>
    </CardContent>
  );
};
