import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./lib/toast";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: (n, e: any) => n < 2 && !(e?.response?.status >= 400 && e?.response?.status < 500), refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider><App /></AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

// Retire l'écran de démarrage une fois l'application affichée.
requestAnimationFrame(() => {
  const boot = document.getElementById("boot");
  if (!boot) return;
  setTimeout(() => { boot.classList.add("done"); setTimeout(() => boot.remove(), 400); }, 450);
});
