/**
 * 易报销系统 - 设置页面
 * 包含用户管理、收款信息、预算项目、AI配置、消费统计
 */

import React, { useState, useEffect } from 'react';
import {
  Users, CreditCard, Briefcase, Settings, ScanLine, Activity, Plus, Trash2,
  Check, Landmark, User, Info, ChevronRight, ChevronLeft, Loader
} from 'lucide-react';
import type { AppUser, PaymentAccount, BudgetProject, UserSettings, ViewType } from '../../types';
import {
  register as supabaseRegister,
  getAIConfigs,
  saveAIConfig,
  deleteAIConfig,
  testAIConfig,
  createPayee,
  updatePayee,
  deletePayee,
  createProject,
  updateProject,
  deleteProject,
} from '../../api/supabase-client';

// 模型定价信息 (2025年11月最新)
const MODEL_PRICING: Record<string, { name: string; inputPrice: number; outputPrice: number; isFree: boolean }> = {
    gemini: { name: 'Google Gemini', inputPrice: 0, outputPrice: 0, isFree: true },
    doubao: { name: '火山引擎 (豆包)', inputPrice: 0.8, outputPrice: 2, isFree: false },
    volcengine: { name: '火山引擎', inputPrice: 0.8, outputPrice: 2, isFree: false },
    deepseek: { name: 'DeepSeek', inputPrice: 2, outputPrice: 3, isFree: false },
    openai: { name: 'OpenAI', inputPrice: 36, outputPrice: 108, isFree: false },
    claude: { name: 'Anthropic Claude', inputPrice: 21.6, outputPrice: 108, isFree: false },
    glm: { name: '智谱 GLM', inputPrice: 10, outputPrice: 10, isFree: false },
    qwen: { name: '通义千问', inputPrice: 3, outputPrice: 9, isFree: false },
    minimax: { name: 'MiniMax', inputPrice: 1, outputPrice: 1, isFree: false },
    moonshot: { name: 'Moonshot', inputPrice: 60, outputPrice: 60, isFree: false },
};

interface SettingsViewProps {
  settings: UserSettings;
  onUpdate: React.Dispatch<React.SetStateAction<UserSettings>>;
  onNavigate?: (view: ViewType) => void;
}

/**
 * 设置页面组件
 *
 * 功能:
 * - 用户管理 (超级管理员): 添加/删除用户,切换管理员权限
 * - 收款信息: 银行卡账户管理,设置默认账户
 * - 预算项目: 项目名称和编码管理
 * - AI配置 (超级管理员): 多模型支持,API Key管理
 * - 消费统计 (超级管理员): AI调用消费统计
 */
export const SettingsView = ({ settings, onUpdate, onNavigate }: SettingsViewProps) => {
    const [activeTab, setActiveTab] = useState<'users' | 'payment' | 'budget' | 'ai' | 'usage'>('payment');
    // 使用 role 字段判断是否为管理员
    const isSuperAdmin = settings.currentUser?.role === 'admin';

    // 用户管理组件
    const UserManagementTab = () => {
        const [showAddForm, setShowAddForm] = useState(false);
        const [newUser, setNewUser] = useState({
            name: '',
            email: '',
            department: '',
            password: '',
            role: 'user' as 'user' | 'admin'
        });
        const [editingUser, setEditingUser] = useState<string | null>(null);

        const users = settings.users || [];

        const handleAddUser = async () => {
            if (!newUser.name || !newUser.email || !newUser.password) {
                alert('请填写完整的用户信息');
                return;
            }

            try {
                // 调用 Supabase 注册用户
                await supabaseRegister({
                    name: newUser.name,
                    email: newUser.email,
                    password: newUser.password,
                    department: newUser.department,
                });

                // 更新本地状态
                const user = {
                    id: `user_${Date.now()}`,
                    name: newUser.name,
                    email: newUser.email,
                    department: newUser.department,
                    role: newUser.role,
                };

                onUpdate({
                    ...settings,
                    users: [...users, user]
                });

                setNewUser({ name: '', email: '', department: '', password: '', role: 'user' });
                setShowAddForm(false);
                alert('用户添加成功');
            } catch (error: any) {
                alert(error.message || '添加用户失败');
            }
        };

        const handleDeleteUser = (userId: string) => {
            if (userId === settings.currentUser?.id) {
                alert('不能删除当前登录用户');
                return;
            }
            if (confirm('确定要删除该用户吗？此操作不可撤销。')) {
                onUpdate({
                    ...settings,
                    users: users.filter((u: any) => u.id !== userId)
                });
            }
        };

        const handleToggleRole = (userId: string) => {
            if (userId === settings.currentUser?.id) {
                alert('不能修改当前登录用户的权限');
                return;
            }
            onUpdate({
                ...settings,
                users: users.map((u: any) =>
                    u.id === userId
                        ? { ...u, role: u.role === 'admin' ? 'user' : 'admin' }
                        : u
                )
            });
        };

        return (
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Users size={20} /> 用户管理
                    </h3>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Plus size={16} />
                        添加用户
                    </button>
                </div>

                {/* 添加用户表单 */}
                {showAddForm && (
                    <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-200">
                        <h4 className="font-bold text-sm text-slate-700 mb-4">添加新用户</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">姓名 *</label>
                                <input
                                    value={newUser.name}
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                    placeholder="请输入姓名"
                                    className="w-full p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">邮箱 *</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    placeholder="请输入邮箱"
                                    className="w-full p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">部门</label>
                                <input
                                    value={newUser.department}
                                    onChange={e => setNewUser({ ...newUser, department: e.target.value })}
                                    placeholder="请输入部门"
                                    className="w-full p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">初始密码 *</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="请输入初始密码"
                                    className="w-full p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">角色</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value as 'user' | 'admin' })}
                                    className="w-full p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 transition-all"
                                >
                                    <option value="user">普通用户</option>
                                    <option value="admin">管理员</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={handleAddUser}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                确认添加
                            </button>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                )}

                {/* 用户列表 */}
                <div className="space-y-3">
                    {users.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Users size={48} className="mx-auto mb-4 opacity-50" />
                            <p>暂无用户</p>
                        </div>
                    ) : (
                        users.map((user: any) => (
                            <div
                                key={user.id}
                                className={`flex items-center justify-between p-4 bg-white rounded-xl border ${
                                    user.id === settings.currentUser?.id
                                        ? 'border-indigo-300 bg-slate-100/50'
                                        : 'border-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                                        user.role === 'admin' ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                                    }`}>
                                        {user.name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{user.name}</span>
                                            {user.role === 'admin' && (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-bold">
                                                    管理员
                                                </span>
                                            )}
                                            {user.id === settings.currentUser?.id && (
                                                <span className="px-2 py-0.5 bg-indigo-100 text-slate-800 text-xs rounded-full font-bold">
                                                    当前用户
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500">{user.email}</p>
                                        {user.department && (
                                            <p className="text-xs text-slate-400">{user.department}</p>
                                        )}
                                    </div>
                                </div>

                                {user.id !== settings.currentUser?.id && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggleRole(user.id)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                user.role === 'admin'
                                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                            }`}
                                            title={user.role === 'admin' ? '取消管理员权限' : '设为管理员'}
                                        >
                                            {user.role === 'admin' ? '取消管理员' : '设为管理员'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                            title="删除用户"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* 权限说明 */}
                <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2">
                        <Info size={16} /> 权限说明
                    </h4>
                    <ul className="text-sm text-slate-600 space-y-1">
                        <li>• <strong>管理员</strong>：可以管理所有用户、查看所有数据、配置系统设置</li>
                        <li>• <strong>普通用户</strong>：只能管理自己的报销数据，无法访问用户管理</li>
                        <li>• 每个用户的数据相互隔离，互不影响</li>
                    </ul>
                </div>
            </div>
        );
    };

    // AI 配置组件 - 支持10+个模型供应商
    const AISettings = () => {
        const [configs, setConfigs] = useState<any[]>([]);
        const [loading, setLoading] = useState(false);
        const [showForm, setShowForm] = useState(false);
        const [formData, setFormData] = useState({
            provider: 'gemini',
            name: '',
            apiKey: '',
            apiUrl: '',
            model: '',
            endpointId: '',
            isActive: false,
        });
        const [testing, setTesting] = useState(false);
        const [testResult, setTestResult] = useState<any>(null);

        const providers: Record<string, {
            name: string;
            description: string;
            models: { id: string; name: string; vision?: boolean }[];
            baseUrl?: string;
            needsEndpointId?: boolean;
        }> = {
            gemini: {
                name: 'Google Gemini',
                description: 'Google 多模态 AI，支持图像识别（支持代理）',
                baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
                models: [
                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (推荐)', vision: true },
                    { id: 'gemini-2.5-pro-preview-03-25', name: 'Gemini 2.5 Pro Preview', vision: true },
                    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', vision: true },
                    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', vision: true },
                ]
            },
            deepseek: {
                name: 'DeepSeek',
                description: '高性价比国产模型',
                baseUrl: 'https://api.deepseek.com',
                models: [
                    { id: 'deepseek-chat', name: 'DeepSeek Chat (推荐)' },
                    { id: 'deepseek-coder', name: 'DeepSeek Coder' },
                    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
                ]
            },
            openai: {
                name: 'OpenAI',
                description: 'GPT 系列模型，支持图像识别',
                models: [
                    { id: 'gpt-4o', name: 'GPT-4o (推荐)', vision: true },
                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', vision: true },
                    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', vision: true },
                    { id: 'gpt-4', name: 'GPT-4' },
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
                ]
            },
            claude: {
                name: 'Claude (Anthropic)',
                description: 'Anthropic Claude，支持图像识别',
                models: [
                    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (推荐)', vision: true },
                    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', vision: true },
                    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', vision: true },
                ]
            },
            glm: {
                name: '智谱 GLM',
                description: '智谱清言多模态，支持图像识别',
                baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
                models: [
                    { id: 'glm-4v-plus', name: 'GLM-4V Plus (推荐)', vision: true },
                    { id: 'glm-4v', name: 'GLM-4V', vision: true },
                    { id: 'glm-4-plus', name: 'GLM-4 Plus' },
                    { id: 'glm-4-flash', name: 'GLM-4 Flash (免费)' },
                ]
            },
            qwen: {
                name: '通义千问',
                description: '阿里云千问，支持图像识别',
                baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                models: [
                    { id: 'qwen-vl-max', name: 'Qwen VL Max (推荐)', vision: true },
                    { id: 'qwen-vl-plus', name: 'Qwen VL Plus', vision: true },
                    { id: 'qwen-max', name: 'Qwen Max' },
                    { id: 'qwen-turbo', name: 'Qwen Turbo' },
                ]
            },
            minimax: {
                name: 'MiniMax',
                description: 'MiniMax AI 模型',
                baseUrl: 'https://api.minimax.chat/v1',
                models: [
                    { id: 'abab6.5s-chat', name: 'ABAB 6.5s Chat (推荐)' },
                    { id: 'abab6.5-chat', name: 'ABAB 6.5 Chat' },
                ]
            },
            moonshot: {
                name: 'Moonshot (月之暗面)',
                description: 'Kimi AI 模型',
                baseUrl: 'https://api.moonshot.cn/v1',
                models: [
                    { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K (推荐)' },
                    { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K' },
                ]
            },
            doubao: {
                name: '火山引擎 (豆包)',
                description: '字节跳动豆包大模型，需填写 Endpoint ID',
                baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
                needsEndpointId: true,
                models: [
                    { id: 'doubao-seed-2-0-mini', name: 'Doubao Seed 2.0 Mini (推荐)', vision: true },
                    { id: 'doubao-seed-1.6-vision', name: 'Doubao Seed 1.6 Vision', vision: true },
                    { id: 'doubao-1.5-vision-pro-250328', name: 'Doubao 1.5 Vision Pro', vision: true },
                    { id: 'doubao-seed-1.6', name: 'Doubao Seed 1.6' },
                ]
            },
        };

        const getDefaultModel = (provider: string) => {
            const p = providers[provider];
            return p?.models[0]?.id || '';
        };

        const loadConfigs = async () => {
            setLoading(true);
            try {
                const data = await getAIConfigs(settings.currentUser?.id || '');
                setConfigs(data?.configs || []);
            } catch (e) {
                console.error('加载配置失败', e);
                setConfigs([]);
            }
            setLoading(false);
        };

        useEffect(() => {
            loadConfigs();
        }, []);

        const handleSave = async () => {
            if (!formData.apiKey) return alert('请输入 API Key');
            const providerInfo = providers[formData.provider];
            if (providerInfo?.needsEndpointId && !formData.endpointId) {
                return alert('请输入 Endpoint ID');
            }
            try {
                const selectedModel = providerInfo?.needsEndpointId
                    ? formData.endpointId
                    : (formData.model || getDefaultModel(formData.provider));
                await saveAIConfig({
                    userId: settings.currentUser?.id || '',
                    provider: formData.provider,
                    name: formData.name || providerInfo?.name || formData.provider,
                    apiKey: formData.apiKey,
                    apiUrl: formData.apiUrl || providerInfo?.baseUrl || '',
                    model: selectedModel,
                    isDefault: formData.isActive,
                });
                await loadConfigs();
                setShowForm(false);
                setFormData({ provider: 'gemini', name: '', apiKey: '', apiUrl: '', model: '', endpointId: '', isActive: false });
                alert('配置已保存');
            } catch (e) {
                alert('保存失败');
            }
        };

        const handleTest = async () => {
            if (!formData.apiKey) return alert('请输入 API Key');
            const providerInfo = providers[formData.provider];
            if (providerInfo?.needsEndpointId && !formData.endpointId) {
                return alert('请输入 Endpoint ID');
            }
            setTesting(true);
            setTestResult(null);
            try {
                const selectedModel = providerInfo?.needsEndpointId
                    ? formData.endpointId
                    : (formData.model || getDefaultModel(formData.provider));
                const data = await testAIConfig({
                    userId: settings.currentUser?.id || '',
                    provider: formData.provider,
                    apiKey: formData.apiKey,
                    apiUrl: providerInfo?.baseUrl || '',
                    model: selectedModel,
                });
                setTestResult(data);
            } catch (e: any) {
                setTestResult({ success: false, message: e.message });
            } finally {
                setTesting(false);
            }
        };

        const handleDelete = async (id: string) => {
            if (!confirm('确定删除该配置？')) return;
            try {
                await deleteAIConfig(id, settings.currentUser.id);
                await loadConfigs();
            } catch (e) {
                alert('删除失败');
            }
        };

        const handleSetActive = async (config: any) => {
            try {
                await saveAIConfig({
                    userId: settings.currentUser.id,
                    id: config.id,
                    provider: config.provider,
                    name: config.name,
                    apiKey: config.api_key,
                    apiUrl: config.api_url,
                    model: config.model,
                    isDefault: true,
                });
                await loadConfigs();
            } catch (e) {
                alert('设置失败');
            }
        };

        return (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Settings size={20}/> AI 模型配置
                    </h3>
                    <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-indigo-700">
                        <Plus size={16}/> 添加配置
                    </button>
                </div>

                {/* 添加表单 */}
                {showForm && (
                    <div className="bg-slate-50 border border-indigo-200 p-6 rounded-xl mb-6">
                        <h4 className="font-bold text-indigo-800 mb-4">新增 AI 配置</h4>

                        {/* 提供商选择 */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 mb-2">选择 AI 模型</label>
                            <div className="grid grid-cols-4 gap-2">
                                {Object.entries(providers).map(([key, info]) => (
                                    <button
                                        key={key}
                                        onClick={() => setFormData({ ...formData, provider: key })}
                                        className={`p-3 rounded-lg border-2 text-left transition-all text-sm ${formData.provider === key ? 'border-indigo-500 bg-slate-100' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="font-bold text-slate-800">{info.name}</div>
                                        <div className="text-xs text-slate-400">{info.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">配置名称</label>
                                <input
                                    placeholder={providers[formData.provider]?.name || '配置名称'}
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-2 rounded border border-slate-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">选择模型</label>
                                <select
                                    value={formData.model || getDefaultModel(formData.provider)}
                                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    className="w-full p-2 rounded border border-slate-200 text-sm bg-white"
                                >
                                    {providers[formData.provider]?.models.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} {m.vision ? '📷' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">📷 表示支持图像识别</p>
                            </div>
                        </div>

                        {/* 自定义 API 地址 */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 mb-1">自定义 API 地址 (可选)</label>
                            <input
                                type="text"
                                placeholder={providers[formData.provider]?.baseUrl || '使用默认地址'}
                                value={formData.apiUrl}
                                onChange={e => setFormData({ ...formData, apiUrl: e.target.value })}
                                className="w-full p-2 rounded border border-slate-200 text-sm font-mono"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                {formData.provider === 'gemini' && '推荐代理：https://lobegoogle.vercel.app/api/proxy/google'}
                                {formData.provider === 'openai' && '可使用 OpenAI 兼容的第三方 API'}
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 mb-1">API Key *</label>
                            <input
                                type="password"
                                placeholder="请输入 API Key"
                                value={formData.apiKey}
                                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                className="w-full p-2 rounded border border-slate-200 text-sm font-mono"
                            />
                        </div>

                        {/* 火山引擎 Endpoint ID 配置 */}
                        {providers[formData.provider]?.needsEndpointId && (
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    Endpoint ID * <span className="font-normal text-slate-400">(必填)</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="ep-20241128xxxxxx-xxxxx"
                                    value={formData.endpointId}
                                    onChange={e => setFormData({ ...formData, endpointId: e.target.value })}
                                    className="w-full p-2 rounded border border-slate-200 text-sm font-mono"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    在<a href="https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint" target="_blank" rel="noopener" className="text-slate-600 hover:underline">火山方舟控制台</a>创建推理接入点后获取
                                </p>
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                id="aiActiveCheck"
                            />
                            <label htmlFor="aiActiveCheck" className="text-sm text-slate-600">设为默认配置</label>
                        </div>

                        {testResult && (
                            <div className={`p-3 rounded-lg mb-4 ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {testResult.success ? '✅ 连接成功' : `❌ 连接失败: ${testResult.message || '请检查配置'}`}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button onClick={handleTest} disabled={testing} className="bg-slate-100 text-slate-600 px-4 py-2 rounded text-sm font-bold hover:bg-slate-200 disabled:opacity-50">
                                {testing ? '测试中...' : '测试连接'}
                            </button>
                            <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-indigo-700">
                                保存配置
                            </button>
                            <button onClick={() => { setShowForm(false); setTestResult(null); }} className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded text-sm">
                                取消
                            </button>
                        </div>
                    </div>
                )}

                {/* 配置列表 */}
                {loading ? (
                    <div className="text-center py-8 text-slate-400">加载中...</div>
                ) : configs.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="text-4xl mb-3">🤖</div>
                        <p className="text-slate-600 font-bold mb-2">尚未配置 AI 模型</p>
                        <p className="text-slate-400 text-sm mb-4">配置后可使用 AI 智能识别发票和审批单</p>
                        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold">
                            添加第一个配置
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {configs.map((config: any) => (
                            <div key={config.id} className={`p-4 rounded-xl border-2 ${config.isActive ? 'border-indigo-500 bg-slate-100/50' : 'border-slate-200 bg-white'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{config.name || providers[config.provider as keyof typeof providers]?.name}</span>
                                            {config.isActive && (
                                                <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-slate-800 rounded-full font-bold">默认</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            模型: {config.model} | API Key: {config.apiKey?.slice(0, 8)}****
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {!config.isActive && (
                                            <button onClick={() => handleSetActive(config)} className="text-xs text-slate-700 font-bold hover:underline">设为默认</button>
                                        )}
                                        <button onClick={() => handleDelete(config.id)} className="text-slate-400 hover:text-red-500">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 使用说明 */}
                <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <h4 className="font-bold text-amber-800 mb-2">💡 使用说明</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                        <li>• 配置 AI 模型后，上传发票/审批单时将自动识别信息</li>
                        <li>• 推荐使用 Google Gemini（免费额度）或 DeepSeek（性价比高）</li>
                        <li>• API Key 会安全存储，仅用于调用 AI 服务</li>
                    </ul>
                </div>
            </div>
        );
    };

    // 个人设置
    const ProfileSettings = () => {
        const [profile, setProfile] = useState(settings.currentUser);
        const [pass, setPass] = useState("");

        const handleSave = () => {
            onUpdate({ ...settings, currentUser: profile });
            alert("个人信息已更新");
            setPass("");
        };

        return (
            <div className="max-w-xl">
                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><User size={20}/> 个人信息管理</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">姓名</label>
                        <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 transition-all"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">部门</label>
                        <input value={profile.department} onChange={e => setProfile({...profile, department: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 transition-all"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">邮箱</label>
                        <input value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 transition-all"/>
                    </div>
                    <button onClick={handleSave} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all">
                        保存修改
                    </button>
                </div>
            </div>
        );
    };

    // 收款信息管理
    const PaymentSettings = () => {
        const [isAdding, setIsAdding] = useState(false);
        const [newCard, setNewCard] = useState<PaymentAccount>({ id: '', bankName: '', bankBranch: '', accountNumber: '', accountName: '', isDefault: false });
        const [isLoading, setIsLoading] = useState(false);

        const handleAdd = async () => {
            if(!newCard.accountNumber || !newCard.bankName || !newCard.accountName) return alert("信息不完整");
            setIsLoading(true);
            try {
                const result = await createPayee({
                    userId: settings.currentUser?.id || '',
                    bankName: newCard.bankName,
                    bankBranch: newCard.bankBranch,
                    accountNumber: newCard.accountNumber,
                    accountName: newCard.accountName,
                    isDefault: newCard.isDefault,
                });
                // 更新本地状态
                const account = { ...newCard, id: result.paymentAccount.id };
                const updatedAccounts = newCard.isDefault
                    ? settings.paymentAccounts.map((a:any) => ({ ...a, isDefault: false }))
                    : settings.paymentAccounts;
                onUpdate({ ...settings, paymentAccounts: [...updatedAccounts, account] });
                setIsAdding(false);
                setNewCard({ id: '', bankName: '', bankBranch: '', accountNumber: '', accountName: '', isDefault: false });
            } catch (error: any) {
                alert(error.message || '添加失败');
            } finally {
                setIsLoading(false);
            }
        };

        const deleteAccount = async (id: string) => {
             if(confirm("确定删除该收款账户吗？")) {
                 try {
                     await deletePayee(id, settings.currentUser?.id || '');
                     onUpdate({ ...settings, paymentAccounts: settings.paymentAccounts.filter((a:any) => a.id !== id) });
                 } catch (error: any) {
                     alert(error.message || '删除失败');
                 }
             }
        };

        const setDefault = async (id: string) => {
            try {
                await updatePayee(id, settings.currentUser?.id || '', { isDefault: true });
                const updated = settings.paymentAccounts.map((a:any) => ({ ...a, isDefault: a.id === id }));
                onUpdate({ ...settings, paymentAccounts: updated });
            } catch (error: any) {
                alert(error.message || '设置默认账户失败');
            }
        };

        return (
            <div>
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><CreditCard size={20}/> 收款信息管理</h3>
                    <button onClick={() => setIsAdding(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-indigo-700"><Plus size={16}/> 添加银行卡</button>
                 </div>

                 {isAdding && (
                     <div className="bg-slate-50 border border-indigo-200 p-4 rounded-xl mb-6 shadow-sm">
                         <h4 className="font-bold text-sm text-indigo-800 mb-3">新收款账户</h4>
                         <div className="grid grid-cols-2 gap-4 mb-4">
                             <input placeholder="开户行" value={newCard.bankName} onChange={e => setNewCard({...newCard, bankName: e.target.value})} className="p-2 rounded border border-slate-200 text-sm"/>
                             <input placeholder="支行名称" value={newCard.bankBranch} onChange={e => setNewCard({...newCard, bankBranch: e.target.value})} className="p-2 rounded border border-slate-200 text-sm"/>
                             <input placeholder="收款人姓名" value={newCard.accountName} onChange={e => setNewCard({...newCard, accountName: e.target.value})} className="p-2 rounded border border-slate-200 text-sm"/>
                             <input placeholder="银行卡号" value={newCard.accountNumber} onChange={e => setNewCard({...newCard, accountNumber: e.target.value})} className="p-2 rounded border border-slate-200 text-sm"/>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm font-bold">确认添加</button>
                             <button onClick={() => setIsAdding(false)} className="bg-white border border-slate-300 text-slate-600 px-4 py-1.5 rounded text-sm">取消</button>
                         </div>
                     </div>
                 )}

                 <div className="grid md:grid-cols-2 gap-4">
                     {settings.paymentAccounts.map((acc: PaymentAccount) => (
                         <div key={acc.id} className={`relative p-6 rounded-2xl border-2 transition-all group ${acc.isDefault ? 'border-indigo-500 bg-slate-100/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                             {acc.isDefault && (
                                 <span className="absolute top-4 right-4 bg-indigo-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Check size={10}/> 默认</span>
                             )}
                             <div className="flex items-center gap-3 mb-4">
                                 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                     <Landmark size={20}/>
                                 </div>
                                 <div>
                                     <div className="font-bold text-slate-800">{acc.bankName}</div>
                                     <div className="text-xs text-slate-400">{acc.bankBranch || '总行'}</div>
                                 </div>
                             </div>
                             <div className="font-mono text-xl text-slate-700 tracking-wider mb-4">
                                 **** **** **** {acc.accountNumber.slice(-4)}
                             </div>
                             <div className="flex justify-between items-end">
                                 <div className="text-xs text-slate-400">持卡人：<span className="text-slate-600 font-bold">{acc.accountName}</span></div>
                                 <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     {!acc.isDefault && <button onClick={() => setDefault(acc.id)} className="text-xs text-slate-700 font-bold hover:underline">设为默认</button>}
                                     <button onClick={() => deleteAccount(acc.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
        )
    };

    // 预算项目管理
    const BudgetSettings = () => {
        const [newProj, setNewProj] = useState<BudgetProject>({ id: '', name: '', code: '' });
        const [isLoading, setIsLoading] = useState(false);

        const addProject = async () => {
            if(!newProj.name || !newProj.code) return alert("请填写完整");
            setIsLoading(true);
            try {
                const result = await createProject({
                    userId: settings.currentUser?.id || '',
                    name: newProj.name,
                    code: newProj.code,
                    isDefault: newProj.isDefault,
                });
                const project = { ...newProj, id: result.budgetProject.id };
                const updatedProjs = newProj.isDefault
                    ? settings.budgetProjects.map((p:any) => ({ ...p, isDefault: false }))
                    : settings.budgetProjects;
                onUpdate({ ...settings, budgetProjects: [...updatedProjs, project] });
                setNewProj({ id: '', name: '', code: '' });
            } catch (error: any) {
                alert(error.message || '添加失败');
            } finally {
                setIsLoading(false);
            }
        };

        const handleDeleteProject = async (id: string) => {
             if(confirm("确定删除该预算项目吗？")) {
                 try {
                     await deleteProject(id, settings.currentUser?.id || '');
                     onUpdate({ ...settings, budgetProjects: settings.budgetProjects.filter((p:any) => p.id !== id) });
                 } catch (error: any) {
                     alert(error.message || '删除失败');
                 }
             }
        };

        const setDefault = async (id: string) => {
            try {
                await updateProject(id, settings.currentUser?.id || '', { isDefault: true });
                const updated = settings.budgetProjects.map((p:any) => ({ ...p, isDefault: p.id === id }));
                onUpdate({ ...settings, budgetProjects: updated });
            } catch (error: any) {
                alert(error.message || '设置默认项目失败');
            }
        };

        return (
            <div>
                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><Briefcase size={20}/> 预算项目管理</h3>

                <div className="flex gap-4 mb-6 items-end">
                     <div className="flex-1">
                         <label className="text-xs font-bold text-slate-500 mb-1 block">项目名称</label>
                         <input value={newProj.name} onChange={e => setNewProj({...newProj, name: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" placeholder="例如：2024市场推广费"/>
                     </div>
                     <div className="w-32">
                         <label className="text-xs font-bold text-slate-500 mb-1 block">预算编码</label>
                         <input value={newProj.code} onChange={e => setNewProj({...newProj, code: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" placeholder="MK-001"/>
                     </div>
                     <button onClick={addProject} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm h-[38px]">添加</button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                         <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
                             <tr>
                                 <th className="p-3">项目名称</th>
                                 <th className="p-3">编码</th>
                                 <th className="p-3 text-right">操作</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {settings.budgetProjects.map((p: BudgetProject) => (
                                 <tr key={p.id} className="hover:bg-slate-50 group">
                                     <td className="p-3 font-medium">{p.name}</td>
                                     <td className="p-3 font-mono text-slate-500">{p.code}</td>
                                     <td className="p-3 text-right">
                                         <button onClick={() => handleDeleteProject(p.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                    </table>
                </div>
            </div>
        )
    };

    return (
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8 items-start h-full">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 flex-shrink-0">
                 <h2 className="text-2xl font-bold text-slate-800 mb-6">系统设置</h2>
                 <div className="space-y-1 bg-white rounded-xl border border-slate-200 p-2 shadow-sm">
                     {isSuperAdmin && (
                         <button onClick={() => setActiveTab('users')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === 'users' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                             <Users size={18}/> 用户管理
                         </button>
                     )}
                     <button onClick={() => setActiveTab('payment')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === 'payment' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                         <CreditCard size={18}/> 收款信息
                     </button>
                     <button onClick={() => setActiveTab('budget')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === 'budget' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                         <Briefcase size={18}/> 预算项目
                     </button>
                    {isSuperAdmin && (
                        <>
                            <div className="my-2 border-t border-slate-100"></div>
                            <button onClick={() => setActiveTab('ai')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === 'ai' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                                <ScanLine size={18}/> AI 配置
                            </button>
                            <button onClick={() => setActiveTab('usage')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors ${activeTab === 'usage' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                                <Activity size={18}/> 消费统计
                            </button>
                        </>
                    )}
                 </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm min-h-[500px]">
                {activeTab === 'users' && isSuperAdmin && <UserManagementTab />}
                {activeTab === 'payment' && <PaymentSettings />}
                {activeTab === 'budget' && <BudgetSettings />}
                {activeTab === 'ai' && isSuperAdmin && <AISettings />}
                {activeTab === 'usage' && isSuperAdmin && <UsageStats settings={settings} />}
            </div>
        </div>
    )
};

// Token 消费统计组件
const UsageStats = ({ settings }: { settings: UserSettings }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');

    const userId = settings?.currentUser?.id || 'default';

    useEffect(() => {
        fetchStats();
    }, [period, userId]);

    const fetchStats = async () => {
        setLoading(true);
        // Token 统计暂未接入 Supabase，显示空数据
        setStats({ summary: { totalTokens: 0, totalCost: 0, usageCount: 0 }, byProvider: [], recentUsages: [] });
        setLoading(false);
    };

    const formatTokens = (tokens: number) => {
        if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
        if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
        return tokens.toString();
    };

    const formatCurrency = (amount: number) => {
        if (amount === 0) return '¥0.00';
        if (amount < 0.01) return `¥${amount.toFixed(6)}`;
        if (amount < 1) return `¥${amount.toFixed(4)}`;
        return `¥${amount.toFixed(2)}`;
    };

    const periodLabels: Record<string, string> = {
        day: '今日',
        week: '本周',
        month: '本月',
        year: '今年',
        all: '全部',
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="text-slate-600" size={24} />
                    Token 消费统计
                </h3>
                <div className="flex gap-2">
                    {(['day', 'week', 'month', 'year', 'all'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                period === p 
                                    ? 'bg-slate-800 text-white' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {periodLabels[p]}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader className="animate-spin text-slate-600" size={32} />
                </div>
            ) : !stats || stats.summary?.usageCount === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <Activity size={48} className="mx-auto mb-4 opacity-30" />
                    <p>暂无 {periodLabels[period]} 使用记录</p>
                    <p className="text-sm mt-2">开始使用 AI 识别功能后，这里会显示消费统计</p>
                </div>
            ) : (
                <>
                    {/* 概览卡片 */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
                            <div className="text-sm opacity-80">总消费</div>
                            <div className="text-2xl font-bold mt-1">
                                {formatCurrency(stats.summary?.totalCost || 0)}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
                            <div className="text-sm opacity-80">总 Tokens</div>
                            <div className="text-2xl font-bold mt-1">
                                {formatTokens(stats.summary?.totalTokens || 0)}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
                            <div className="text-sm opacity-80">调用次数</div>
                            <div className="text-2xl font-bold mt-1">
                                {stats.summary?.usageCount || 0} 次
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                            <div className="text-sm opacity-80">平均成本</div>
                            <div className="text-2xl font-bold mt-1">
                                {formatCurrency((stats.summary?.totalCost || 0) / Math.max(stats.summary?.usageCount || 1, 1))}
                            </div>
                        </div>
                    </div>

                    {/* 按厂商统计 */}
                    {stats.byProvider && stats.byProvider.length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-6">
                            <h4 className="font-bold text-slate-700 mb-4">按模型厂商统计</h4>
                            <div className="space-y-3">
                                {stats.byProvider.map((item: any) => {
                                    const pricing = MODEL_PRICING[item.provider];
                                    const maxCost = Math.max(...stats.byProvider.map((p: any) => p.totalCost), 1);
                                    const barWidth = (item.totalCost / maxCost) * 100;
                                    
                                    return (
                                        <div key={item.provider} className="relative">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-medium text-slate-700 flex items-center gap-2">
                                                    {item.providerName || pricing?.name || item.provider}
                                                    {(pricing?.isFree || item.isFree) && (
                                                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">免费</span>
                                                    )}
                                                </span>
                                                <span className="text-sm text-slate-500">
                                                    {formatTokens(item.totalTokens)} tokens · {item.usageCount} 次
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all ${item.isFree || pricing?.isFree ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                                        style={{ width: `${Math.max(barWidth, 2)}%` }}
                                                    />
                                                </div>
                                                <span className="font-bold text-slate-800 min-w-[80px] text-right">
                                                    {formatCurrency(item.totalCost)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 最近使用记录 */}
                    {stats.recentUsages && stats.recentUsages.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100">
                                <h4 className="font-bold text-slate-700">最近使用记录</h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">时间</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">模型</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">操作</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">Tokens</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">费用</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {stats.recentUsages.map((usage: any) => {
                                            const pricing = MODEL_PRICING[usage.provider];
                                            return (
                                                <tr key={usage.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 text-sm text-slate-600">
                                                        {new Date(usage.createdAt).toLocaleString('zh-CN', { 
                                                            month: '2-digit', 
                                                            day: '2-digit', 
                                                            hour: '2-digit', 
                                                            minute: '2-digit' 
                                                        })}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-sm font-medium text-slate-700">
                                                            {usage.providerName || pricing?.name || usage.provider}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-500">
                                                        {usage.operation || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                                                        {formatTokens(usage.totalTokens)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={`text-sm font-medium ${(pricing?.isFree || usage.totalCost === 0) ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                            {(pricing?.isFree || usage.totalCost === 0) ? '免费' : formatCurrency(usage.totalCost)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
