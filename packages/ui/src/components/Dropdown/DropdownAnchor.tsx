import { forwardRef, ReactNode, Ref } from 'react';
import { Stack, styled, avatarClasses, Typography, Button } from '@mui/material';
import { ArrowDropUp, ArrowDropDown } from '@mui/icons-material';

export type DropdownAnchorProps = {
  open?: boolean;
  label?: ReactNode;
  leftElement?: ReactNode;
  onOpen?: () => void;
  variant?: 'header' | 'button';
};

const Clickable = styled(Button)({
  padding: 0,
});

const Anchor = styled(Stack)<{ variant?: DropdownAnchorProps['variant'] }>(({ theme, variant }) => ({
  height: 40,
  borderRadius: 25,
  padding: theme.spacing(1),
  color: theme.palette.text.secondary,
  backgroundColor: variant !== 'header' ? theme.palette.grey[200] : 'transparent',
  cursor: 'pointer',
}));

const Left = styled('div')(({ theme }) => ({
  [`& .${avatarClasses.root}`]: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: theme.palette.background.paper,
  },
}));

const Center = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.primary,
}));

export const DropdownAnchor = forwardRef(
  ({ open, label, leftElement, onOpen, variant, ...props }: DropdownAnchorProps, ref: Ref<HTMLButtonElement>) => (
    <Clickable ref={ref} {...props} color="inherit" variant="text" onClick={onOpen}>
      <Anchor variant={variant} spacing={1} direction="row" alignItems="stretch">
        <Left>{leftElement}</Left>
        <Center variant="body1">{label}</Center>
        {variant !== 'header' && (open ? <ArrowDropUp /> : <ArrowDropDown />)}
      </Anchor>
    </Clickable>
  ),
);
