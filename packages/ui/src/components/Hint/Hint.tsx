import { ReactElement, ReactNode, cloneElement, useLayoutEffect, useMemo, useState } from 'react';
import { Popover, useTheme, alpha, PopoverProps, styled, Typography, Stack } from '@mui/material';

type StyleProps = {
  position?: 'left' | 'right';
};

export type HintProps = Pick<PopoverProps, 'open'> &
  StyleProps & {
    title?: ReactNode;
    content?: ReactNode;
    children: ReactElement;
  };

const HintPopover = styled(({ position = 'right', ...props }: PopoverProps & StyleProps) => (
  <Popover
    {...props}
    disablePortal
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: position === 'left' ? -16 : 'right',
    }}
    transformOrigin={{
      vertical: 'bottom',
      horizontal: position === 'left' ? 'right' : 'left',
    }}
  />
))<StyleProps>(({ theme, position }) => ({
  '& .MuiPopover-paper': {
    maxWidth: 320,
    textAlign: 'left',
    overflow: 'visible',
    [position === 'left' ? 'marginRight' : 'marginLeft']: 16,
  },

  '& .MuiPopover-paper::before': {
    content: "''",
    display: 'block',
    position: 'absolute',
    bottom: 16,
    width: 12,
    height: 12,
    backgroundColor: theme.palette.background.paper,

    ...(position === 'left'
      ? { transform: 'skew(50deg, 0deg)', marginRight: -6, right: 0 }
      : { transform: 'skew(-50deg, 0deg)', marginLeft: -6 }),
  },

  '& .MuiBackdrop-root': {
    backgroundColor: alpha(theme.palette.common.black, 0.3),
  },
}));

export const Hint = ({ open, title, content, position = 'right', children }: HintProps) => {
  const theme = useTheme();
  const uniqueId = useMemo(() => Math.random().toString(36).substring(7), []);
  const [cloneNode, setCloneNode] = useState<Element | null>(null);

  const clone = cloneElement(children, {
    ['data-hint-id']: uniqueId,
    style: open ? { zIndex: theme.zIndex.modal + 1 } : {},
  });

  /**
   * We cannot use refs to get the node of the children because it is a clone.
   * We need to use `useLayoutEffect` to get the node of the children.
   *
   * TODO: Figure out a better way to get the node.
   */
  useLayoutEffect(() => setCloneNode(document.querySelector(`[data-hint-id="${uniqueId}"]`)), [uniqueId]);

  return (
    <>
      {clone}

      <HintPopover open={open && !!cloneNode} position={position} anchorEl={cloneNode}>
        <Stack padding={2}>
          {title && <Typography variant="subtitle1">{title}</Typography>}
          {content && (
            <Typography component="div" variant="body2" color="text.secondary">
              {content}
            </Typography>
          )}
        </Stack>
      </HintPopover>
    </>
  );
};
