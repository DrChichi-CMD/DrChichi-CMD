import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Gracefully suppress benign sandbox-related WebSocket / Vite HMR connection errors
if (typeof window !== 'undefined') {
  const handleBenignError = (msg: string, event: Event) => {
    const isBenign = 
      msg.includes('WebSocket') || 
      msg.includes('websocket') || 
      msg.includes('vite') || 
      msg.includes('hmr') || 
      msg.includes('HMR') ||
      msg.includes('WS');
    if (isBenign) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    handleBenignError(reason, event);
  });

  window.addEventListener('error', (event) => {
    const message = event.message || '';
    handleBenignError(message, event);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
