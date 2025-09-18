import { styled } from '@cluster-apps/ui';

export const SliderDot = styled('div')({
  width: '8px',
  height: '8px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: '#FFF',
  cursor: 'pointer',
  transition: 'width 0.5s',
  '&.active': {
    width: '22px',
  },
});
