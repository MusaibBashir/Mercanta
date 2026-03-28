
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";
  import { registerSW } from 'virtual:pwa-register';

  // Register service worker — caches the app shell so tab-switch reloads
  // are served from cache in ~50ms instead of hitting the network
  registerSW({ immediate: true });

  createRoot(document.getElementById("root")!).render(<App />);
  