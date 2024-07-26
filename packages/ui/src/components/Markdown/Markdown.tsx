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
  },

  ['& pre']: {
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
  },

  ['& code']: {
    borderRadius: 2,
    backgroundColor: theme.palette.background.paper,
  },
}));

export const Markdown = ({ content, children }: MarkdownProps) => (
  <Content className="markdown-body">
    <MD rehypePlugins={[highlight, rehypeRaw]}>{content || children}</MD>
  </Content>
);
