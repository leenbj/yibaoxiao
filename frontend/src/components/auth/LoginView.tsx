/**
 * 易报销系统 - 登录/注册视图
 * 双栏布局登录注册表单
 */

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { LoginViewProps } from '../../types';
import { apiRequest } from '../../utils/api';
import { AppLogo } from '../shared/AppLogo';

/**
 * 登录/注册视图组件
 *
 * 功能:
 * - 登录和注册模式切换
 * - 表单验证和提交
 * - 错误提示和加载状态
 * - 双栏响应式布局
 */
export const LoginView = ({ onLogin }: LoginViewProps) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        // 注册
        await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }

      // 登录
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, password: form.password }),
      });

      onLogin(result.user, result.token);
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 左侧 - 图片区域 (50%) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden">
        {/* 背景图片 */}
        <img
          src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80"
          alt="Finance Background"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        {/* 渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80" />

        {/* 左侧内容 */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <AppLogo className="w-10 h-10" />
            <span className="text-xl font-semibold tracking-tight">易报销 Pro</span>
          </div>

          {/* 中间文案 */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold leading-tight mb-6">
              智能报销<br/>
              <span className="text-slate-400">化繁为简</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              AI 驱动的智能报销系统，自动识别发票、审批单，一键生成报销单据，让财务工作更轻松。
            </p>
          </div>

          {/* 底部信息 */}
          <div className="flex items-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>系统运行中</span>
            </div>
            <span>© 2025 易报销 Pro</span>
          </div>
        </div>
      </div>

      {/* 右侧 - 登录表单 (50%) */}
      <div className="flex-1 lg:w-1/2 lg:flex-none flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* 移动端 Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <AppLogo className="w-10 h-10" />
            <span className="text-xl font-semibold text-slate-800">易报销 Pro</span>
          </div>

          {/* 标题 */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">
              {isRegister ? '创建账户' : '欢迎回来'}
            </h2>
            <p className="text-slate-500 mt-2">
              {isRegister ? '填写以下信息开始使用' : '请登录您的账户继续'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">姓名</label>
                  <input
                    type="text"
                    placeholder="请输入姓名"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">部门</label>
                  <input
                    type="text"
                    placeholder="请输入部门"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">邮箱</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">密码</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : null}
              {loading ? '处理中...' : isRegister ? '注册' : '登录'}
            </button>
          </form>

          {/* 分割线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-400">或</span>
            </div>
          </div>

          {/* 切换登录/注册 */}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="w-full py-3 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-all"
          >
            {isRegister ? '已有账户？立即登录' : '没有账户？立即注册'}
          </button>

          {/* 底部条款 */}
          <p className="mt-8 text-center text-xs text-slate-400">
            登录即表示您同意我们的<br/>
            <a href="#" className="text-slate-600 hover:underline">服务条款</a>
            {' '}和{' '}
            <a href="#" className="text-slate-600 hover:underline">隐私政策</a>
          </p>
        </div>
      </div>
    </div>
  );
};
