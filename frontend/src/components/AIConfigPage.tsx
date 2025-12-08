/**
 * AI 配置页面组件
 * 
 * 用于管理用户的 AI 模型配置
 * 支持 Gemini、DeepSeek、MiniMax、GLM、OpenAI、Claude、通义千问
 */

import React, { useState } from 'react'
import { useAIConfig, AI_PROVIDERS, AIProviderType, AIConfig } from '../api/hooks'

interface AIConfigPageProps {
  userId: string
  onBack?: () => void
}

/**
 * AI 配置卡片组件
 */
const ConfigCard: React.FC<{
  config: AIConfig
  isDefault: boolean
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}> = ({ config, isDefault, onEdit, onDelete, onSetDefault }) => {
  const provider = AI_PROVIDERS[config.provider as AIProviderType]
  
  return (
    <div className={`
      bg-white rounded-xl border-2 p-5 transition-all
      ${isDefault ? 'border-blue-500 shadow-md' : 'border-gray-100 hover:border-gray-200'}
    `}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`
            w-12 h-12 rounded-lg flex items-center justify-center text-xl
            ${isDefault ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
          `}>
            🤖
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              {config.name}
              {isDefault && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">
                  默认
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500">{provider?.name || config.provider}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isDefault && (
            <button
              onClick={onSetDefault}
              className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1"
            >
              设为默认
            </button>
          )}
          <button
            onClick={onEdit}
            className="text-sm text-gray-600 hover:text-gray-700 px-2 py-1"
          >
            编辑
          </button>
          <button
            onClick={onDelete}
            className="text-sm text-red-500 hover:text-red-600 px-2 py-1"
          >
            删除
          </button>
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">模型：</span>
          <span className="text-gray-700">{config.model || '默认'}</span>
        </div>
        <div>
          <span className="text-gray-500">API Key：</span>
          <span className="text-gray-700 font-mono">
            {config.apiKey ? `${config.apiKey.slice(0, 8)}****` : '未设置'}
          </span>
        </div>
        {config.apiUrl && (
          <div className="col-span-2">
            <span className="text-gray-500">API 地址：</span>
            <span className="text-gray-700 font-mono text-xs">{config.apiUrl}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * AI 配置编辑表单
 */
const ConfigForm: React.FC<{
  config?: AIConfig
  onSave: (config: Omit<AIConfig, 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
  onTest: (config: { provider: string; apiKey: string; apiUrl?: string; model?: string }) => Promise<any>
  testing: boolean
  testResult: { success: boolean; message?: string; responseTime?: number } | null
}> = ({ config, onSave, onCancel, onTest, testing, testResult }) => {
  const [provider, setProvider] = useState<AIProviderType>(config?.provider || 'gemini')
  const [name, setName] = useState(config?.name || '')
  const [apiKey, setApiKey] = useState(config?.apiKey || '')
  const [apiUrl, setApiUrl] = useState(config?.apiUrl || '')
  const [model, setModel] = useState(config?.model || '')
  const [isDefault, setIsDefault] = useState(config?.isDefault || false)
  const [saving, setSaving] = useState(false)

  const providerInfo = AI_PROVIDERS[provider]

  // 切换提供商时重置 URL 和模型
  const handleProviderChange = (newProvider: AIProviderType) => {
    setProvider(newProvider)
    const info = AI_PROVIDERS[newProvider]
    setApiUrl('')
    setModel(info.defaultModel)
    if (!name || name === AI_PROVIDERS[provider].name) {
      setName(info.name)
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      alert('请输入 API Key')
      return
    }
    
    setSaving(true)
    try {
      await onSave({
        id: config?.id || `ai-config-${Date.now()}`,
        provider,
        name: name || providerInfo.name,
        apiKey: apiKey.trim(),
        apiUrl: apiUrl.trim() || undefined,
        model: model || providerInfo.defaultModel,
        isDefault,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!apiKey.trim()) {
      alert('请输入 API Key')
      return
    }
    
    await onTest({
      provider,
      apiKey: apiKey.trim(),
      apiUrl: apiUrl.trim() || undefined,
      model: model || providerInfo.defaultModel,
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        {config ? '编辑 AI 配置' : '添加 AI 配置'}
      </h3>

      <div className="space-y-5">
        {/* 提供商选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            AI 模型提供商
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(AI_PROVIDERS).map(([key, info]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleProviderChange(key as AIProviderType)}
                className={`
                  p-3 rounded-lg border-2 text-left transition-all
                  ${provider === key 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                  }
                `}
              >
                <div className="font-medium text-gray-900 text-sm">{info.name}</div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-1">{info.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 配置名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            配置名称
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={providerInfo.name}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Key <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="请输入您的 API Key"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-mono"
          />
          <p className="mt-1 text-xs text-gray-500">
            API Key 将安全存储，仅用于调用 AI 服务
          </p>
        </div>

        {/* API 地址（可选） */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API 地址（可选）
          </label>
          <input
            type="text"
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
            placeholder={providerInfo.defaultUrl}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            留空使用默认地址，或填写代理/私有部署地址
          </p>
        </div>

        {/* 模型选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            模型
          </label>
          <select
            value={model || providerInfo.defaultModel}
            onChange={e => setModel(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          >
            {providerInfo.models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* 设为默认 */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={e => setIsDefault(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">设为默认配置</span>
        </label>

        {/* 测试结果 */}
        {testResult && (
          <div className={`p-4 rounded-lg ${
            testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <span>{testResult.success ? '✅' : '❌'}</span>
              <span className="font-medium">
                {testResult.success ? '测试成功' : '测试失败'}
              </span>
              {testResult.responseTime && (
                <span className="text-sm opacity-75">
                  (响应时间: {testResult.responseTime}ms)
                </span>
              )}
            </div>
            {testResult.message && (
              <p className="mt-1 text-sm">{testResult.message}</p>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !apiKey}
            className={`
              px-6 py-2.5 rounded-lg font-medium transition-all
              ${testing || !apiKey
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-all"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !apiKey}
            className={`
              flex-1 px-6 py-2.5 rounded-lg font-medium transition-all
              ${saving || !apiKey
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * AI 配置页面
 */
export const AIConfigPage: React.FC<AIConfigPageProps> = ({ userId, onBack }) => {
  const {
    configs,
    defaultConfig,
    loading,
    error,
    testing,
    testResult,
    save,
    delete: deleteConfig,
    test,
    setDefault,
  } = useAIConfig(userId)

  const [showForm, setShowForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AIConfig | undefined>()

  const handleSave = async (config: Omit<AIConfig, 'createdAt' | 'updatedAt'>) => {
    await save(config)
    setShowForm(false)
    setEditingConfig(undefined)
  }

  const handleEdit = (config: AIConfig) => {
    setEditingConfig(config)
    setShowForm(true)
  }

  const handleDelete = async (configId: string) => {
    if (window.confirm('确定要删除此配置吗？')) {
      await deleteConfig(configId)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingConfig(undefined)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-white transition-all"
              >
                <span className="text-xl">←</span>
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI 配置</h1>
              <p className="text-gray-500 mt-1">配置 AI 模型，用于智能识别发票和审批单</p>
            </div>
          </div>
          
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <span>+</span>
              <span>添加配置</span>
            </button>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* 表单或列表 */}
        {showForm ? (
          <ConfigForm
            config={editingConfig}
            onSave={handleSave}
            onCancel={handleCancel}
            onTest={test}
            testing={testing}
            testResult={testResult}
          />
        ) : (
          <>
            {/* 加载状态 */}
            {loading && configs.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                加载中...
              </div>
            )}

            {/* 空状态 */}
            {!loading && configs.length === 0 && (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                <div className="text-5xl mb-4">🤖</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  尚未配置 AI 模型
                </h3>
                <p className="text-gray-500 mb-6">
                  配置 AI 模型后，可以智能识别发票和审批单信息
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
                >
                  添加第一个配置
                </button>
              </div>
            )}

            {/* 配置列表 */}
            {configs.length > 0 && (
              <div className="space-y-4">
                {configs.map(config => (
                  <ConfigCard
                    key={config.id}
                    config={config}
                    isDefault={defaultConfig?.id === config.id}
                    onEdit={() => handleEdit(config)}
                    onDelete={() => handleDelete(config.id)}
                    onSetDefault={() => setDefault(config.id)}
                  />
                ))}
              </div>
            )}

            {/* 提示信息 */}
            {configs.length > 0 && (
              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">💡 使用提示</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 默认配置将用于所有 AI 识别任务</li>
                  <li>• 支持配置多个不同的 AI 服务商，可随时切换</li>
                  <li>• API Key 会安全存储，仅用于调用对应的 AI 服务</li>
                  <li>• 建议先测试连接，确保配置正确后再保存</li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AIConfigPage





















