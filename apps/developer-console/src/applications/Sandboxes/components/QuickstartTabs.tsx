import { useState, type ReactNode } from 'react';
import { Box, Stack } from '@cluster-apps/ui';

import { Tabs } from './bits';

type Lang = 'cli' | 'python';

const KEY = 'compute.quickstart.lang';

const remembered = (): Lang => {
  try {
    return window.localStorage.getItem(KEY) === 'python' ? 'python' : 'cli';
  } catch {
    return 'cli';
  }
};

/**
 * The quickstart as two tabs, CLI and Python: the two clients that exist (the
 * `cere` CLI and the `cere` Python SDK). The choice is remembered per browser,
 * so both Overviews open on the same one.
 */
const QuickstartTabs = ({ cli, python }: { cli: ReactNode; python: ReactNode }) => {
  const [lang, setLang] = useState<Lang>(remembered);
  const pick = (l: Lang) => {
    setLang(l);
    try {
      window.localStorage.setItem(KEY, l);
    } catch {
      /* private mode: the tab still switches */
    }
  };
  return (
    <Stack spacing="14px">
      <Box marginTop="-8px">
        <Tabs<Lang>
          value={lang}
          onChange={pick}
          tabs={[
            { id: 'cli', label: 'CLI' },
            { id: 'python', label: 'Python' },
          ]}
        />
      </Box>
      <Box role="tabpanel">{lang === 'cli' ? cli : python}</Box>
    </Stack>
  );
};

export default QuickstartTabs;
