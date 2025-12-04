/**
 * 易报销系统 - 个人信息管理视图
 * 用户个人资料编辑和密码修改
 */

import { useState } from 'react';
import { Save } from 'lucide-react';
import type { ProfileViewProps } from '../../types';

/**
 * 个人信息管理视图组件
 *
 * 功能:
 * - 编辑个人信息(姓名、部门、邮箱)
 * - 修改密码
 * - 保存并更新设置
 */
export const ProfileView = ({ settings, onSave }: ProfileViewProps) => {
    const [profile, setProfile] = useState(settings.currentUser);
    const [pass, setPass] = useState("");

    const handleSave = () => {
        onSave({ ...settings, currentUser: profile });
        alert("个人信息已更新");
        setPass("");
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-8">个人信息管理</h2>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center gap-6 mb-8 pb-8 border-b border-slate-100">
                    {/* 头像 */}
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-3xl font-bold shadow-lg">
                        {profile.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">{profile.name}</h3>
                        <p className="text-slate-500">{profile.department} · {profile.email}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">姓名</label>
                        <input
                            value={profile.name}
                            onChange={e => setProfile({...profile, name: e.target.value})}
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">部门</label>
                        <input
                            value={profile.department}
                            onChange={e => setProfile({...profile, department: e.target.value})}
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">邮箱</label>
                        <input
                            value={profile.email}
                            onChange={e => setProfile({...profile, email: e.target.value})}
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">修改密码</label>
                        <input
                            type="password"
                            placeholder="输入新密码（留空则不修改）"
                            value={pass}
                            onChange={e => setPass(e.target.value)}
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all flex items-center gap-2"
                    >
                        <Save size={18} />
                        保存修改
                    </button>
                </div>
            </div>
        </div>
    );
};
