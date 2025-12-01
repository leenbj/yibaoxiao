import { config } from '@motiadev/core'

// 只加载必要的插件（生产环境优化）
const endpointPlugin = require('@motiadev/plugin-endpoint/plugin')

export default config({
  // 精简插件列表，只保留 endpoint 插件
  // 移除了 states、logs、observability 以减少依赖和构建时间
  plugins: [endpointPlugin],
})
