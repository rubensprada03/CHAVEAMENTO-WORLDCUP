import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dentro do Docker, o backend é acessível pelo nome do serviço "backend"
// Localmente sem Docker, continua em localhost:3001
const API_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
