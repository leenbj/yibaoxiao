/**
 * 易报销系统 - 差旅费 AI 识别 Hook
 * 用于处理火车票/机票、住宿、打车等多源数据的 AI 识别、往返配对和行程构建
 */

import { useState } from 'react';
import { apiRequest } from '../utils/api';
import { Attachment, TripLeg } from '../types';
import { getRecommendedLoans, MatchedLoan } from '../utils/loanMatcher';

interface TaxiDetailItem {
  id: string;
  date: string;
  reason: string;
  route: string;
  startPoint: string;
  endPoint: string;
  amount: number;
  employeeName: string;
}

interface UseTravelAnalysisParams {
  ticketFiles: Attachment[];
  hotelFiles: Attachment[];
  taxiInvoiceFiles: Attachment[];
  taxiTripFiles: Attachment[];
  approvalFiles: Attachment[];
  loans: any[];
  settings: any;
  form: any;
}

interface UseTravelAnalysisReturn {
  analyzing: boolean;
  aiTicketResult: any;
  aiHotelResult: any;
  aiTaxiResult: any;
  aiApprovalResult: any;
  tripLegs: TripLeg[];
  taxiDetails: TaxiDetailItem[];
  matchedLoans: any[];
  startAnalysis: () => Promise<{
    success: boolean;
    tripLegs: TripLeg[];
    taxiDetails: TaxiDetailItem[];
    matchedLoans: any[];
    tripReason: string;
    autoSelectedBudgetId: string;
    approvalNumber?: string;
  }>;
}

/**
 * 差旅费 AI 识别和数据处理 Hook
 *
 * 功能：
 * - 4并行 AI 识别（火车票、住宿、打车、审批单）
 * - 智能往返票配对算法
 * - 按目的地匹配住宿信息
 * - 打车费用汇总和分配
 * - 自动匹配借款和预算项目
 */
export const useTravelAnalysis = ({
  ticketFiles,
  hotelFiles,
  taxiInvoiceFiles,
  taxiTripFiles,
  approvalFiles,
  loans,
  settings,
  form,
}: UseTravelAnalysisParams): UseTravelAnalysisReturn => {
  const [analyzing, setAnalyzing] = useState(false);
  const [aiTicketResult, setAiTicketResult] = useState<any>(null);
  const [aiHotelResult, setAiHotelResult] = useState<any>(null);
  const [aiTaxiResult, setAiTaxiResult] = useState<any>(null);
  const [aiApprovalResult, setAiApprovalResult] = useState<any>(null);
  const [tripLegs, setTripLegs] = useState<TripLeg[]>([]);
  const [taxiDetails, setTaxiDetails] = useState<TaxiDetailItem[]>([]);
  const [matchedLoans, setMatchedLoans] = useState<any[]>([]);

  // 辅助函数：保留完整的 data URL（包括 mimeType）
  // 后端需要完整的 data URL 来正确识别图片格式
  const cleanB64 = (data: string) => data;  // 不再去掉前缀，保留完整的 data URL

  /**
   * 配对往返票据算法
   * 输入：所有票据
   * 输出：配对的往返票对
   */
  const pairTickets = (tickets: any[]) => {
    const pairedTrips: { outbound: any; return: any | null }[] = [];
    const usedTickets = new Set<number>();

    tickets.forEach((ticket: any, idx: number) => {
      if (usedTickets.has(idx)) return;

      const departure = ticket.departure || ticket.fromStation || '';
      const destination = ticket.destination || ticket.toStation || '';

      // 查找对应的返程票（出发地和目的地互换）
      const returnIdx = tickets.findIndex((t: any, i: number) => {
        if (i === idx || usedTickets.has(i)) return false;
        const tDeparture = t.departure || t.fromStation || '';
        const tDestination = t.destination || t.toStation || '';
        // 返程票：出发地=去程目的地，目的地=去程出发地
        return tDeparture === destination && tDestination === departure;
      });

      usedTickets.add(idx);
      if (returnIdx !== -1) {
        usedTickets.add(returnIdx);
        pairedTrips.push({
          outbound: ticket,
          return: tickets[returnIdx],
        });
      } else {
        // 没有找到返程票，单独作为一条记录
        pairedTrips.push({
          outbound: ticket,
          return: null,
        });
      }
    });

    return pairedTrips;
  };

  /**
   * 从配对的往返票据构建出差行程
   */
  const buildTripLegs = (pairedTrips: any[], hotels: any[]): TripLeg[] => {
    return pairedTrips.map((pair) => {
      const outbound = pair.outbound;
      const returnTicket = pair.return;

      const departure = outbound.departure || outbound.fromStation || '';
      const destination = outbound.destination || outbound.toStation || '';
      const outboundDate = outbound.departureDate || outbound.date || '';
      const returnDate = returnTicket?.departureDate || returnTicket?.date || outboundDate;

      // 计算往返车票费用总和
      const outboundFee = parseFloat(outbound.amount || outbound.price || 0);
      const returnFee = parseFloat(returnTicket?.amount || returnTicket?.price || 0) || 0;
      const totalTransportFee = outboundFee + returnFee;

      // 查找对应的住宿信息（按目的地匹配）
      const matchedHotel = hotels.find((h: any) =>
        h.city === destination ||
        h.location?.includes(destination) ||
        destination.includes(h.city || '')
      );

      return {
        dateRange: `${outboundDate}-${returnDate}`,
        route: `${departure}-${destination}`,
        hotelLocation: destination,
        transportFee: totalTransportFee,
        hotelDays: matchedHotel?.days || matchedHotel?.nights || 0,
        hotelFee: matchedHotel?.amount || matchedHotel?.totalAmount || 0,
        cityTrafficFee: 0,
        mealFee: 0,
        otherFee: 0,
        subTotal: 0,
      };
    });
  };

  /**
   * 处理打车明细数据
   * 支持多种字段名称，确保正确提取所有信息
   */
  const processTaxiDetails = (rawTaxiDetails: any[], approvalData: any): TaxiDetailItem[] => {
    console.log('[AI] 处理打车明细数据, 数量:', rawTaxiDetails.length);

    // 获取当前用户姓名
    const employeeName = settings.currentUser?.name || '王波';

    return rawTaxiDetails.map((t: any, idx: number) => {
      // 支持多种可能的金额字段名
      const amount = parseFloat(
        t.amount || t.price || t.totalAmount || t.fare || 
        t.total || t.money || t.cost || 0
      );

      // 支持多种日期字段名
      const date = t.date || t.invoiceDate || t.tripDate || t.orderDate || 
        t.createTime || t.time || new Date().toISOString().split('T')[0];

      // 获取起终点信息 - 支持更多字段名
      const startPoint = t.startPoint || t.start || t.from || t.origin || 
        t.departure || t.pickupLocation || t.startAddress || '';
      const endPoint = t.endPoint || t.end || t.to || t.destination || 
        t.dropoffLocation || t.endAddress || '';
      
      // 构建路线
      let route = t.route || t.path || t.trip || '';
      if (!route && (startPoint || endPoint)) {
        route = `${startPoint}-${endPoint}`;
      }

      // 获取乘客/员工姓名
      const passenger = t.passengerName || t.employeeName || t.passenger || 
        t.name || t.rider || employeeName;

      // 获取事由
      const reason = t.reason || t.purpose || t.remark || t.note || 
        approvalData.eventSummary || '出差';

      const processedItem: TaxiDetailItem = {
        id: `taxi-${Date.now()}-${idx}`,
        date: date,
        reason: reason,
        route: route,
        startPoint: startPoint,
        endPoint: endPoint,
        amount: amount,
        employeeName: passenger,
      };

      console.log(`[AI] 打车明细 ${idx + 1}:`, { 
        原始: JSON.stringify(t).substring(0, 200), 
        处理后: processedItem 
      });
      return processedItem;
    });
  };

  /**
   * 规范化打车数据格式
   * 支持多种 AI 返回格式，确保正确提取所有打车明细
   */
  const normalizeTaxiData = (rawTaxiData: any): any => {
    console.log('[AI] 原始打车数据:', JSON.stringify(rawTaxiData, null, 2));
    
    let details: any[] = [];

    // 情况1: 直接是数组
    if (Array.isArray(rawTaxiData)) {
      details = rawTaxiData;
    }
    // 情况2: 有 details 数组
    else if (rawTaxiData.details && Array.isArray(rawTaxiData.details)) {
      details = rawTaxiData.details;
    }
    // 情况3: 有 trips/rides/records 等数组
    else if (rawTaxiData.trips && Array.isArray(rawTaxiData.trips)) {
      details = rawTaxiData.trips;
    }
    else if (rawTaxiData.rides && Array.isArray(rawTaxiData.rides)) {
      details = rawTaxiData.rides;
    }
    else if (rawTaxiData.records && Array.isArray(rawTaxiData.records)) {
      details = rawTaxiData.records;
    }
    else if (rawTaxiData.items && Array.isArray(rawTaxiData.items)) {
      details = rawTaxiData.items;
    }
    // 情况4: 单个对象且有金额字段
    else if (typeof rawTaxiData === 'object' && (
      rawTaxiData.amount !== undefined || 
      rawTaxiData.totalAmount !== undefined ||
      rawTaxiData.fare !== undefined ||
      rawTaxiData.price !== undefined
    )) {
      details = [rawTaxiData];
    }
    // 情况5: 对象包含多个票据数据（遍历所有属性）
    else if (typeof rawTaxiData === 'object') {
      // 遍历对象属性，查找可能的票据数组
      for (const key of Object.keys(rawTaxiData)) {
        const value = rawTaxiData[key];
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          // 检查数组元素是否像票据数据（有金额或日期字段）
          const firstItem = value[0];
          if (firstItem.amount !== undefined || firstItem.date !== undefined || 
              firstItem.totalAmount !== undefined || firstItem.fare !== undefined) {
            details = [...details, ...value];
          }
        }
      }
    }

    console.log('[AI] 规范化后打车明细数量:', details.length);
    console.log('[AI] 规范化后打车明细:', details);
    
    return { details };
  };

  /**
   * 开始 AI 分析流程
   */
  const startAnalysis = async () => {
    // 检查是否上传了任何文件
    const totalFiles = ticketFiles.length + hotelFiles.length + taxiInvoiceFiles.length + taxiTripFiles.length + approvalFiles.length;
    if (totalFiles === 0) {
      alert('请至少上传一种票据！');
      return {
        success: false,
        tripLegs: [],
        taxiDetails: [],
        matchedLoans: [],
        tripReason: '',
        autoSelectedBudgetId: form.budgetProjectId,
      };
    }

    setAnalyzing(true);
    try {
      const ticketImages = ticketFiles.map(f => cleanB64(f.data));
      const hotelImages = hotelFiles.map(f => cleanB64(f.data));
      const taxiImages = [...taxiInvoiceFiles, ...taxiTripFiles].map(f => cleanB64(f.data));
      const approvalImages = approvalFiles.map(f => cleanB64(f.data));

      console.log('[AI] 开始并行识别所有票据');
      const startTime = Date.now();

      // 创建 4 并行请求（仅对有图片的类型发送请求）
      const ticketPromise = ticketImages.length > 0
        ? apiRequest('/api/ai/recognize', {
            method: 'POST',
            body: JSON.stringify({
              type: 'ticket',
              images: ticketImages,
              mimeType: 'image/jpeg',
            }),
          })
        : Promise.resolve({ result: {} });

      const hotelPromise = hotelImages.length > 0
        ? apiRequest('/api/ai/recognize', {
          method: 'POST',
          body: JSON.stringify({
            type: 'hotel',
            images: hotelImages,
            mimeType: 'image/jpeg',
          }),
        })
        : Promise.resolve({ result: {} });

      const taxiPromise = taxiImages.length > 0
        ? apiRequest('/api/ai/recognize', {
          method: 'POST',
          body: JSON.stringify({
            type: 'taxi',
            images: taxiImages,
            mimeType: 'image/jpeg',
          }),
        })
        : Promise.resolve({ result: { details: [] } });

      const approvalPromise = approvalImages.length > 0
        ? apiRequest('/api/ai/recognize', {
          method: 'POST',
          body: JSON.stringify({
            type: 'approval',
            images: approvalImages,
            mimeType: 'image/jpeg',
          }),
        })
        : Promise.resolve({ result: {} });

      // 等待所有请求完成
      const [ticketResponse, hotelResponse, taxiResponse, approvalResponse] = await Promise.all([
        ticketPromise,
        hotelPromise,
        taxiPromise,
        approvalPromise,
      ]) as any[];

      console.log(`[AI] 并行识别完成，耗时: ${Date.now() - startTime}ms`);

      // 处理各类识别结果
      const ticketData = ticketResponse.result || {};
      const hotelData = hotelResponse.result || {};
      const rawTaxiData = taxiResponse.result || { details: [] };
      const approvalData = approvalResponse.result || {};

      setAiTicketResult(ticketData);
      setAiHotelResult(hotelData);
      setAiApprovalResult(approvalData);

      // 详细记录打车数据，便于调试
      console.log('[AI] 打车识别原始返回:', JSON.stringify(taxiResponse, null, 2));
      console.log('[AI] rawTaxiData:', JSON.stringify(rawTaxiData, null, 2));

      console.log('[AI] 识别结果汇总', {
        ticket: ticketData,
        hotel: hotelData,
        taxi: rawTaxiData,
        approval: approvalData,
      });

      // 规范化打车数据格式
      const taxiData = normalizeTaxiData(rawTaxiData);
      setAiTaxiResult(taxiData);

      // 提取数据
      const tickets = Array.isArray(ticketData) ? ticketData : (ticketData.tickets || [ticketData]);
      const hotels = Array.isArray(hotelData) ? hotelData : (hotelData.hotels || [hotelData]);
      const taxiDetailsList = taxiData.details || [];

      // 配对往返票据
      const pairedTrips = pairTickets(tickets);

      // 构建出差行程
      const tripLegsData = buildTripLegs(pairedTrips, hotels);

      // 计算打车费用总和
      const totalTaxiFee = taxiDetailsList.reduce((sum: number, t: any) =>
        sum + (parseFloat(t.amount) || parseFloat(t.price) || parseFloat(t.totalAmount) || parseFloat(t.fare) || 0),
        0
      );

      // 将打车费分配到第一个行程段
      if (tripLegsData.length > 0 && totalTaxiFee > 0) {
        tripLegsData[0].cityTrafficFee = totalTaxiFee;
      }

      // 计算每个行程的小计
      tripLegsData.forEach(leg => {
        leg.subTotal = (leg.transportFee || 0) + (leg.hotelFee || 0) +
          (leg.cityTrafficFee || 0) + (leg.mealFee || 0) + (leg.otherFee || 0);
      });

      setTripLegs(tripLegsData);

      // 处理打车明细
      const processedTaxiDetails = processTaxiDetails(taxiDetailsList, approvalData);
      setTaxiDetails(processedTaxiDetails);

      // 智能匹配借款记录（多维度匹配：审批单号、金额、关键词）
      const totalAmount = tripLegsData.reduce((sum, leg) => sum + (leg.subTotal || 0), 0);
      const tripContent = tripLegsData.map(leg => leg.route || '').join(' ');
      const potentialLoans = getRecommendedLoans(
        loans,
        approvalData,
        totalAmount,
        `${tripContent} ${approvalData.eventSummary || ''}`
      );
      setMatchedLoans(potentialLoans);
      
      console.log('[AI] 智能借款匹配结果', {
        totalLoans: loans.length,
        matchedCount: potentialLoans.length,
        topMatch: potentialLoans[0] ? {
          amount: potentialLoans[0].amount,
          score: (potentialLoans[0] as MatchedLoan).matchScore,
          reasons: (potentialLoans[0] as MatchedLoan).matchReason
        } : null
      });

      // 自动选择预算项目
      let autoSelectedBudgetId = form.budgetProjectId;
      if (approvalData.budgetProject) {
        const matchedBudget = settings.budgetProjects.find((p: any) =>
          p.name.includes(approvalData.budgetProject) || p.code === approvalData.budgetCode
        );
        if (matchedBudget) {
          autoSelectedBudgetId = matchedBudget.id;
        }
      }

      const tripReason = approvalData.eventSummary || ticketData.tripReason || '';

      // 判断报销类型：
      // - 如果只有打车票据（没有火车票/机票/住宿），则为"打车报销"
      // - 如果有出差票据（火车票/机票/住宿），则为"差旅报销"
      const hasTickets = ticketFiles.length > 0;
      const hasHotel = hotelFiles.length > 0;
      const hasTaxi = taxiInvoiceFiles.length > 0 || taxiTripFiles.length > 0;
      
      // 打车报销模式：只有打车票据，没有火车票/机票/住宿
      const isTaxiOnlyMode = hasTaxi && !hasTickets && !hasHotel;
      
      // 计算打车总金额
      const taxiTotalAmount = processedTaxiDetails.reduce((sum, t) => sum + (t.amount || 0), 0);

      console.log('[AI] 差旅数据处理完成', {
        tripLegsCount: tripLegsData.length,
        taxiDetailsCount: processedTaxiDetails.length,
        taxiTotalAmount,
        matchedLoansCount: potentialLoans.length,
        tripReason,
        isTaxiOnlyMode,
        hasTickets,
        hasHotel,
        hasTaxi,
      });

      return {
        success: true,
        tripLegs: tripLegsData,
        taxiDetails: processedTaxiDetails,
        matchedLoans: potentialLoans,
        tripReason: isTaxiOnlyMode ? '打车费' : tripReason,
        autoSelectedBudgetId,
        approvalNumber: approvalData?.approvalNumber || '',
        // 新增字段
        isTaxiOnlyMode,
        taxiTotalAmount,
      };

    } catch (e: any) {
      console.error('[AI] 识别失败:', e);
      const errorMsg = e?.message || e?.toString() || '未知错误';
      alert(`AI 识别失败: ${errorMsg}\n\n请检查：\n1. 网络连接是否正常\n2. AI 配置是否正确\n3. 上传的图片是否清晰`);
      return {
        success: false,
        tripLegs: [],
        taxiDetails: [],
        matchedLoans: [],
        tripReason: '',
        autoSelectedBudgetId: form.budgetProjectId,
      };
    } finally {
      setAnalyzing(false);
    }
  };

  return {
    analyzing,
    aiTicketResult,
    aiHotelResult,
    aiTaxiResult,
    aiApprovalResult,
    tripLegs,
    taxiDetails,
    matchedLoans,
    startAnalysis,
  };
};
