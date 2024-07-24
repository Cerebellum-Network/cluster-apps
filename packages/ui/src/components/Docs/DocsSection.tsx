import { Accordion, AccordionProps, AccordionSummary, AccordionDetails, styled, Typography, Box } from '@mui/material';
import { ReactNode } from 'react';

export type DocsSectionProps = Omit<AccordionProps, 'children'> & {
  children?: ReactNode;
  title: string;
  rightSection?: ReactNode;
};

const Root = styled(Accordion)(() => ({
  borderRadius: 8,
  backgroundColor: '#CBCFFB33',
  overflow: 'hidden',

  '&:before': {
    display: 'none',
  },
}));

const Summary = styled(AccordionSummary)(() => ({
  '.MuiAccordionSummary-content': {
    alignItems: 'center',
  },
}));

const Content = styled(AccordionDetails)(() => ({
  backgroundColor: '#F5F6FF',
}));

const RightSection = styled(Box)(() => ({
  marginLeft: 'auto',
}));

export const DocsSection = ({ title, children, rightSection, ...props }: DocsSectionProps) => {
  return (
    <Root {...props} square disableGutters>
      <Summary>
        <Typography variant="subtitle1">{title}</Typography>
        {rightSection && <RightSection>{rightSection}</RightSection>}
      </Summary>
      {!rightSection && children && <Content>{children}</Content>}
    </Root>
  );
};
