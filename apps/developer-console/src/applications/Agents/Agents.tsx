import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import { ExperimentalPill } from '~/components';
import { ComputeProvider } from '~/compute/ComputeProvider';
import { DevViewBanner } from '~/compute/walletSigning';
import ComputeGate from '../Sandboxes/components/ComputeGate';
import { CredentialDialogProvider } from '../Sandboxes/components/credentials/CredentialDialogs';
import { AGENTS_PATH, agentPath, NEW_AGENT_PATH } from './components/definition';
import AgentDetail from './pages/AgentDetail';
import AgentEditor from './pages/AgentEditor';
import AgentList from './pages/AgentList';
import Overview from './pages/Overview';
import RunDetail from './pages/RunDetail';
import Runs from './pages/Runs';

/** Links from before Agents had its own tab (`/agents/a/…`) and from the Definitions tab (`/agents/definitions/…`). */
const OldAgentPath = ({ edit }: { edit?: boolean }) => {
  const { bucket = '', name = '' } = useParams<{ bucket: string; name: string }>();
  return <Navigate to={`${agentPath(bucket, name)}${edit ? '/edit' : ''}`} replace />;
};

/**
 * Agents: a client-side layer over Sandboxes (build design, Section 6). An
 * agent is a definition, a JSON document in one of your buckets; a run is a
 * sandbox labelled `cere.*` that this console (or the CLI, or the SDK)
 * creates, drives and terminates through the same public API. Nothing about
 * agents is stored on DDC's servers. Tabs: Overview | Agents | Runs, the same
 * shape as Sandboxes; each agent's page holds its definition, its runs, and
 * its network rules and credentials. The Overview's quickstart shows before
 * the console has access to your sandboxes; everything else waits for it.
 */
const Agents = () => (
  <ComputeProvider>
    <CredentialDialogProvider>
      <DevViewBanner />
      <Routes>
        <Route index element={<Overview />} />
        <Route
          path="*"
          element={
            <ComputeGate title="Agents" badge={<ExperimentalPill />}>
              <Routes>
                <Route path="list" element={<AgentList />} />
                <Route path="list/new" element={<AgentEditor />} />
                <Route path="list/:bucket/:name" element={<AgentDetail />} />
                <Route path="list/:bucket/:name/edit" element={<AgentEditor />} />
                <Route path="definitions" element={<Navigate to={AGENTS_PATH} replace />} />
                <Route path="definitions/new" element={<Navigate to={NEW_AGENT_PATH} replace />} />
                <Route path="definitions/:bucket/:name" element={<OldAgentPath />} />
                <Route path="definitions/:bucket/:name/edit" element={<OldAgentPath edit />} />
                <Route path="a/:bucket/:name" element={<OldAgentPath />} />
                <Route path="runs" element={<Runs />} />
                <Route path="runs/:runId" element={<RunDetail />} />
              </Routes>
            </ComputeGate>
          }
        />
      </Routes>
    </CredentialDialogProvider>
  </ComputeProvider>
);

export default Agents;
