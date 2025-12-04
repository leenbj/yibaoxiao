/**
 * 易报销系统 - AI工具函数
 * 包含Google Gemini AI实例初始化
 */

import { GoogleGenAI } from "@google/genai";

/**
 * Google Gemini AI实例
 *
 * 用于:
 * - 语音识别 (RecordView)
 * - 发票识别 (CreateReportView)
 * - 其他AI辅助功能
 */
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
