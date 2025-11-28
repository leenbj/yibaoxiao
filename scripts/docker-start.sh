#!/bin/sh
# Docker 容器启动脚本
# 1. 等待数据库就绪
# 2. 推送数据库表结构
# 3. 初始化超级管理员
# 4. 启动 Motia 服务

set -e

echo "=========================================="
echo "       易报销 Pro - 启动中"
echo "=========================================="

# 等待数据库就绪
echo ""
echo "[1/4] 等待数据库就绪..."
sleep 5

# 推送数据库表结构
echo ""
echo "[2/4] 同步数据库表结构..."
npx drizzle-kit push --force 2>/dev/null || echo "数据库表已存在或同步完成"

# 初始化超级管理员
echo ""
echo "[3/4] 初始化超级管理员..."
npx ts-node -e "
const { initializeAdmin } = require('./src/db/init-admin');
initializeAdmin().then(id => {
  if (id) {
    console.log('管理员初始化完成, ID:', id);
  }
  process.exit(0);
}).catch(err => {
  console.error('管理员初始化失败:', err.message);
  process.exit(0);
});
" 2>/dev/null || echo "管理员初始化跳过"

# 启动 Motia 服务
echo ""
echo "[4/4] 启动 Motia 服务..."
echo "=========================================="
echo ""

exec npx motia dev

