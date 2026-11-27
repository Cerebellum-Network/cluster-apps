import { Navigate, Route, Routes } from 'react-router-dom';

import { ComputeProvider } from '~/compute/ComputeProvider';
import { DevViewBanner } from '~/compute/walletSigning';
import ComputeGate from './components/ComputeGate';
import { CredentialDialogProvider } from './components/credentials/CredentialDialogs';
import Overview from './pages/Overview';
import SandboxDetail from './pages/SandboxDetail';
import SandboxList from './pages/SandboxList';
import Usage from './pages/Usage';

/**
 * Sandboxes: gVisor containers on the cluster's nodes, through the compute
 * gateway's public API (src/compute/). Every page calls the gateway as the
 * signed-in wallet's bucket with the console's COMPUTE token; ComputeGate
 * holds the page until both exist. The Overview's quickstart works before that
 * too, because it only shows text.
 *
 * Egress rules and credentials belong to a sandbox: they are set in the New
 * sandbox form and on the sandbox's Egress tab, while it runs. Credentials are
 * kept per bucket so sandboxes and agents can reuse them, and are created and
 * picked where a rule names one.
 */
const Sandboxes = () => (
  <ComputeProvider>
    <CredentialDialogProvider>
      <DevViewBanner />
      <Routes>
        <Route index element={<Overview />} />
        {/* Earlier tabs: credentials and egress moved into each sandbox, CLI sign-in to the browser. */}
        <Route path="secrets" element={<Navigate to="/sandboxes" replace />} />
        <Route path="egress" element={<Navigate to="/sandboxes" replace />} />
        <Route path="cli" element={<Navigate to="/access-tokens" replace />} />
        <Route
          path="*"
          element={
            <ComputeGate title="Sandboxes">
              <Routes>
                <Route path="list" element={<SandboxList />} />
                <Route path="list/:id" element={<SandboxDetail />} />
                <Route path="usage" element={<Usage />} />
              </Routes>
            </ComputeGate>
          }
        />
      </Routes>
    </CredentialDialogProvider>
  </ComputeProvider>
);

export default Sandboxes;
