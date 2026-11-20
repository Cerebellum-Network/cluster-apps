import { Routes, Route } from 'react-router-dom';

import Models from './pages/Models';
import ApiKeys from './pages/ApiKeys';
import Usage from './pages/Usage';
import Quickstart from './pages/Quickstart';
import '~/inference/inference.css';

/**
 * Inference — the mockup's inference area. The sidebar sub-nav (Models / API keys
 * / Usage, declared on the application's `subNav`) drives these nested routes;
 * `inference` lands on Models. The Quickstart (create a key, copy it, call a
 * model) is `inference/quickstart`, linked from Models, API keys and Usage. The catalogue is read-only (gateway + CDN public GETs); the
 * key panel signs with the connected wallet.
 */
const Inference = () => (
  <div className="inference-root">
    <Routes>
      <Route index element={<Models />} />
      <Route path="quickstart" element={<Quickstart />} />
      <Route path="keys" element={<ApiKeys />} />
      <Route path="usage" element={<Usage />} />
    </Routes>
  </div>
);

export default Inference;
