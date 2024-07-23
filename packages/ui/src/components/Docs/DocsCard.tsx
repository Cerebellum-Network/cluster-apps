import { Card, CardProps, styled } from '@mui/material';

export type DocsCardProps = CardProps;

const StyledCard = styled(Card)(() => ({
  backgroundColor: '#F5F6FF', // Figure out with designer how to call this color and move to theme
}));

export const DocsCard = (props: DocsCardProps) => {
  return <StyledCard size="large" {...props} />;
};
