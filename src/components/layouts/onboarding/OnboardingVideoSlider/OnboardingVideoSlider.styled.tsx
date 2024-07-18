import styled from '@emotion/styled';
import {Typography} from '@mui/material';

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

export const SlideTitle = styled(Typography)({
  color: '#FFF',
  fontFamily: 'Human Sans',
  fontSize: '34px',
  fontWeight: '500',
  textAlign: 'center',
  lineHeight: '130%',
  letterSpacing: '-0.17px',
});

export const SlideDescription = styled(Typography)({
  color: '#FFF',
  textAlign: 'center',
  fontFamily: 'Human Sans',
  fontSize: '16px',
  fontWeight: '500',
  lineHeight: '150%',
  letterSpacing: '0.08px',
});
