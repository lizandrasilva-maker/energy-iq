import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Limite de corpo das funções da Vercel; aplicado também localmente para o
// desenvolvimento falhar do mesmo jeito que a produção.
const MAX_BODY_BYTES = 4.5 * 1024 * 1024;

/**
 * Roda as funções de scr/api/*.js no `npm run dev`, no mesmo formato da
 * Vercel (export async function POST(request) → Response). Assim as chaves
 * de servidor (GEMINI_API_KEY, SUPABASE_KEY…) vêm do .env.local sem nunca
 * irem para o navegador.
 */
function localApi(env) {
  return {
    name: 'energyiq-local-api',
    configureServer(server) {
      for (const k of ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_KEY', 'DEVICE_TOKEN']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([a-z0-9-]+)(?:\?|$)/i);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.js`);
          const handler = mod[req.method];
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const chunks = [];
          let size = 0;
          for await (const c of req) {
            size += c.length;
            chunks.push(c);
          }
          if (size > MAX_BODY_BYTES) {
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Arquivo grande demais para enviar (limite de 4,5 MB).' }));
          }
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: { 'content-type': req.headers['content-type'] || '', 'x-device-token': req.headers['x-device-token'] || '' },
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
          });
          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          if (err?.code === 'ERR_LOAD_URL' || /Failed to load url/.test(err?.message)) return next();
          server.config.logger.error(`[api] ${err?.stack || err}`);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Erro interno na função local.' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), localApi(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  };
});
