/**
 * 易报销系统 - A4附件显示组件
 * 用于PDF预览时显示单个附件的A4页面
 * 支持自动检测图片方向，智能选择横版或竖版显示
 */

import React, { useState, useEffect } from 'react';

interface A4SingleAttachmentProps {
  attachment: any;
  title: string;
  index: number;
}

/**
 * A4附件单页组件
 *
 * 显示单个附件在A4纸张上,用于PDF导出
 * 支持自动检测图片宽高比，选择最佳显示方向：
 * - 横向图片（宽>高）：使用A4横版 (297mm x 210mm)
 * - 纵向图片（高>宽）：使用A4竖版 (210mm x 297mm)
 */
export const A4SingleAttachment = ({ attachment, title, index }: A4SingleAttachmentProps) => {
    const [isLandscape, setIsLandscape] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    // 检测图片方向
    useEffect(() => {
        if (attachment?.data) {
            const img = new Image();
            img.onload = () => {
                // 如果图片宽度大于高度，使用横版
                setIsLandscape(img.width > img.height * 1.2); // 1.2倍阈值，避免接近正方形的图片频繁切换
                setImageLoaded(true);
            };
            img.onerror = () => {
                setImageLoaded(true); // 加载失败时也标记为已加载，使用默认竖版
            };
            img.src = attachment.data;
        }
    }, [attachment?.data]);

    // 根据图片方向选择容器尺寸
    const containerWidth = isLandscape ? '297mm' : '210mm';
    const containerHeight = isLandscape ? '210mm' : '297mm';
    
    // 计算图片最大尺寸（留出页边距和页眉页脚空间）
    const imgMaxWidth = isLandscape ? '273mm' : '186mm';  // 两侧各留 12mm
    const imgMaxHeight = isLandscape ? '176mm' : '263mm'; // 上下各留约 17mm（包含页眉页脚）

    return (
        <div 
            className="bg-white p-4 flex flex-col print:break-before-page attachment-page" 
            style={{ 
                width: containerWidth,
                height: containerHeight,
                fontFamily: 'SimSun, serif',
                boxSizing: 'border-box',
            }}
        >
            {/* 页眉 */}
            <div className="text-center mb-2 pb-2 border-b border-slate-200 flex-shrink-0">
                <p className="text-sm text-slate-600">
                    {title} - 第 {index + 1} 页
                    {isLandscape && <span className="ml-2 text-xs text-slate-400">(横版)</span>}
                </p>
            </div>

            {/* 附件图片 - 完整显示，从顶部开始对齐 */}
            <div 
                className="flex-1 flex items-start justify-center" 
                style={{ overflow: 'visible' }}
            >
                {imageLoaded ? (
                    <img
                        src={attachment.data}
                        alt={attachment.name || `附件`}
                        style={{
                            maxWidth: imgMaxWidth,
                            maxHeight: imgMaxHeight,
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            objectPosition: 'top center', // 从顶部开始显示
                            display: 'block',
                        }}
                    />
                ) : (
                    <div className="text-slate-400 text-sm">加载中...</div>
                )}
            </div>

            {/* 页脚 */}
            {attachment.name && (
                <div className="text-center mt-2 pt-2 border-t border-slate-200 flex-shrink-0">
                    <p className="text-xs text-slate-500 truncate">{attachment.name}</p>
                </div>
            )}
        </div>
    );
};
