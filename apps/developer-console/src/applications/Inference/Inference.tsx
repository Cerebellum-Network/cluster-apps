import { Routes, Route, Navigate } from 'react-router-dom';

import Models from './pages/Models';
import ApiKeys from './pages/ApiKeys';
import Usage from './pages/Usage';
import '~/inference/inference.css';

/**
 * Inference — the mockup's inference area. The sidebar sub-nav (Models / API keys
 * / Usage, declared on the application's `subNav`) drives these nested routes;
 * `inference` lands on Models. The quickstart (create a key, copy it, call a
 * model) is a dialog over Models, deep-linked as `/inference?quickstart=1`. The catalogue is read-only (gateway + CDN public GETs); the
 * key panel signs with the connected wallet.
 */
const Inference = () => (
  <div className="inference-root">
    <Routes>
      <Route index element={<Models />} />
      <Route path="quickstart" element={<Navigate to="/inference?quickstart=1" replace />} />
      <Route path="keys" element={<ApiKeys />} />
      <Route path="usage" element={<Usage />} />
    </Routes>
  </div>
);

export default Inference;
