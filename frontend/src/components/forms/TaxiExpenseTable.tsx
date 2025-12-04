/**
 * 出租车费明细表组件
 * 用于渲染A4竖版格式的出租车费明细表 - 北龙中网公司标准格式
 */

import React from 'react';
import { digitToChinese } from '../../utils/format';

interface TaxiDetail {
  date: string;
  reason?: string;
  route: string;
  amount: number;
}

interface TaxiExpenseTableProps {
  data: {
    taxiDetails: TaxiDetail[];
    tripReason?: string;
    userSnapshot?: {
      name?: string;
      department?: string;
    };
    createdDate?: string;
  };
}

export const TaxiExpenseTable: React.FC<TaxiExpenseTableProps> = ({ data }) => {
  const currentDate = data.createdDate ? new Date(data.createdDate) : new Date();
  const dateStr = `${currentDate.getFullYear()}.${currentDate.getMonth() + 1}.${currentDate.getDate()}`;
  
  const taxiDetails = data.taxiDetails || [];
  
  // 计算出租车费总金额
  const taxiTotal = taxiDetails.reduce((sum, item) => sum + (item.amount || 0), 0);
  
  const containerStyle: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    backgroundColor: 'white',
    padding: '20mm 15mm',
    boxSizing: 'border-box',
    fontFamily: '"SimSun", "Songti SC", serif',
  };
  
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    marginBottom: '10px',
    tableLayout: 'fixed',
  };
  
  const cellStyle: React.CSSProperties = {
    border: '1px solid black',
    padding: '6px 4px',
    textAlign: 'center',
    verticalAlign: 'middle',
  };
  
  return (
    <div style={containerStyle} className="taxi-expense-table">
      <h1 style={{ 
        textAlign: 'center', 
        fontSize: '24px', 
        fontWeight: 'bold', 
        marginBottom: '30px',
        fontFamily: '"SimHei", "STHeiti", sans-serif'
      }}>
        北龙中网（北京）科技有限责任公司员工出租车费明细表
      </h1>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '16px' }}>
        <span style={{ marginLeft: '20px' }}>填制日期：{dateStr}</span>
        <span style={{ marginRight: '20px' }}>附发票 {taxiDetails.length || 0} 张</span>
      </div>
      
      <table style={tableStyle}>
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '45%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...cellStyle, height: '35px' }}>发票日期</th>
            <th style={{ ...cellStyle, height: '35px' }}>外出事由</th>
            <th style={{ ...cellStyle, height: '35px' }}>起终点</th>
            <th style={{ ...cellStyle, height: '35px' }}>金额</th>
            <th style={{ ...cellStyle, height: '35px' }}>员工</th>
          </tr>
        </thead>
        <tbody>
          {taxiDetails.map((item, idx) => (
            <tr key={idx}>
              <td style={cellStyle}>{item.date || ''}</td>
              <td style={cellStyle}>{item.reason || data.tripReason || ''}</td>
              <td style={cellStyle}>{item.route || ''}</td>
              <td style={cellStyle}>{(item.amount || 0).toFixed(2)}</td>
              <td style={cellStyle}>{data.userSnapshot?.name || ''}</td>
            </tr>
          ))}
          {/* 总金额行 */}
          <tr style={{ fontWeight: 'bold' }}>
            <td style={{ ...cellStyle, textAlign: 'center' }}>总金额</td>
            <td colSpan={4} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '20px', letterSpacing: '1px' }}>
              {digitToChinese(taxiTotal)} ¥ {taxiTotal.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: '10px', fontSize: '16px', fontWeight: 'bold' }}>
        填表人（签字）：
      </div>
    </div>
  );
};
