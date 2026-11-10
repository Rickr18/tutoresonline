import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo la web corre en el puerto 5173 y reenvía la API y el WebSocket al servidor local.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Ant Design y React cambian poco: van en archivos aparte para que el navegador los guarde en caché.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](antd|@ant-design|@rc-component|rc-[^\\/]+|@emotion|dayjs)[\\/]/.test(id)) return 'antd';
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run|@tanstack)[\\/]/.test(id)) return 'react';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
