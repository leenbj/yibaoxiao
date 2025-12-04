/**
 * 易报销系统 - 借款单表单页组件
 * A4横版借款单格式,用于PDF导出
 */

import React from 'react';
import { digitToChinese } from '../../utils/format';

interface LoanFormSheetProps {
  data: any;
  sheetNumber: number;
  sheetName: string;
  showNote: boolean;
}

/**
 * 借款单表单页组件
 *
 * 尺寸: 297mm x 210mm (A4横版)
 * 格式: 北龙中网公司标准借款单格式
 * 双联: 财务留存联 + 员工留存联
 */
export const LoanFormSheet = ({ data, sheetNumber, sheetName, showNote }: LoanFormSheetProps) => {
    const currentDate = data.date ? new Date(data.date) : new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();

    const amount = data.amount || 0;
    const amountChinese = digitToChinese(amount);

    // A4 横版样式 (297mm x 210mm)
    const sheetStyle: React.CSSProperties = {
        width: '297mm',
        height: '210mm',
        backgroundColor: 'white',
        padding: '15mm 20mm',
        boxSizing: 'border-box',
        fontFamily: '"SimSun", "Songti SC", serif',
        pageBreakAfter: sheetNumber === 1 ? 'always' : 'auto',
    };

    const underlineStyle: React.CSSProperties = {
        borderBottom: '1px solid black',
        padding: '0 10px',
        display: 'inline-block',
        textAlign: 'center',
        minWidth: '40px',
    };

    return (
        <div style={sheetStyle} className="loan-sheet">
            {/* 标题区 */}
            <div style={{ marginBottom: '8px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '8px' }}>
                        北龙中网（北京）科技有限责任公司
                    </h1>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '1em' }}>借款单</h2>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <span style={{ marginRight: '8px' }}>借款日期：</span>
                        <span style={{ ...underlineStyle, width: '64px' }}>{year}</span>
                        <span style={{ marginRight: '4px' }}>年</span>
                        <span style={{ ...underlineStyle, width: '40px' }}>{month}</span>
                        <span style={{ marginRight: '4px' }}>月</span>
                        <span style={{ ...underlineStyle, width: '40px' }}>{day}</span>
                        <span>日</span>
                    </div>
                    <div>{sheetName}</div>
                </div>
            </div>

            {/* 表格主体 */}
            <div style={{ border: '1px solid black', fontSize: '14px' }}>
                {/* 第1行：部门和借款人 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '60%', borderRight: '1px solid black', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '8px' }}>部门：</span> {data.userSnapshot?.department || ''}
                    </div>
                    <div style={{ width: '40%', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '8px' }}>借款人：</span> {data.userSnapshot?.name || ''}
                    </div>
                </div>

                {/* 第2行：借款事由 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center', height: '32px' }}>
                        <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginRight: '8px' }}>借款事由：</span>
                        <span style={{ flexGrow: 1, borderBottom: '1px solid black', lineHeight: '1.4' }}>{data.reason || ''}</span>
                    </div>
                </div>

                {/* 第3行：支付方式 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '24px' }}>借款支付方式：</span>
                        <div style={{ display: 'flex', gap: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid black', marginRight: '4px', textAlign: 'center', lineHeight: '12px', fontSize: '12px' }}></span>现金
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid black', marginRight: '4px', textAlign: 'center', lineHeight: '12px', fontSize: '12px' }}></span>支票
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid black', marginRight: '4px', textAlign: 'center', lineHeight: '12px', fontSize: '12px' }}>✓</span>电汇
                            </div>
                        </div>
                    </div>
                </div>

                {/* 第4行：借款金额 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                    <div style={{ width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px' }}>借款金额：</span>
                            <span style={{ marginRight: '8px', fontSize: '18px' }}>※</span>
                            <span style={{ flexGrow: 1, borderBottom: '1px solid black', textAlign: 'center', letterSpacing: '0.2em', fontWeight: 500, lineHeight: '1.4' }}>
                                {amountChinese}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '16px', width: '25%' }}>
                            <span style={{ marginRight: '8px', fontWeight: 'bold' }}>￥</span>
                            <span style={{ flexGrow: 1, borderBottom: '1px solid black', textAlign: 'right', paddingRight: '8px', lineHeight: '1.4' }}>
                                {amount.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 第5行：收款人信息 + 审批编号 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black', height: '112px' }}>
                    {/* 收款人标签 */}
                    <div style={{ width: '64px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                        收<br/>款<br/>人
                    </div>

                    {/* 收款人详细信息 */}
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid black' }}>
                        <div style={{ height: '33.33%', borderBottom: '1px solid black', display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px', whiteSpace: 'nowrap' }}>单位名称（姓名）：</span>
                            <span style={{ whiteSpace: 'nowrap' }}>{data.payeeInfo?.accountName || ''}</span>
                        </div>
                        <div style={{ height: '33.33%', borderBottom: '1px solid black', display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px', whiteSpace: 'nowrap' }}>开户行：</span>
                            <span style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>{data.payeeInfo?.bankName || ''}</span>
                        </div>
                        <div style={{ height: '33.33%', display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '8px', whiteSpace: 'nowrap' }}>单位账号（银行卡号）：</span>
                            <span style={{ whiteSpace: 'nowrap' }}>{data.payeeInfo?.accountNumber || ''}</span>
                        </div>
                    </div>

                    {/* 钉钉审批编号 */}
                    <div style={{ width: '30%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flexGrow: 1, display: 'flex' }}>
                            <div style={{ width: '48px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', lineHeight: '1.4' }}>
                                钉钉<br/>审批<br/>编号
                            </div>
                            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', fontSize: '12px', wordBreak: 'break-all', textAlign: 'center' }}>
                                {data.approvalNumber || ''}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 第6行：签字栏 */}
                <div style={{ display: 'flex', borderBottom: '1px solid black', height: '48px', fontSize: '14px' }}>
                    {/* 董事长 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>董事长<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 总经理 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>总经理<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 常务副总 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '56px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0', lineHeight: '1.2', fontSize: '10px' }}>常务副总/<br/>副总经理<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 总监 */}
                    <div style={{ flex: 0.8, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>总监<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 项目负责人 */}
                    <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex' }}>
                        <div style={{ width: '48px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0', lineHeight: '1.2', fontSize: '12px' }}>项目负<br/>责人签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    {/* 领款人 */}
                    <div style={{ flex: 0.8, display: 'flex' }}>
                        <div style={{ width: '40px', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px', lineHeight: '1.4', fontSize: '12px' }}>领款人<br/>签字</div>
                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                </div>

                {/* 第7行：产品线/预算 */}
                <div style={{ display: 'flex', height: '32px', alignItems: 'center', padding: '0 8px', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '8px' }}>所属产品线：</span>
                        <span style={{ width: '48px' }}></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '8px' }}>预算项目：</span>
                        <span>{data.budgetProject?.name || ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                        <span style={{ marginRight: '4px' }}>预算编码：</span>
                        <span>{data.budgetProject?.code || ''}</span>
                    </div>
                </div>
            </div>

            {/* 底部签字行 */}
            <div style={{ display: 'flex', marginTop: '4px', justifyContent: 'space-between', padding: '0 8px', fontSize: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ marginRight: '8px' }}>财务负责人：</span><span style={{ width: '96px' }}></span></div>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ marginRight: '8px' }}>审核：</span><span style={{ width: '96px' }}></span></div>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ marginRight: '8px' }}>出纳：</span><span style={{ width: '96px' }}></span></div>
            </div>

            {/* 备注行（仅第二联显示） */}
            {showNote && (
                <div style={{ marginTop: '8px', padding: '0 8px', fontSize: '14px' }}>
                    <span style={{ fontWeight: 'bold' }}>备注：</span>借款时员工保留此联，报销时需将此联退回财务
                </div>
            )}
        </div>
    );
};
