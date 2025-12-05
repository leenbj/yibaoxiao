/**
 * 通用报销单表单组件
 * 用于渲染A4横版格式的报销单 - 北龙中网公司标准格式
 */

import React from 'react';
import { digitToChinese } from '../../utils/format';

interface GeneralReimbursementFormProps {
  data: {
    title?: string;
    totalAmount?: number;
    prepaidAmount?: number;
    payableAmount?: number;
    items?: Array<{
      id?: string;
      description?: string;
      name?: string;
      amount?: number;
      date?: string;
      category?: string;
    }>;
    approvalNumber?: string;
    userSnapshot?: {
      name?: string;
      department?: string;
    };
    paymentAccount?: {
      accountName?: string;
      bankName?: string;
      accountNumber?: string;
    };
    budgetProject?: {
      name?: string;
      code?: string;
    };
    invoiceCount?: number;
    attachments?: any[];
    createdDate?: string;
  };
}

export const GeneralReimbursementForm: React.FC<GeneralReimbursementFormProps> = ({ data }) => {
  const totalAmount = data.totalAmount || 0;
  const prepaidAmount = data.prepaidAmount || 0;
  const payableAmount = totalAmount - prepaidAmount;
  
  const getExpenseReason = () => {
    if (data.title) return data.title;
    if (data.items && data.items.length > 0) {
      return data.items.map((item: any) => item.description || item.name || '').filter(Boolean).join('、');
    }
    return '';
  };

  const currentDate = data.createdDate ? new Date(data.createdDate) : new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const day = currentDate.getDate();
  
  // 缩放比例
  const scale = 1;
  
  // 外层容器样式 - 横版 A4 页面
  const containerStyle: React.CSSProperties = {
    width: '297mm',  // A4 横版宽度
    height: '210mm', // A4 横版高度
    backgroundColor: 'white',
    padding: '8mm 12mm',
    boxSizing: 'border-box',
    fontFamily: '"SimSun", "Songti SC", serif',
    fontSize: '12px',
    lineHeight: '1.4',
  };
  
  // 内容容器
  const paperStyle: React.CSSProperties = {
    width: '100%',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    border: '1px solid black',
    tableLayout: 'fixed',
  };

  const cellStyle: React.CSSProperties = {
    border: '1px solid black',
    padding: '4px 3px',
    verticalAlign: 'middle',
    fontSize: '12px',
    lineHeight: '1.4',
    overflow: 'hidden',
    textAlign: 'center',
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: '"SimSun", serif',
    fontSize: '20px',
    textAlign: 'center',
    marginBottom: '3px',
    fontWeight: 'bold',
  };

  const subtitleStyle: React.CSSProperties = {
    fontFamily: '"SimSun", serif',
    fontSize: '18px',
    textAlign: 'center',
    marginBottom: '12px',
    letterSpacing: '4px',
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '3px',
    fontSize: '13px',
  };

  return (
    <div style={containerStyle} className="general-reimbursement-container">
      <div style={paperStyle}>
        {/* 标题区域 */}
        <div style={titleStyle}>北龙中网（北京）科技有限责任公司</div>
        <div style={subtitleStyle}>报销单</div>

        {/* 顶部元数据 */}
        <div style={headerRowStyle}>
          <div>
            报销日期：
            <span style={{ borderBottom: '1px solid black', padding: '0 8px' }}>{year}</span> 年 
            <span style={{ borderBottom: '1px solid black', padding: '0 8px' }}>{month}</span> 月 
            <span style={{ borderBottom: '1px solid black', padding: '0 8px' }}>{day}</span> 日
          </div>
          <div>
            附原始单据 <span style={{ display: 'inline-block', width: '32px', borderBottom: '1px solid black', textAlign: 'center' }}>{data.invoiceCount || data.attachments?.length || ''}</span> 张
          </div>
        </div>

        {/* 主表格 */}
        <table style={tableStyle}>
          <colgroup><col style={{ width: '5%' }} /><col style={{ width: '45%' }} /><col style={{ width: '15%' }} /><col style={{ width: '20%' }} /><col style={{ width: '15%' }} /></colgroup>
          <tbody>
            {/* 第1行：部门 + 报销人 */}
            <tr>
              <td colSpan={3} style={{ ...cellStyle, textAlign: 'left', borderRight: 'none' }}>
                <span style={{ fontWeight: 'bold' }}>部门：</span>
                <span style={{ marginLeft: `${80 * scale}px` }}>{data.userSnapshot?.department || ''}</span>
              </td>
              <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', borderLeft: 'none' }}>
                <span style={{ fontWeight: 'bold' }}>报销人：</span> {data.userSnapshot?.name || ''}
              </td>
            </tr>

            {/* 第2行：表头 */}
            <tr style={{ textAlign: 'center' }}>
              <td style={{ ...cellStyle, textAlign: 'center' }}>序号</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>报销事由</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>报销金额</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>预算项目</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>预算编码</td>
            </tr>

            {/* 数据行 - 支持多行，每行都显示预算项目和编码 */}
            {data.items && data.items.length > 0 ? (
              data.items.map((item: any, index: number) => (
                <tr key={index} style={{ height: `${32 * scale}px` }}>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{index + 1}</td>
                  <td style={cellStyle}>{item.description || item.name || ''}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{(item.amount || 0).toFixed(2)} 元</td>
                  <td style={cellStyle}>{data.budgetProject?.name || ''}</td>
                  <td style={cellStyle}>{data.budgetProject?.code || ''}</td>
                </tr>
              ))
            ) : (
              <tr style={{ height: `${32 * scale}px` }}>
                <td style={{ ...cellStyle, textAlign: 'center' }}>1</td>
                <td style={cellStyle}>{getExpenseReason()}</td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>{totalAmount.toFixed(2)} 元</td>
                <td style={cellStyle}>{data.budgetProject?.name || ''}</td>
                <td style={cellStyle}>{data.budgetProject?.code || ''}</td>
              </tr>
            )}

            {/* 第4行：提请报销金额 + 预支借款金额 */}
            <tr>
              <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>提请报销金额：</span>
                <span style={{ marginLeft: `${4 * scale}px`, fontSize: `${13 * scale}px` }}>※{digitToChinese(totalAmount)}</span>
                <span style={{ float: 'right', marginRight: `${4 * scale}px`, whiteSpace: 'nowrap' }}>￥ <span style={{ textDecoration: 'underline' }}>{totalAmount.toFixed(2)}</span> 元</span>
              </td>
              <td colSpan={3} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>预支借款金额：</span>
                <span>{prepaidAmount.toFixed(2)}</span>
                <span style={{ float: 'right', marginRight: `${8 * scale}px` }}>￥ <span style={{ textDecoration: 'underline' }}>{digitToChinese(prepaidAmount)}</span></span>
              </td>
            </tr>

            {/* 第5行：应领款金额 + 结算方式 */}
            <tr>
              <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>应领款金额：</span>
                <span style={{ marginLeft: `${4 * scale}px`, fontSize: `${13 * scale}px` }}>※{digitToChinese(Math.abs(payableAmount))}</span>
                <span style={{ float: 'right', marginRight: `${4 * scale}px`, whiteSpace: 'nowrap' }}>￥ <span style={{ textDecoration: 'underline' }}>{payableAmount.toFixed(2)}</span> 元</span>
              </td>
              <td colSpan={3} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>结算方式：</span>
                <span style={{ marginLeft: `${16 * scale}px` }}>□现金</span>
                <span style={{ marginLeft: `${16 * scale}px` }}>□支票</span>
                <span style={{ marginLeft: `${16 * scale}px` }}>☑电汇</span>
              </td>
            </tr>

            {/* 第6-8行：收款人信息 + 钉钉审批编号 */}
            <tr>
              <td rowSpan={3} style={{ ...cellStyle, textAlign: 'center', width: `${64 * scale}px` }}>
                收款人
              </td>
              <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                单位名称（姓名）： {data.paymentAccount?.accountName || ''}
              </td>
              <td rowSpan={3} style={{ ...cellStyle, textAlign: 'center', verticalAlign: 'middle' }}>
                钉钉审批编号
              </td>
              <td rowSpan={3} style={{ ...cellStyle, verticalAlign: 'middle', textAlign: 'center', fontSize: `${12 * scale}px` }}>
                {data.approvalNumber || ''}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                开户行： {data.paymentAccount?.bankName || ''}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                单位账号（银行卡号）： {data.paymentAccount?.accountNumber || ''}
              </td>
            </tr>

            {/* 第9行：签字栏 - 嵌套表格 */}
            <tr>
              <td colSpan={5} style={{ ...cellStyle, padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', height: `${48 * scale}px` }}>
                  <colgroup><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /></colgroup>
                  <tbody>
                    <tr style={{ height: '100%' }}>
                      <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>董事长<br/>签字</td>
                      <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                      <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>总 经理<br/>签字</td>
                      <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                      <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>常务副总/副总<br/>经理签字</td>
                      <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                      <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>总监/高级经<br/>理签字</td>
                      <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                      <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>项目负责<br/>人签字</td>
                      <td style={{ border: 'none', borderRight: '1px solid black' }}></td>
                      <td style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center', padding: `${3 * scale}px`, fontSize: `${12 * scale}px` }}>领款人<br/>签字</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* 第10行：所属产品线 */}
            <tr>
              <td colSpan={5} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
                所属产品线：
              </td>
            </tr>
          </tbody>
        </table>

        {/* 底部页脚 */}
        <div style={{ ...headerRowStyle, marginTop: `${3 * scale}px`, padding: `0 ${6 * scale}px` }}>
          <div style={{ width: '33%' }}>财务负责人：</div>
          <div style={{ width: '33%', textAlign: 'center' }}>审核：</div>
          <div style={{ width: '33%', textAlign: 'right', paddingRight: `${32 * scale}px` }}>出纳：</div>
        </div>
      </div>
    </div>
  );
};
