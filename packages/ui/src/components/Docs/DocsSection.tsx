import { Accordion, AccordionProps, AccordionSummary, AccordionDetails, styled, Typography } from '@mui/material';

export type DocsSectionProps = AccordionProps & {
  title: string;
};

const Root = styled(Accordion)(() => ({
  borderRadius: 8,
  backgroundColor: '#CBCFFB33',
  overflow: 'hidden',

  '&:before': {
    display: 'none',
  },
}));

const Summary = styled(AccordionSummary)(() => ({}));

const Content = styled(AccordionDetails)(() => ({
  backgroundColor: '#F5F6FF',
}));

export const DocsSection = ({ title, children, ...props }: DocsSectionProps) => {
  return (
    <Root {...props} square disableGutters>
      <Summary>
        <Typography variant="subtitle1">{title}</Typography>
      </Summary>
      <Content>{children}</Content>
    </Root>
  );
};
