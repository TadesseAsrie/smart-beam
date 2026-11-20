import { createApp } from './app';
import { loadConfig } from './config';

const cfg = loadConfig();
if (!cfg.publicUrl) console.warn('PUBLIC_URL is not set: file URLs are derived from the request Host header. Set it behind a proxy.');
if (!cfg.apiKey) console.warn('API_KEY is not set: uploads are open to anyone who can reach this server.');
const { app } = createApp(cfg);
app.listen(cfg.port, () => console.log(`SmartBeam server listening on :${cfg.port}`));
