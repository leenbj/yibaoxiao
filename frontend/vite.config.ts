import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173, // 前端端口
        host: '0.0.0.0',
        // 配置代理，解决跨域问题
        proxy: {
          '/api': {
            target: 'http://localhost:3000', // 后端 Motia 地址
            changeOrigin: true,
          },
        },
      },
      css: {
        postcss: {
          plugins: [tailwindcss(), autoprefixer()],
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // 确保所有依赖都从 frontend/node_modules 加载
          'react': path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
          '@google/genai': path.resolve(__dirname, 'node_modules/@google/genai'),
          'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react'),
        },
        dedupe: ['react', 'react-dom'],
      },
      optimizeDeps: {
        include: ['react', 'react-dom', '@google/genai', 'lucide-react'],
      },
      // 构建优化 - 代码分割，解决页面加载缓慢问题
      build: {
        rollupOptions: {
          output: {
            // 手动分割大型依赖，减少首屏加载体积
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-pdf': ['jspdf', 'html2canvas'],
              'vendor-icons': ['lucide-react'],
              'vendor-ai': ['@google/genai'],
            },
          },
        },
        // 分块大小警告阈值
        chunkSizeWarningLimit: 500,
        // 启用源码映射便于调试
        sourcemap: mode === 'development',
      },
    };
});
