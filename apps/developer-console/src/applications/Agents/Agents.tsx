import { Route, Routes } from 'react-router-dom';

import { ComputeProvider } from '~/compute/ComputeProvider';
import ComputeGate from '../Sandboxes/components/ComputeGate';
import AgentDetail from './pages/AgentDetail';
import Overview from './pages/Overview';
import RunDetail from './pages/RunDetail';
import Runs from './pages/Runs';

/**
 * Agents: a client-side layer over Sandboxes (build design, Section 6). A
 * definition is a JSON document in one of your buckets; a run is a sandbox
 * labelled `cere.*` that this console (or the CLI, or the SDK) creates, drives
 * and terminates through the same public API. Nothing about agents is stored
 * on DDC's servers.
 */
const Agents = () => (
  <ComputeProvider>
    <ComputeGate title="Agents">
      <Routes>
        <Route index element={<Overview />} />
        <Route path="a/:bucket/:name" element={<AgentDetail />} />
        <Route path="runs" element={<Runs />} />
        <Route path="runs/:runId" element={<RunDetail />} />
      </Routes>
    </ComputeGate>
  </ComputeProvider>
);

export default Agents;
