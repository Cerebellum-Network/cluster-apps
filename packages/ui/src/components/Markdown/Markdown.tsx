import { Typography } from '@mui/material';
import { MuiMarkdown, Overrides, getOverrides } from 'mui-markdown';
import { Highlight, themes } from 'prism-react-renderer';

export type MarkdownProps = {
  children?: string;
  content?: string;
};

const overrides: Overrides = {
  h1: {
    component: Typography,
    props: { variant: 'h4', fontWeight: 600, lineHeight: 3 },
  },
  h2: {
    component: Typography,
    props: { variant: 'h4', fontWeight: 600, lineHeight: 3 },
  },
  h3: {
    component: Typography,
    props: { variant: 'subtitle1', lineHeight: 3 },
  },
  h4: {
    component: Typography,
    props: { variant: 'subtitle1', lineHeight: 3 },
  },
};

export const Markdown = ({ content, children }: MarkdownProps) => {
  return (
    <MuiMarkdown
      overrides={{
        ...getOverrides({
          Highlight,
          themes,
          theme: themes.ultramin,
        }),
        ...overrides,
      }}
    >
      {content || children}
    </MuiMarkdown>
  );
};
