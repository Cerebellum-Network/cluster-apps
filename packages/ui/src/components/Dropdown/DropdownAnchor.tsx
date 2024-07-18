import { forwardRef, ReactNode, Ref } from 'react';
import { Stack, styled, avatarClasses, Typography, Button } from '@mui/material';
import { ArrowDropUp, ArrowDropDown } from '@mui/icons-material';

export type DropdownAnchorProps = {
  open?: boolean;
  label?: ReactNode;
  leftElement?: ReactNode;
  onOpen?: () => void;
};

const Clickable = styled(Button)({
  padding: 0,
});

const Anchor = styled(Stack)(({ theme }) => ({
  height: 40,
  borderRadius: 25,
  padding: theme.spacing(1),
  color: theme.palette.text.secondary,
  backgroundColor: theme.palette.grey[200],
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
  ({ open, label, leftElement, onOpen }: DropdownAnchorProps, ref: Ref<HTMLButtonElement>) => (
    <Clickable ref={ref} color="inherit" variant="text" onClick={onOpen}>
      <Anchor spacing={1} direction="row" alignItems="center">
        <Left>{leftElement}</Left>
        <Center variant="body1">{label}</Center>
        {open ? <ArrowDropUp /> : <ArrowDropDown />}
      </Anchor>
    </Clickable>
  ),
);
