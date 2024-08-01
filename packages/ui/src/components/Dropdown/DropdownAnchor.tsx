import { forwardRef, ReactNode, Ref } from 'react';
import { Stack, styled, avatarClasses, Typography, Button } from '@mui/material';
import { ArrowDropUp, ArrowDropDown } from '@mui/icons-material';

export type DropdownAnchorProps = {
  open?: boolean;
  withArrow?: boolean;
  label?: ReactNode;
  leftElement?: ReactNode;
  onOpen?: () => void;
};

const Clickable = styled(Button)<{ open?: boolean; withArrow?: boolean }>(({ theme, open, withArrow }) => ({
  padding: 0,
  ...(!withArrow && {
    borderWidth: '1px',
    borderColor: open ? theme.palette.primary.main : 'transparent',
    borderStyle: 'solid',
    '&:hover': {
      borderColor: theme.palette.primary.main,
      backgroundColor: 'transparent',
    },
  }),
}));

const Anchor = styled(Stack)<{ withArrow?: boolean }>(({ theme, withArrow }) => ({
  height: 40,
  borderRadius: 25,
  padding: theme.spacing(1),
  color: theme.palette.text.secondary,
  backgroundColor: withArrow ? theme.palette.grey[200] : 'transparent',
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
  ({ open, withArrow, label, leftElement, onOpen, ...props }: DropdownAnchorProps, ref: Ref<HTMLButtonElement>) => (
    <Clickable ref={ref} {...props} color="inherit" variant="text" onClick={onOpen} open={open} withArrow={withArrow}>
      <Anchor spacing={1} direction="row" alignItems="stretch" withArrow={withArrow}>
        <Left>{leftElement}</Left>
        <Center variant="body1">{label}</Center>
        {withArrow && (open ? <ArrowDropUp /> : <ArrowDropDown />)}
      </Anchor>
    </Clickable>
  ),
);
