import { Accordion, AccordionProps, AccordionSummary, AccordionDetails, styled, Typography, Box } from '@mui/material';
import { ChangeEvent, ReactNode, useState } from 'react';
import { trackEvent } from '@cluster-apps/analytics';
import { ToggleIconButton } from './ToggleIconButon.tsx';

export type DocsSectionProps = Omit<AccordionProps, 'children'> & {
  children?: ReactNode;
  title: string;
  rightSection?: ReactNode;
  analyticId?: string;
};

const Root = styled(Accordion)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(203, 207, 251, 0.08)' 
    : 'rgba(203, 207, 251, 0.2)',
  overflow: 'hidden',
  border: `1px solid ${theme.palette.divider}`,

  '&:before': {
    display: 'none',
  },
}));

const Summary = styled(AccordionSummary)(({ theme }) => ({
  padding: theme.spacing(2),
  '.MuiAccordionSummary-content': {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));

const Content = styled(AccordionDetails)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' 
    ? theme.palette.background.paper 
    : '#F5F6FF',
  padding: theme.spacing(3),
  '& code': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.1)' 
      : 'rgba(0, 0, 0, 0.05)',
    padding: theme.spacing(0.5, 1),
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  '& pre': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.05)' 
      : 'rgba(0, 0, 0, 0.03)',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    overflow: 'auto',
    margin: theme.spacing(2, 0),
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  '& ul, & ol': {
    paddingLeft: theme.spacing(3),
  },
  '& li': {
    marginBottom: theme.spacing(1),
  },
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  '& h1': {
    fontSize: '2rem',
    marginBottom: theme.spacing(3),
  },
  '& h2': {
    fontSize: '1.5rem',
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
  },
  '& h3': {
    fontSize: '1.25rem',
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1.5),
  },
  '& p': {
    marginBottom: theme.spacing(2),
    lineHeight: 1.6,
  },
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
