import { ReactElement, ReactNode, cloneElement, useLayoutEffect, useMemo, useState } from 'react';
import { Popover, useTheme, alpha, PopoverProps, styled, Typography, Stack, Link } from '@mui/material';
import { useOnboarding } from '@cluster-apps/ui';

type StyleProps = {
  position?: 'left' | 'right' | 'top' | 'bottom';
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
    marginThreshold={10}
    anchorOrigin={{
      vertical: position === 'top' ? 'top' : position === 'bottom' ? 'bottom' : 'center',
      horizontal: position === 'left' ? -16 : position === 'right' ? 'right' : 'center',
    }}
    transformOrigin={{
      vertical: position === 'top' ? 'bottom' : position === 'bottom' ? 'top' : 'center',
      horizontal: position === 'left' ? 'right' : position === 'right' ? 'left' : 'center',
    }}
  />
))<StyleProps>(({ theme, position }) => ({
  '& .MuiPopover-paper': {
    maxWidth: 320,
    textAlign: 'left',
    overflow: 'visible',
    margin: 8,
    ...(position === 'left' && { marginRight: 16 }),
    ...(position === 'right' && { marginLeft: 16 }),
    ...(position === 'top' && { marginBottom: 16 }),
    ...(position === 'bottom' && { marginTop: 16 }),
  },

  '& .MuiPopover-paper::before': {
    content: "''",
    display: 'block',
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: theme.palette.background.paper,

    ...(position === 'left' && { right: 0, transform: 'skew(50deg, 0deg)', marginRight: -6, bottom: '50%' }),
    ...(position === 'right' && { left: 0, transform: 'skew(-50deg, 0deg)', marginLeft: -6, bottom: '50%' }),
    ...(position === 'top' && { bottom: 0, transform: 'skew(0deg, 50deg)', marginBottom: -6, left: '50%' }),
    ...(position === 'bottom' && { top: 0, transform: 'skew(0deg, -50deg)', marginTop: -6, left: '50%' }),
  },

  '& .MuiBackdrop-root': {
    backgroundColor: alpha(theme.palette.common.black, 0.3),
  },
}));

export const Hint = ({ open, title, content, position = 'right', children }: HintProps) => {
  const theme = useTheme();
  const uniqueId = useMemo(() => Math.random().toString(36).substring(7), []);
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);

  const { isOnboardingActive, stopOnboarding } = useOnboarding();

  const clone = cloneElement(children, {
    ['data-hint-id']: uniqueId,
    style: open ? { zIndex: theme.zIndex.modal + 1 } : {},
  });

  useLayoutEffect(() => {
    const element = document.querySelector(`[data-hint-id="${uniqueId}"]`);
    setAnchorEl(element);
  }, [uniqueId]);

  const styles =
    open && isOnboardingActive ? { zIndex: 2000, backgroundColor: 'white', padding: '10px', borderRadius: '8px' } : {};

  return (
    <>
      <div style={styles}>{clone}</div>

      <HintPopover
        open={isOnboardingActive && open && !!anchorEl}
        position={position}
        anchorEl={anchorEl}
        disableRestoreFocus
        disableAutoFocus
      >
        <Stack padding={2}>
          {title && <Typography variant="subtitle1">{title}</Typography>}
          {content && (
            <>
              <Typography component="div" variant="body2" color="text.secondary">
                {content}
              </Typography>
              <Link variant="body2" underline="none" component="button" onClick={stopOnboarding} textAlign="right">
                Skip
              </Link>
            </>
          )}
        </Stack>
      </HintPopover>
    </>
  );
};
