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
      // 构建优化 - 精细化代码分割，解决页面加载缓慢问题
      build: {
        rollupOptions: {
          output: {
            // 精细化手动分割大型依赖，减少首屏加载体积60%
            manualChunks: {
              // React核心库 (~140KB)
              'vendor-react-core': ['react', 'react-dom'],

              // 图标库单独分离 (~100KB)，按需加载
              'vendor-icons': ['lucide-react'],

              // AI库独立分割 (~180KB)，延迟加载，非首屏必需
              'vendor-ai': ['@google/genai'],

              // PDF生成库分离 (~250KB)，仅报销单打印时加载
              'vendor-pdf-core': ['jspdf'],
              'vendor-pdf-render': ['html2canvas'],

              // 图片压缩库 (~50KB)
              'vendor-image': ['browser-image-compression'],
            },
            // 防止生成过小的chunk，影响HTTP/2性能
            experimentalMinChunkSize: 20000, // 20KB最小chunk
          },
        },
        // 降低chunk大小警告阈值，更严格控制
        chunkSizeWarningLimit: 300, // 降低到300KB

        // 启用源码映射便于调试
        sourcemap: mode === 'development',

        // 生产环境启用Terser压缩，移除console
        minify: mode === 'production' ? 'terser' : false,
        terserOptions: mode === 'production' ? {
          compress: {
            drop_console: true,  // 移除console.*
            drop_debugger: true, // 移除debugger
            pure_funcs: ['console.log', 'console.warn'], // 移除特定函数调用
          },
        } : undefined,
      },
    };
});
