/**
 * 易报销系统 - A4附件显示组件
 * 用于PDF预览时显示单个附件的A4页面
 */

interface A4SingleAttachmentProps {
  attachment: any;
  title: string;
  index: number;
}

/**
 * A4附件单页组件
 *
 * 显示单个附件在A4纸张上,用于PDF导出
 * 尺寸: 210mm x 297mm (A4竖版)
 */
export const A4SingleAttachment = ({ attachment, title, index }: A4SingleAttachmentProps) => {
    return (
        <div className="w-[210mm] h-[297mm] bg-white p-4 flex flex-col print:break-before-page attachment-page" style={{ fontFamily: 'SimSun, serif' }}>
            {/* 页眉 */}
            <div className="text-center mb-2 pb-2 border-b border-slate-200">
                <p className="text-sm text-slate-600">{title} - 第 {index + 1} 页</p>
            </div>

            {/* 附件图片 */}
            <div className="flex-1 flex items-center justify-center overflow-hidden">
                <img
                    src={attachment.data}
                    alt={attachment.name || `附件`}
                    className="max-w-full max-h-full object-contain"
                />
            </div>

            {/* 页脚 */}
            {attachment.name && (
                <div className="text-center mt-2 pt-2 border-t border-slate-200">
                    <p className="text-xs text-slate-500">{attachment.name}</p>
                </div>
            )}
        </div>
    );
};
