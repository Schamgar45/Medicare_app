import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import '@fontsource/josefin-sans/400.css';
import '@fontsource/josefin-sans/500.css';
import '@fontsource/josefin-sans/600.css';
import '@fontsource/josefin-sans/700.css';
import '@fontsource-variable/inter';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120_000,
      retry: (n, e: any) => n < 2 && !(e?.response?.status >= 400 && e?.response?.status < 500),
      refetchOnWindowFocus: false,
    },
  },
});

function StartupOverlay() {
  const { loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const boot = document.getElementById('boot');
    if (!boot) return;

    const frame = requestAnimationFrame(() => {
      boot.classList.add('done');
      window.setTimeout(() => boot.remove(), 250);
    });
    return () => cancelAnimationFrame(frame);
  }, [loading]);

  return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <StartupOverlay />
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
