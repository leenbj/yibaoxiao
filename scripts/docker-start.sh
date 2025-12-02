#!/bin/sh
# Docker 容器启动脚本（生产环境优化版）
# 
# 功能：
# 1. 等待数据库就绪
# 2. 推送数据库表结构（使用 drizzle-kit）
# 3. 初始化超级管理员（wangbo@knet.cn）
# 4. 启动 Motia 服务（生产模式）
#
# 注意：Motia 项目已在 Docker 构建阶段预编译，无需运行时构建

set -e

echo "=========================================="
echo "       易报销 Pro - 生产环境启动"
echo "=========================================="
echo ""

# 设置 Node.js 内存限制（针对 4G 内存服务器优化）
# 强制覆盖 NODE_OPTIONS，移除不允许的参数（如 --optimize_for_size）
export NODE_OPTIONS="--max-old-space-size=1024"

# 设置默认管理员信息（如果环境变量未设置）
export ADMIN_EMAIL="${ADMIN_EMAIL:-wangbo@knet.cn}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-123456}"
export ADMIN_NAME="${ADMIN_NAME:-王波}"
export ADMIN_DEPARTMENT="${ADMIN_DEPARTMENT:-管理部}"

echo "[环境] NODE_OPTIONS: $NODE_OPTIONS"
echo "[环境] 管理员邮箱: $ADMIN_EMAIL"
echo ""

# ==================== 等待数据库就绪 ====================
echo "[1/4] 等待数据库就绪..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if wget -q --spider "http://postgres:5432" 2>/dev/null || \
       nc -z postgres 5432 2>/dev/null || \
       pg_isready -h postgres -p 5432 -U "${POSTGRES_USER:-yibao}" 2>/dev/null; then
        echo "数据库已就绪"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "等待数据库连接... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "警告: 数据库连接超时，继续启动..."
fi

# 额外等待确保数据库完全就绪
sleep 3

# ==================== 推送数据库表结构 ====================
echo ""
echo "[2/4] 同步数据库表结构..."
npx drizzle-kit push --force 2>/dev/null || {
    echo "drizzle-kit push 失败，尝试使用 SQL 脚本初始化..."
    if [ -f "/app/scripts/init-db.sql" ]; then
        PGPASSWORD="${POSTGRES_PASSWORD:-yibao123456}" psql \
            -h postgres \
            -U "${POSTGRES_USER:-yibao}" \
            -d "${POSTGRES_DB:-yibao}" \
            -f /app/scripts/init-db.sql 2>/dev/null || echo "SQL 初始化跳过"
    fi
}

# ==================== 初始化超级管理员 ====================
echo ""
echo "[3/4] 初始化超级管理员..."
npx ts-node -e "
const { initializeAdmin } = require('./src/db/init-admin');
initializeAdmin().then(id => {
  if (id) {
    console.log('管理员初始化完成, ID:', id);
  } else {
    console.log('管理员初始化跳过（已存在或未配置）');
  }
  process.exit(0);
}).catch(err => {
  console.error('管理员初始化失败:', err.message);
  process.exit(0);
});
" 2>/dev/null || {
    echo "ts-node 初始化失败，尝试直接插入..."
    # 备用方案：直接使用 SQL 插入管理员
    PGPASSWORD="${POSTGRES_PASSWORD:-yibao123456}" psql \
        -h postgres \
        -U "${POSTGRES_USER:-yibao}" \
        -d "${POSTGRES_DB:-yibao}" \
        -c "INSERT INTO users (id, name, department, email, role, password, is_current, created_at, updated_at)
            VALUES ('user_wangbo', '${ADMIN_NAME}', '${ADMIN_DEPARTMENT}', '${ADMIN_EMAIL}', 'admin', '${ADMIN_PASSWORD}', FALSE, NOW(), NOW())
            ON CONFLICT (email) DO UPDATE SET role = 'admin', updated_at = NOW();" 2>/dev/null || echo "管理员初始化跳过"
}

# ==================== 启动 Motia 服务 ====================
echo ""
echo "[4/4] 启动 Motia 服务（生产模式）..."
echo "=========================================="
echo ""
echo "服务即将启动..."
echo "- 端口: 3000"
echo "- 模式: 生产环境"
echo "- 内存限制: 1024MB"
echo ""

# 使用 motia start 启动生产模式
# 生产模式特点：
# - 无热重载，减少 CPU 占用
# - 使用预编译的代码
# - 更少的内存占用
exec npx motia start
