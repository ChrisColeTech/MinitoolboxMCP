import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import AppLayout from './layouts/AppLayout';
import IndexPage from './pages/index/IndexPage';
import GalleryPage from './pages/gallery/GalleryPage';
import CaptureWorkerPage from './pages/capture-worker/CaptureWorkerPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        {/* Main app with sidebar layout */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<IndexPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
        </Route>

        {/* Hidden capture worker — no layout, loaded in invisible BrowserWindow */}
        <Route path="/capture" element={<CaptureWorkerPage />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
