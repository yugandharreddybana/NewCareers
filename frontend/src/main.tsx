import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/index.css';

// NOTE: BrowserRouter lives in App.tsx — do NOT add another one here.
// AuthProvider is also inside App.tsx, inside the router, so useNavigate works.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" />
  </React.StrictMode>
);
