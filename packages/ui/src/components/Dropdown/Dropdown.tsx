import { Popover, PopoverProps } from '@mui/material';
import { ReactNode, Ref, useCallback, useRef } from 'react';

import { DropdownAnchor, DropdownAnchorProps } from './DropdownAnchor';

type RenderAnchorOptions = {
  ref: Ref<any>;
  open: boolean;
  onOpen: () => void;
};

export type DropdownProps = Pick<PopoverProps, 'open' | 'children'> &
  Omit<DropdownAnchorProps, 'open'> & {
    direction?: 'right' | 'left';
    dense?: boolean;
    disableGutters?: boolean;
    disablePaddings?: boolean;
    onToggle?: (open: boolean) => void;
    renderAnchor?: (options: RenderAnchorOptions) => ReactNode;
    variant: 'header' | 'button';
  };

export const Dropdown = ({
  open,
  label,
  leftElement,
  direction = 'left',
  children,
  onToggle,
  dense = false,
  disableGutters = false,
  disablePaddings = false,
  variant,
  renderAnchor = ({ ref, open, onOpen }) => (
    <DropdownAnchor ref={ref} open={open} label={label} leftElement={leftElement} onOpen={onOpen} variant={variant} />
  ),
}: DropdownProps) => {
  const anchorRef = useRef(null);
  const horizontal = direction === 'left' ? 'right' : 'left';
  const onOpen = useCallback(() => onToggle?.(true), [onToggle]);
  const padding = dense ? 1 : 2;

  return (
    <>
      {renderAnchor({ ref: anchorRef, onOpen, open })}
      <Popover
        aria-label="Overlay"
        open={open}
        onClose={() => onToggle?.(false)}
        anchorEl={anchorRef.current}
        anchorOrigin={{
          horizontal,
          vertical: 'bottom',
        }}
        transformOrigin={{
          horizontal,
          vertical: -8,
        }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              padding: disablePaddings ? 0 : padding,
              paddingX: !disablePaddings && disableGutters ? 0 : padding,
              borderRadius: 3,
              border: '1px solid #E7E8EB', // TODO: Use borders from theme
              boxShadow: '0px 4px 4px #1A0A7C1A;', // TODO: Use theme shadow
            },
          },
        }}
      >
        {children}
      </Popover>
    </>
  );
};
