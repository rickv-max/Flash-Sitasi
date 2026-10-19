import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Run the same API handlers in local development; no separate API process needed.
function localAPI() {
  const routes = { 'create-payment': 'createPayment', 'payment-status': 'paymentStatus',
    'payment-webhook': 'webhook', profile: 'profile', citations: 'citations', config: 'config', city: 'city', admin: 'admin' };
  return { name: 'flashcite-local-api', configureServer(server) {
    server.middlewares.use('/api', async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (body) => { res.end(JSON.stringify(body)); return res; };
      try {
        const url = new URL(req.url, 'http://localhost');
        const action = routes[url.pathname.replace(/^\//, '')];
        if (!action) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } });
        req.query = Object.fromEntries(url.searchParams);
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 16000) return res.status(413).json({ success: false, error: { code: 'TOO_LARGE', message: 'Permintaan terlalu panjang.' } });
        }
        req.body = raw || '{}';
        if (action === 'admin') {
          const { makeAdminHandler } = await import('./server/admin-handlers.js');
          await makeAdminHandler()(req, res);
        } else {
          const { makeHandler } = await import('./server/handlers.js');
          await makeHandler(action)(req, res);
        }
      } catch {
        if (!res.writableEnded) res.status(500).json({ success: false, error: { code: 'DEV_SERVER_ERROR', message: 'Layanan lokal belum siap. Periksa konfigurasi server.' } });
      }
    });
  } };
}
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { envPrefix: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID'],
    plugins: [react(), localAPI()], build: { rollupOptions: { output: {
    manualChunks: (id) => id.includes('node_modules/@firebase') || id.includes('node_modules/firebase/') ? 'firebase' : undefined,
  } } } };
});
