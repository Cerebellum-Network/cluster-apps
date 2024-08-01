import { IconButton, styled, useTheme } from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { Transition, TransitionStatus } from 'react-transition-group';

const duration = 300;

const useIconStyles = () => {
  const theme = useTheme();
  return {
    defaultIcon: {
      fontSize: 40,
      color: theme.palette.primary.main,
    },
  };
};

const AnimatedIconWrapper = styled('span')<{ state: TransitionStatus }>(({ state }) => ({
  transition: `transform ${duration}ms ease-in-out`,
  display: 'inline-block',
  transform: state === 'entered' || state === 'entering' ? 'rotate(180deg)' : 'rotate(0deg)',
}));

const StyledIconButton = styled(IconButton)(() => ({
  padding: 0,
}));

export const ToggleIconButton = ({ isExpanded }: { isExpanded: boolean }) => {
  const classes = useIconStyles();

  return (
    <Transition in={isExpanded} timeout={duration}>
      {(state) => (
        <AnimatedIconWrapper state={state}>
          <StyledIconButton aria-label="toggle">
            {isExpanded ? <RemoveIcon sx={classes.defaultIcon} /> : <AddIcon sx={classes.defaultIcon} />}
          </StyledIconButton>
        </AnimatedIconWrapper>
      )}
    </Transition>
  );
};
