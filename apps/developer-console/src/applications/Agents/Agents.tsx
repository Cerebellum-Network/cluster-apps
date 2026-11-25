import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import { ComputeProvider } from '~/compute/ComputeProvider';
import { DevViewBanner } from '~/compute/walletSigning';
import ComputeGate from '../Sandboxes/components/ComputeGate';
import { agentPath } from './components/definition';
import AgentDetail from './pages/AgentDetail';
import AgentEditor from './pages/AgentEditor';
import Definitions from './pages/Definitions';
import Overview from './pages/Overview';
import RunDetail from './pages/RunDetail';
import Runs from './pages/Runs';

/** Links from before Definitions had its own tab. */
const OldAgentPath = () => {
  const { bucket = '', name = '' } = useParams<{ bucket: string; name: string }>();
  return <Navigate to={agentPath(bucket, name)} replace />;
};

/**
 * Agents: a client-side layer over Sandboxes (build design, Section 6). A
 * definition is a JSON document in one of your buckets; a run is a sandbox
 * labelled `cere.*` that this console (or the CLI, or the SDK) creates, drives
 * and terminates through the same public API. Nothing about agents is stored
 * on DDC's servers. The Overview's quickstart shows before the console has
 * access to your sandboxes; everything else waits for it (ComputeGate).
 */
const Agents = () => (
  <ComputeProvider>
    <DevViewBanner />
    <Routes>
      <Route index element={<Overview />} />
      <Route
        path="*"
        element={
          <ComputeGate title="Agents">
            <Routes>
              <Route path="definitions" element={<Definitions />} />
              <Route path="definitions/new" element={<AgentEditor />} />
              <Route path="definitions/:bucket/:name" element={<AgentDetail />} />
              <Route path="definitions/:bucket/:name/edit" element={<AgentEditor />} />
              <Route path="a/:bucket/:name" element={<OldAgentPath />} />
              <Route path="runs" element={<Runs />} />
              <Route path="runs/:runId" element={<RunDetail />} />
            </Routes>
          </ComputeGate>
        }
      />
    </Routes>
  </ComputeProvider>
);

export default Agents;
