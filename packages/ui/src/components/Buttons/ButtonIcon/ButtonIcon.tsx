import { styled } from '@mui/material/styles';
import { IconButton, IconButtonProps } from '@mui/material';
import { ReactElement } from 'react';

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.primary.main,
  borderRadius: '8px',
  border: '1px solid #E6E6E6',
}));

interface ButtonIconProps extends IconButtonProps {
  icon: ReactElement;
}

export const ButtonIcon = ({ icon, sx, ...props }: ButtonIconProps) => {
  return (
    <StyledIconButton sx={sx} {...props}>
      {icon}
    </StyledIconButton>
  );
};
