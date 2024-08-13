import { Accordion, AccordionProps, AccordionSummary, AccordionDetails, styled, Typography, Box } from '@mui/material';
import { ChangeEvent, ReactNode, useState } from 'react';
import { trackEvent } from '@developer-console/analytics';
import { ToggleIconButton } from './ToggleIconButon.tsx';

export type DocsSectionProps = Omit<AccordionProps, 'children'> & {
  children?: ReactNode;
  title: string;
  rightSection?: ReactNode;
  analyticId?: string;
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
    justifyContent: 'space-between',
  },
}));

const Content = styled(AccordionDetails)(() => ({
  backgroundColor: '#F5F6FF',
}));

const RightSection = styled(Box)(() => ({
  marginLeft: 'auto',
}));

export const DocsSection = ({ title, children, rightSection, analyticId, ...props }: DocsSectionProps) => {
  const [expanded, setExpanded] = useState(false);

  const handleChange = (_: ChangeEvent<{}>, isExpanded: boolean) => {
    setExpanded(isExpanded);
    if (isExpanded && analyticId) {
      trackEvent(analyticId);
    }
  };

  return (
    <Root {...props} square disableGutters onChange={handleChange}>
      <Summary>
        <Typography variant="h4">{title}</Typography>
        {rightSection && <RightSection>{rightSection}</RightSection>}
        {!rightSection && <ToggleIconButton isExpanded={expanded} />}
      </Summary>
      {!rightSection && children && <Content>{children}</Content>}
    </Root>
  );
};
