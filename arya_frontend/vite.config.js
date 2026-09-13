import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-router-dom': path.resolve(__dirname, './node_modules/react-router-dom'),
      'lucide-react': path.resolve(__dirname, './node_modules/lucide-react'),
      'recharts': path.resolve(__dirname, './node_modules/recharts')
    },
  },
});
