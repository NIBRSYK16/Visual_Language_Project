import { defineConfig } from 'umi';

export default defineConfig({
  title: '学术文献全景分析系统',
  chainWebpack(memo, args) {
    memo.module
      .rule('csvLoader')
      .test(/\.csv$/)
      .use('csvLoader')
      .loader('csv-loader')
      .options({
        dynamicTyping: true,
        header: true,
        skipEmptyLines: true,
      });
  },
  nodeModulesTransform: {
    type: 'none',
  },
  routes: [{ path: '/', component: '@/pages/index' }],
  fastRefresh: {},
  proxy: {
    '/api': {
      target: 'http://localhost:8080/',
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    },
  },
});
