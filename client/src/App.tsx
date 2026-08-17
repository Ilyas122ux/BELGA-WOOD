import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import './index.css';

const PublicSite = lazy(() => import('./belga/PublicSite'));
const AdminPortal = lazy(() => import('./belga/AdminPortal'));

export default function App() {
  return <Suspense fallback={<div className="page-loader"><img src="/images/belga-wood-logo.png" alt="" /></div>}>
    <Routes>
      <Route path="/admin/connexion" element={<AdminPortal login />} />
      <Route path="/admin/*" element={<AdminPortal />} />
      <Route path="/*" element={<PublicSite />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>;
}
