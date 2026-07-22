import { defineConfig } from 'vite';

// H5 游戏开发配置：本地热更新 dev server + 可直接部署的 build
export default defineConfig({
  // 使用相对路径，build 产物可直接丢到任意静态服务器 / CDN
  base: './',
  server: {
    host: true, // 监听 0.0.0.0，方便手机/同网设备访问真机调试
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    // 多页构建：首页是「昆虫防线」游戏，demo.html 是 Phaser 示例
    rollupOptions: {
      input: {
        main: 'index.html',
        demo: 'demo.html',
      },
    },
  },
});
