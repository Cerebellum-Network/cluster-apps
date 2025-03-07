import { Box, styled } from '@mui/material';

import 'highlight.js/styles/github.css';
import 'github-markdown-css/github-markdown-light.css';

import MD from 'react-markdown';
import highlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';

export type MarkdownProps = {
  children?: string;
  content?: string;
};

const Content = styled(Box)(({ theme }) => ({
  backgroundColor: 'transparent',

  ...theme.typography.body1,
  color: theme.palette.text.primary,

  ['& a']: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },

  ['& pre']: {
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.05)' 
      : theme.palette.background.paper,
    overflow: 'auto',
    margin: theme.spacing(2, 0),
  },

  ['& code']: {
    borderRadius: 4,
    padding: theme.spacing(0.5, 1),
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.1)' 
      : theme.palette.background.paper,
    fontFamily: 'monospace',
  },

  ['& h1, & h2, & h3, & h4, & h5, & h6']: {
    color: theme.palette.text.primary,
    fontWeight: 600,
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },

  ['& h1']: {
    fontSize: '2rem',
    borderBottom: `1px solid ${theme.palette.divider}`,
    paddingBottom: theme.spacing(1),
  },

  ['& h2']: {
    fontSize: '1.5rem',
    borderBottom: `1px solid ${theme.palette.divider}`,
    paddingBottom: theme.spacing(0.5),
  },

  ['& h3']: {
    fontSize: '1.25rem',
  },

  ['& p']: {
    marginBottom: theme.spacing(2),
    lineHeight: 1.6,
  },

  ['& ul, & ol']: {
    paddingLeft: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },

  ['& li']: {
    marginBottom: theme.spacing(1),
  },

  ['& img']: {
    maxWidth: '100%',
    borderRadius: theme.shape.borderRadius,
  },

  ['& blockquote']: {
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    paddingLeft: theme.spacing(2),
    margin: theme.spacing(2, 0),
    color: theme.palette.text.secondary,
  },

  ['& table']: {
    borderCollapse: 'collapse',
    width: '100%',
    marginBottom: theme.spacing(2),
  },

  ['& th, & td']: {
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1, 2),
    textAlign: 'left',
  },

  ['& th']: {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.05)' 
      : 'rgba(0, 0, 0, 0.03)',
  },

  // Override github-markdown-css for dark mode
  ...(theme.palette.mode === 'dark' && {
    '.markdown-body': {
      color: theme.palette.text.primary,
      backgroundColor: 'transparent',
    },
    '.hljs': {
      color: theme.palette.text.primary,
      background: 'transparent',
    },
  }),
}));

export const Markdown = ({ content, children }: MarkdownProps) => (
  <Content className="markdown-body">
    <MD rehypePlugins={[highlight, rehypeRaw]}>{content || children}</MD>
  </Content>
);
