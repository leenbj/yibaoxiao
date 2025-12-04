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
  amount: number;
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

  // 辅助函数：清理 Base64 编码
  const cleanB64 = (data: string) => data.split(',')[1];

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
   */
  const processTaxiDetails = (rawTaxiDetails: any[], approvalData: any): TaxiDetailItem[] => {
    console.log('[AI] 打车明细数据:', rawTaxiDetails);

    return rawTaxiDetails.map((t: any, idx: number) => {
      // 支持多种可能的金额字段名
      const amount = parseFloat(t.amount || t.price || t.totalAmount || t.fare || 0);

      // 获取起终点信息
      const route = t.route || `${t.startPoint || ''}-${t.endPoint || ''}`;

      const processedItem = {
        id: `taxi-${Date.now()}-${idx}`,
        date: t.date || t.invoiceDate || '',
        reason: approvalData.eventSummary || '',
        route: route,
        amount: amount,
      };

      console.log(`[AI] 打车明细 ${idx + 1}:`, { raw: t, processed: processedItem });
      return processedItem;
    });
  };

  /**
   * 规范化打车数据格式
   */
  const normalizeTaxiData = (rawTaxiData: any): any => {
    // 支持多种返回格式
    if (Array.isArray(rawTaxiData)) {
      return { details: rawTaxiData };
    } else if (rawTaxiData.details && Array.isArray(rawTaxiData.details)) {
      return rawTaxiData;
    } else if (typeof rawTaxiData === 'object' && rawTaxiData.amount !== undefined) {
      return { details: [rawTaxiData] };
    } else {
      return { details: [] };
    }
  };

  /**
   * 开始 AI 分析流程
   */
  const startAnalysis = async () => {
    if (ticketFiles.length === 0) {
      alert('请上传火车票或机票！这是必须的票据。');
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

      // 创建 4 并行请求
      const ticketPromise = apiRequest('/api/ai/recognize', {
        method: 'POST',
        body: JSON.stringify({
          type: 'ticket',
          images: ticketImages,
          mimeType: 'image/jpeg',
        }),
      });

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

      console.log('[AI] 识别结果汇总', {
        ticket: ticketData,
        hotel: hotelData,
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

      console.log('[AI] 差旅数据处理完成', {
        tripLegsCount: tripLegsData.length,
        taxiDetailsCount: processedTaxiDetails.length,
        matchedLoansCount: potentialLoans.length,
        tripReason,
      });

      return {
        success: true,
        tripLegs: tripLegsData,
        taxiDetails: processedTaxiDetails,
        matchedLoans: potentialLoans,
        tripReason,
        autoSelectedBudgetId,
        approvalNumber: approvalData?.approvalNumber || '',
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
