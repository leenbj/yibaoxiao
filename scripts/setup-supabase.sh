#!/bin/bash

# 易报销 Pro - Supabase 快速配置脚本
# 用于本地开发环境快速配置

set -e

echo "========================================"
echo "  易报销 Pro - Supabase 配置向导"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ENV_FILE="$FRONTEND_DIR/.env"

# 检查是否在正确的目录
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}错误: 未找到 frontend 目录${NC}"
    echo "请在项目根目录运行此脚本"
    exit 1
fi

echo -e "${YELLOW}请准备以下信息：${NC}"
echo "1. Supabase Project URL (格式: https://xxxxxxxx.supabase.co)"
echo "2. Supabase Anon Key (以 eyJ 开头的长字符串)"
echo ""
echo "获取位置: Supabase Dashboard → Settings → API"
echo ""

# 读取用户输入
read -p "请输入 Supabase Project URL: " SUPABASE_URL
read -p "请输入 Supabase Anon Key: " SUPABASE_ANON_KEY

# 验证输入
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}错误: URL 和 Key 不能为空${NC}"
    exit 1
fi

# 验证 URL 格式
if [[ ! $SUPABASE_URL =~ ^https://[a-z0-9-]+\.supabase\.co$ ]]; then
    echo -e "${YELLOW}警告: URL 格式可能不正确${NC}"
    echo "预期格式: https://xxxxxxxx.supabase.co"
    read -p "是否继续? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 1
    fi
fi

# 验证 Key 格式
if [[ ! $SUPABASE_ANON_KEY =~ ^eyJ ]]; then
    echo -e "${YELLOW}警告: Anon Key 格式可能不正确${NC}"
    echo "预期格式: 以 eyJ 开头的 JWT Token"
    read -p "是否继续? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 1
    fi
fi

# 创建 .env 文件
echo ""
echo -e "${GREEN}正在创建 .env 文件...${NC}"

cat > "$ENV_FILE" << EOF
# 易报销 Pro - 前端环境变量
# 由 setup-supabase.sh 自动生成
# 生成时间: $(date)

# ==================== Supabase 配置 ====================
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# ==================== AI 配置（可选）====================
# 取消注释并填入你的 API Key
# VITE_GEMINI_API_KEY=your-gemini-api-key
# VITE_DEEPSEEK_API_KEY=your-deepseek-api-key
EOF

echo -e "${GREEN}✓ .env 文件已创建: $ENV_FILE${NC}"

# 显示配置内容
echo ""
echo "配置内容:"
echo "----------------------------------------"
cat "$ENV_FILE"
echo "----------------------------------------"

# 询问是否安装依赖
echo ""
read -p "是否安装前端依赖? (y/n): " INSTALL_DEPS
if [ "$INSTALL_DEPS" = "y" ]; then
    echo -e "${GREEN}正在安装依赖...${NC}"
    cd "$FRONTEND_DIR"
    npm install
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
fi

# 询问是否启动开发服务器
echo ""
read -p "是否启动开发服务器? (y/n): " START_DEV
if [ "$START_DEV" = "y" ]; then
    echo -e "${GREEN}正在启动开发服务器...${NC}"
    echo "访问 http://localhost:5173 测试应用"
    cd "$FRONTEND_DIR"
    npm run dev
fi

echo ""
echo "========================================"
echo -e "${GREEN}配置完成！${NC}"
echo "========================================"
echo ""
echo "后续步骤:"
echo "1. 访问 http://localhost:5173 测试应用"
echo "2. 注册新用户验证认证功能"
echo "3. 创建费用记录验证数据库功能"
echo "4. 上传附件验证 Storage 功能"
echo ""
echo "如需部署到生产环境，请参考:"
echo "$PROJECT_ROOT/docs/SUPABASE_DEPLOYMENT_GUIDE.md"
echo ""
