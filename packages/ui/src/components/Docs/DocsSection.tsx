import {
  Accordion,
  AccordionProps,
  AccordionSummary,
  AccordionDetails,
  styled,
  Typography,
  Button,
} from '@mui/material';
import { ReactNode } from 'react';
import { GithubLogoIcon } from '@developer-console/ui';

export type DocsSectionProps = Omit<AccordionProps, 'children'> & {
  children?: ReactNode;
  title: string;
  githubLink?: string;
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

const GithubButton = styled(Button)(({ theme }) => ({
  marginLeft: 'auto',
  gap: theme.spacing(1),
}));

export const DocsSection = ({ title, children, githubLink, ...props }: DocsSectionProps) => {
  const handleLinkClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (githubLink) {
      event.stopPropagation();
      window.open(githubLink, '_blank');
    }
  };

  return (
    <Root {...props} square disableGutters>
      <Summary>
        <Typography variant="subtitle1">{title}</Typography>
        {githubLink && (
          <GithubButton onClick={handleLinkClick}>
            <GithubLogoIcon />
            <Typography>Open in Github</Typography>
          </GithubButton>
        )}
      </Summary>
      {!githubLink && children && <Content>{children}</Content>}
    </Root>
  );
};
