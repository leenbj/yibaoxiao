/**
 * 易报销系统 - 快速记账视图
 * 支持手动输入和语音识别的记账表单
 */

import { useState, useRef } from 'react';
import { ChevronRight, Mic, Loader2 } from 'lucide-react';
import type { RecordViewProps } from '../../types';
import { ai } from '../../utils/ai';

/**
 * 快速记账视图组件
 *
 * 功能:
 * - 手动输入费用信息
 * - 语音识别自动填充表单 (使用Gemini AI)
 * - 精确时间选择(到分钟)
 * - 分类选择
 * - 保存到账本
 */
export const RecordView = ({ onSave, onBack }: RecordViewProps) => {
    // Default manual mode, precise time
    const [date, setDate] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("餐饮");
    const [remarks, setRemarks] = useState("");

    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const categories = ["餐饮", "交通", "住宿", "办公", "招待", "通讯", "其他"];

    const handleSave = () => {
        if (!description || !amount) return alert("请输入金额和事项");
        onSave({ id: Date.now().toString(), description, amount: parseFloat(amount), date, category, remarks, status: "pending" });
    };

    const toggleVoice = async () => {
        if(isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                chunksRef.current = [];
                mediaRecorderRef.current.ondataavailable = e => chunksRef.current.push(e.data);
                mediaRecorderRef.current.onstop = async () => {
                     setIsProcessing(true);
                     const blob = new Blob(chunksRef.current, {type: 'audio/webm'});
                     const reader = new FileReader();
                     reader.readAsDataURL(blob);
                     reader.onloadend = async () => {
                        try {
                            const b64 = (reader.result as string).split(',')[1];
                            const res = await ai.models.generateContent({
                                model: "gemini-2.5-flash",
                                contents: [{role: 'user', parts: [{inlineData: {mimeType: 'audio/webm', data: b64}}, {text: "Extract JSON: {description, amount, date (YYYY-MM-DD), category, remarks}"}]}],
                                config: {responseMimeType: "application/json"}
                            });
                            const data = JSON.parse(res.text || "{}");
                            if(data.description) setDescription(data.description);
                            if(data.amount) setAmount(data.amount);
                            if(data.category) setCategory(data.category);
                            if(data.remarks) setRemarks(data.remarks);
                        } catch(e) { alert("识别失败"); }
                        setIsProcessing(false);
                     };
                };
                mediaRecorderRef.current.start();
                setIsRecording(true);
            } catch { alert("无法访问麦克风"); }
        }
    };

    return (
        <div className="max-w-xl mx-auto pt-6">
             <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight className="rotate-180"/></button>
                <h2 className="text-2xl font-bold text-slate-800">快速记账</h2>
                 <div className="ml-auto">
                    <button onClick={toggleVoice} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isRecording ? "bg-red-50 text-red-600 animate-pulse" : isProcessing ? "bg-slate-100 text-slate-500" : "bg-slate-100 text-slate-700"}`}>
                        {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Mic size={14}/>}
                        {isRecording ? "停止录音" : isProcessing ? "分析中..." : "语音输入"}
                    </button>
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">金额</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                                <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white border-2 rounded-xl pl-8 pr-4 py-4 text-2xl font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300"/>
                            </div>
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">分类</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-[68px] bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white border-2 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none transition-all appearance-none text-center">
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">时间 (精确到分)</label>
                        <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white border-2 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none transition-all"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">事项描述</label>
                        <input type="text" placeholder="例如：招待客户李总晚餐" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white border-2 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none transition-all placeholder:text-slate-300"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">备注 (选填)</label>
                        <textarea rows={3} placeholder="添加更多细节..." value={remarks} onChange={e => setRemarks(e.target.value)} className="w-full bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white border-2 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none transition-all resize-none placeholder:text-slate-300"/>
                    </div>
                    <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 mt-4">
                        保存到账本
                    </button>
                </div>
            </div>
        </div>
    );
};
