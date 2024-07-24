import { PropsWithChildren, ReactNode } from 'react';
import { Card, CardHeader, styled } from '@mui/material';

export type DocsProps = PropsWithChildren<{
  icon: ReactNode;
  title: string;
  description: string;
}>;

const DocsCard = styled(Card)(() => ({
  backgroundColor: '#F5F6FF', // Figure out with designer how to call this color and move to theme
}));

export const Docs = ({ icon, title, description, children }: DocsProps) => {
  return (
    <DocsCard size="large">
      <CardHeader avatar={icon} title={title} subheader={description} />

      {children}
    </DocsCard>
  );
};
