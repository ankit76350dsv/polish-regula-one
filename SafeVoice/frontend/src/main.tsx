import {StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Initialise translations before the app renders so the first paint is already localised.
import './i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Suspense covers the brief moment while the language bundle loads. */}
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </StrictMode>,
);
