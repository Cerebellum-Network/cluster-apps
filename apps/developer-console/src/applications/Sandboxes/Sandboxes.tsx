import { Route, Routes } from 'react-router-dom';

import { ComputeProvider } from '~/compute/ComputeProvider';
import { DevViewBanner } from '~/compute/walletSigning';
import ComputeGate from './components/ComputeGate';
import CliAccess from './pages/CliAccess';
import Egress from './pages/Egress';
import Overview from './pages/Overview';
import SandboxDetail from './pages/SandboxDetail';
import SandboxList from './pages/SandboxList';
import Secrets from './pages/Secrets';
import Usage from './pages/Usage';

/**
 * Sandboxes: gVisor containers on the cluster's nodes, through the compute
 * gateway's public API (src/compute/). Every page calls the gateway as the
 * signed-in wallet's bucket with the console's COMPUTE token; ComputeGate
 * holds the page until both exist. The quickstart and CLI access work before
 * that too, because they only show text or mint a token.
 */
const Sandboxes = () => (
  <ComputeProvider>
    <DevViewBanner />
    <Routes>
      <Route index element={<Overview />} />
      <Route path="cli" element={<CliAccess />} />
      <Route
        path="*"
        element={
          <ComputeGate title="Sandboxes">
            <Routes>
              <Route path="list" element={<SandboxList />} />
              <Route path="list/:id" element={<SandboxDetail />} />
              <Route path="secrets" element={<Secrets />} />
              <Route path="egress" element={<Egress />} />
              <Route path="usage" element={<Usage />} />
            </Routes>
          </ComputeGate>
        }
      />
    </Routes>
  </ComputeProvider>
);

export default Sandboxes;
