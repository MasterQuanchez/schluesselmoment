import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { APP_CONFIG } from './config';
import { registerPwa } from './pwa';
import { purgeExpired, requestPersistence } from './storage/db';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void requestPersistence();
void purgeExpired(APP_CONFIG.retentionDays).then(
  (n) => n && console.info(`${n} versendete(s) Protokoll(e) nach Ablauf der Frist gelöscht.`),
);
if (import.meta.env.PROD) registerPwa();
