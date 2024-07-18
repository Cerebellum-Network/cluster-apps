import { Stack, styled, svgIconClasses } from '@mui/material';
import { PropsWithChildren, ReactElement } from 'react';
import { CereIcon } from '../../icons';

type LogoSize = 'large' | 'medium' | 'small';

export type LogoProps = PropsWithChildren<{
  icon?: ReactElement;
  size?: LogoSize;
}>;

const sizesMap: Record<LogoSize, number> = {
  large: 38,
  medium: 32,
  small: 24,
};

const Container = styled(Stack)({
  [`& .${svgIconClasses.root}`]: {
    fontSize: 'inherit',
  },
});

export const Logo = ({ children, size = 'medium', icon = <CereIcon color="primary" /> }: LogoProps) => (
  <Container direction="row" alignItems="center" spacing={2} fontSize={sizesMap[size]}>
    {icon}
    {children && <Stack>{children}</Stack>}
  </Container>
);
