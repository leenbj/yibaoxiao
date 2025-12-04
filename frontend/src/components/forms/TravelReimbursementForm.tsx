/**
 * 差旅费报销单表单组件
 * 用于渲染A4竖版格式的差旅费报销单 - 北龙中网公司标准格式
 */

import React from 'react';
import { digitToChinese } from '../../utils/format';

interface TripLeg {
  dateRange?: string;
  route?: string;
  transportFee?: number;
  hotelLocation?: string;
  hotelDays?: number;
  hotelFee?: number;
  cityTrafficFee?: number;
  mealFee?: number;
  otherFee?: number;
  subTotal?: number;
}

interface TravelReimbursementFormProps {
  data: {
    tripReason?: string;
    tripLegs?: TripLeg[];
    totalAmount?: number;
    approvalNumber?: string;
    userSnapshot?: {
      name?: string;
      department?: string;
    };
    invoiceCount?: number;
    attachments?: any[];
    createdDate?: string;
    prepaidAmount?: number;
  };
}

export const TravelReimbursementForm: React.FC<TravelReimbursementFormProps> = ({ data }) => {
  const currentDate = data.createdDate ? new Date(data.createdDate) : new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const day = currentDate.getDate();
  
  const tripLegs = data.tripLegs || [];
  
  // 计算各项合计
  const totalTransport = tripLegs.reduce((sum, leg) => sum + (leg.transportFee || 0), 0);
  const totalHotel = tripLegs.reduce((sum, leg) => sum + (leg.hotelFee || 0), 0);
  const totalCityTraffic = tripLegs.reduce((sum, leg) => sum + (leg.cityTrafficFee || 0), 0);
  const totalMeal = tripLegs.reduce((sum, leg) => sum + (leg.mealFee || 0), 0);
  const totalOther = tripLegs.reduce((sum, leg) => sum + (leg.otherFee || 0), 0);
  const grandTotal = data.totalAmount || (totalTransport + totalHotel + totalCityTraffic + totalMeal + totalOther);
  
  // 外层容器 - A4 竖版页面
  const containerStyle: React.CSSProperties = {
    width: '210mm',
    height: '297mm',
    backgroundColor: 'white',
    padding: '15mm 12mm',
    boxSizing: 'border-box',
    fontFamily: '"SimSun", "Songti SC", serif',
    display: 'flex',
    flexDirection: 'column',
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
    wordBreak: 'break-all',
  };
  
  const inputLineStyle: React.CSSProperties = {
    display: 'inline-block',
    borderBottom: '1px solid black',
    minWidth: '30px',
    textAlign: 'center',
    padding: '0 4px',
  };
  
  return (
    <div style={containerStyle} className="travel-reimbursement-form">
      <h1 style={{ 
        textAlign: 'center', 
        fontSize: '24px', 
        fontWeight: 'bold', 
        marginBottom: '30px',
        fontFamily: '"SimHei", "STHeiti", sans-serif'
      }}>
        北龙中网（北京）科技有限责任公司差旅费报销单
      </h1>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '16px' }}>
        <span style={{ marginLeft: '20px' }}>
          报销日期：<span style={inputLineStyle}>{year}</span> 年 <span style={inputLineStyle}>{month}</span> 月 <span style={inputLineStyle}>{day}</span> 日
        </span>
        <span style={{ marginRight: '20px' }}>附件 {data.invoiceCount || data.attachments?.length || '_____'} 张</span>
      </div>

      <table style={tableStyle}>
        <colgroup>
          <col style={{ width: '16%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '5%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <tbody>
          {/* 第一行：部门信息 */}
          <tr>
            <td style={{ ...cellStyle, padding: '4px 2px', height: '30px' }}>部门</td>
            <td style={{ ...cellStyle, padding: '4px 2px' }}>{data.userSnapshot?.department || ''}</td>
            <td style={{ ...cellStyle, padding: '4px 2px' }}>姓名</td>
            <td colSpan={2} style={{ ...cellStyle, padding: '4px 2px' }}>{data.userSnapshot?.name || ''}</td>
            <td style={{ ...cellStyle, padding: '4px 2px' }}>出差事由</td>
            <td colSpan={4} style={{ ...cellStyle, padding: '4px 2px', textAlign: 'left', fontSize: '13px', lineHeight: '1.2', whiteSpace: 'normal' }}>
              {data.tripReason || ''}
            </td>
          </tr>
          
          {/* 表头行 - 第一部分 */}
          <tr>
            <th rowSpan={2} style={cellStyle}>日期</th>
            <th rowSpan={2} style={cellStyle}>起讫地点</th>
            <th rowSpan={2} style={cellStyle}>车船机票</th>
            <th colSpan={3} style={cellStyle}>住 宿</th>
            <th rowSpan={2} style={cellStyle}>市内交通</th>
            <th rowSpan={2} style={cellStyle}>餐费</th>
            <th rowSpan={2} style={cellStyle}>其他</th>
            <th rowSpan={2} style={cellStyle}>小计</th>
          </tr>
          <tr>
            <th style={cellStyle}>地区</th>
            <th style={cellStyle}>天数</th>
            <th style={cellStyle}>金额</th>
          </tr>
          
          {/* 数据行 */}
          {tripLegs.map((leg, idx) => (
            <tr key={idx}>
              <td style={cellStyle}>{leg.dateRange || ''}</td>
              <td style={cellStyle}>{leg.route || ''}</td>
              <td style={cellStyle}>{leg.transportFee ? leg.transportFee.toFixed(2) : ''}</td>
              <td style={cellStyle}>{leg.hotelLocation || ''}</td>
              <td style={cellStyle}>{leg.hotelDays || ''}</td>
              <td style={cellStyle}>{leg.hotelFee ? leg.hotelFee.toFixed(2) : ''}</td>
              <td style={cellStyle}>{leg.cityTrafficFee ? leg.cityTrafficFee.toFixed(2) : ''}</td>
              <td style={cellStyle}>{leg.mealFee ? leg.mealFee.toFixed(2) : ''}</td>
              <td style={cellStyle}>{leg.otherFee ? leg.otherFee.toFixed(2) : ''}</td>
              <td style={cellStyle}>¥{(leg.subTotal || 0).toFixed(2)}</td>
            </tr>
          ))}
          
          {/* 空行填充 - 确保至少6行 */}
          {Array.from({ length: Math.max(0, 6 - tripLegs.length) }).map((_, idx) => (
            <tr key={`empty-${idx}`} style={{ height: '30px' }}>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
            </tr>
          ))}
          
          {/* 合计行 */}
          <tr>
            <td colSpan={2} style={cellStyle}>合计</td>
            <td style={cellStyle}>¥{totalTransport.toFixed(2)}</td>
            <td colSpan={2} style={cellStyle}></td>
            <td style={cellStyle}>¥{totalHotel.toFixed(2)}</td>
            <td style={cellStyle}>¥{totalCityTraffic.toFixed(2)}</td>
            <td style={cellStyle}>¥{totalMeal.toFixed(2)}</td>
            <td style={cellStyle}>¥{totalOther.toFixed(2)}</td>
            <td style={cellStyle}>¥{grandTotal.toFixed(2)}</td>
          </tr>
          
          {/* 总计金额大写行 */}
          <tr>
            <td colSpan={2} style={cellStyle}>总计金额（大写）</td>
            <td colSpan={8} style={{ ...cellStyle, textAlign: 'left', paddingLeft: '20px' }}>
              {digitToChinese(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', padding: '0 20px', fontSize: '16px' }}>
        <span>财务审核：</span>
        <span>报销人签字：</span>
      </div>
    </div>
  );
};
