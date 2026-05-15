import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// Single QueryClient instance — shared across all hooks and pages.
// staleTime: 0 ensures auth state is always fresh (no stale user profile cache).
const queryClient = new QueryClient({
  defaultOptions: {
    queries:   { staleTime: 0, retry: 1 },
    mutations: { retry: 0 },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
