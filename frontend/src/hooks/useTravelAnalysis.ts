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
  projectName?: string; // 发票上的货物或应税劳务名称
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
    isTaxiOnlyMode?: boolean;
    taxiTotalAmount?: number;
    taxiInvoiceProjectName?: string; // 打车发票的货物或应税劳务名称
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
    console.log('[AI] pairTickets 输入票据数量:', tickets.length);
    
    if (tickets.length === 0) {
      console.log('[AI] pairTickets: 没有票据输入');
      return [];
    }

    const pairedTrips: { outbound: any; return: any | null }[] = [];
    const usedTickets = new Set<number>();

    tickets.forEach((ticket: any, idx: number) => {
      if (usedTickets.has(idx)) return;

      // 使用已规范化的字段
      const departure = ticket.departure || '';
      const destination = ticket.destination || '';

      console.log(`[AI] 处理票据 ${idx}:`, {
        departure,
        destination,
        departureDate: ticket.departureDate,
        amount: ticket.amount,
      });

      // 查找对应的返程票（出发地和目的地互换）
      const returnIdx = tickets.findIndex((t: any, i: number) => {
        if (i === idx || usedTickets.has(i)) return false;
        const tDeparture = t.departure || '';
        const tDestination = t.destination || '';
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
        console.log(`[AI] 票据 ${idx} 配对到返程票 ${returnIdx}`);
      } else {
        // 没有找到返程票，单独作为一条记录
        pairedTrips.push({
          outbound: ticket,
          return: null,
        });
        console.log(`[AI] 票据 ${idx} 无返程票，单独记录`);
      }
    });

    console.log('[AI] pairTickets 输出配对数量:', pairedTrips.length);
    return pairedTrips;
  };

  /**
   * 格式化日期为 YYYY.MM.DD 格式（报销单显示格式）
   */
  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    // 处理 YYYY-MM-DD 格式
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr.replace(/-/g, '.');
    }
    // 处理 YYYYMMDD 格式
    if (/^\d{8}$/.test(dateStr)) {
      return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
    }
    // 其他格式尝试直接返回
    return dateStr;
  };

  /**
   * 从配对的往返票据构建出差行程
   */
  const buildTripLegs = (pairedTrips: any[], hotels: any[]): TripLeg[] => {
    console.log('[AI] buildTripLegs 输入:', {
      pairedTripsCount: pairedTrips.length,
      hotelsCount: hotels.length,
      pairedTrips: JSON.stringify(pairedTrips, null, 2),
    });

    if (pairedTrips.length === 0) {
      console.log('[AI] buildTripLegs: 没有配对的票据');
      return [];
    }

    return pairedTrips.map((pair, idx) => {
      const outbound = pair.outbound;
      const returnTicket = pair.return;

      console.log(`[AI] 处理第 ${idx + 1} 个行程配对:`, {
        outbound: JSON.stringify(outbound, null, 2),
        returnTicket: returnTicket ? JSON.stringify(returnTicket, null, 2) : null,
      });

      // 出发地和目的地（已在 normalizeTicket 中规范化）
      const departure = outbound.departure || '';
      const destination = outbound.destination || '';
      
      // 日期处理
      const outboundDate = outbound.departureDate || '';
      const returnDate = returnTicket?.departureDate || returnTicket?.arrivalDate || outboundDate;
      
      // 格式化日期为显示格式
      const outboundDateDisplay = formatDateForDisplay(outboundDate);
      const returnDateDisplay = formatDateForDisplay(returnDate);

      // 计算往返车票费用总和（已在 normalizeTicket 中转为数字）
      const outboundFee = outbound.amount || 0;
      const returnFee = returnTicket?.amount || 0;
      const totalTransportFee = outboundFee + returnFee;

      console.log(`[AI] 行程 ${idx + 1} 解析结果:`, {
        departure,
        destination,
        outboundDate,
        outboundDateDisplay,
        returnDate,
        returnDateDisplay,
        outboundFee,
        returnFee,
        totalTransportFee,
      });

      // 查找对应的住宿信息（按目的地匹配）
      const matchedHotel = hotels.find((h: any) =>
        h.city === destination ||
        h.location?.includes(destination) ||
        destination.includes(h.city || '')
      );

      const tripLeg = {
        dateRange: outboundDateDisplay && returnDateDisplay 
          ? `${outboundDateDisplay}-${returnDateDisplay}` 
          : outboundDateDisplay || returnDateDisplay || '',
        route: departure && destination ? `${departure}-${destination}` : departure || destination || '',
        hotelLocation: destination,
        transportFee: totalTransportFee,
        hotelDays: matchedHotel?.days || matchedHotel?.nights || 0,
        hotelFee: matchedHotel?.amount || matchedHotel?.totalAmount || 0,
        cityTrafficFee: 0,
        mealFee: 0,
        otherFee: 0,
        subTotal: 0,
      };

      console.log(`[AI] 生成的行程段 ${idx + 1}:`, JSON.stringify(tripLeg, null, 2));
      return tripLeg;
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
      
      // 获取发票上的货物或应税劳务名称（尝试多种字段名）
      const projectName = t.projectName || t.serviceName || t.itemName || 
        t.title || t.goodsName || t.name || '';

      const processedItem: TaxiDetailItem = {
        id: `taxi-${Date.now()}-${idx}`,
        date: date,
        reason: reason,
        route: route,
        startPoint: startPoint,
        endPoint: endPoint,
        amount: amount,
        employeeName: passenger,
        projectName: projectName, // 发票项目名称
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
      // 分开处理打车发票和打车行程单
      const taxiInvoiceImages = taxiInvoiceFiles.map(f => cleanB64(f.data));
      const taxiTripImages = taxiTripFiles.map(f => cleanB64(f.data));
      const approvalImages = approvalFiles.map(f => cleanB64(f.data));

      console.log('[AI] 开始并行识别所有票据');
      const startTime = Date.now();

      // 创建 5 并行请求（仅对有图片的类型发送请求）
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

      // 打车发票识别 - 包含 projectName（货物或应税劳务名称）
      const taxiInvoicePromise = taxiInvoiceImages.length > 0
        ? apiRequest('/api/ai/recognize', {
          method: 'POST',
          body: JSON.stringify({
            type: 'taxi',
            images: taxiInvoiceImages,
            mimeType: 'image/jpeg',
          }),
        })
        : Promise.resolve({ result: { details: [] } });

      // 打车行程单识别 - 只有路线信息
      const taxiTripPromise = taxiTripImages.length > 0
        ? apiRequest('/api/ai/recognize', {
          method: 'POST',
          body: JSON.stringify({
            type: 'taxi',
            images: taxiTripImages,
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
      const [ticketResponse, hotelResponse, taxiInvoiceResponse, taxiTripResponse, approvalResponse] = await Promise.all([
        ticketPromise,
        hotelPromise,
        taxiInvoicePromise,
        taxiTripPromise,
        approvalPromise,
      ]) as any[];

      console.log(`[AI] 并行识别完成，耗时: ${Date.now() - startTime}ms`);

      // 处理各类识别结果
      const ticketData = ticketResponse.result || {};
      const hotelData = hotelResponse.result || {};
      const rawTaxiInvoiceData = taxiInvoiceResponse.result || { details: [] };
      const rawTaxiTripData = taxiTripResponse.result || { details: [] };
      const approvalData = approvalResponse.result || {};

      setAiTicketResult(ticketData);
      setAiHotelResult(hotelData);
      setAiApprovalResult(approvalData);

      // 详细记录打车数据，便于调试
      console.log('[AI] 打车发票识别原始返回:', JSON.stringify(taxiInvoiceResponse, null, 2));
      console.log('[AI] 打车行程单识别原始返回:', JSON.stringify(taxiTripResponse, null, 2));

      // 分别规范化打车发票和行程单数据
      const taxiInvoiceData = normalizeTaxiData(rawTaxiInvoiceData);
      const taxiTripData = normalizeTaxiData(rawTaxiTripData);
      
      // 判断是否有火车票/机票（后面用于决定使用哪些数据）
      const hasTicketsOrHotel = ticketFiles.length > 0 || hotelFiles.length > 0;
      const hasTaxiInvoice = taxiInvoiceFiles.length > 0;
      
      // 日常打车报销模式：只使用打车发票数据（不合并行程单）
      // 差旅报销模式：合并发票和行程单数据（行程单补充路线信息）
      let taxiData;
      if (!hasTicketsOrHotel && hasTaxiInvoice) {
        // 日常打车报销：只使用发票数据，报销事由和金额以发票为准
        taxiData = { details: taxiInvoiceData.details || [] };
        console.log('[AI] 日常打车报销模式：只使用发票数据');
      } else {
        // 差旅报销：合并发票和行程单数据（发票优先）
        const mergedTaxiDetails = [
          ...(taxiInvoiceData.details || []),
          ...(taxiTripData.details || []),
        ];
        taxiData = { details: mergedTaxiDetails };
        console.log('[AI] 差旅报销模式：合并发票和行程单数据');
      }
      setAiTaxiResult(taxiData);

      console.log('[AI] 识别结果汇总', {
        ticket: ticketData,
        hotel: hotelData,
        taxiInvoice: taxiInvoiceData,
        taxiTrip: taxiTripData,
        finalTaxi: taxiData,
        approval: approvalData,
        hasTicketsOrHotel,
        hasTaxiInvoice,
      });

      // ========== 详细记录火车票识别原始数据 ==========
      console.log('[AI] 火车票识别原始返回:', JSON.stringify(ticketResponse, null, 2));
      console.log('[AI] 火车票识别结果 ticketData:', JSON.stringify(ticketData, null, 2));
      console.log('[AI] ticketData 类型:', typeof ticketData, '是否为数组:', Array.isArray(ticketData));
      console.log('[AI] ticketData.tickets:', ticketData?.tickets);
      console.log('[AI] ticketData 关键字段检查:', {
        hasTicketsArray: Array.isArray(ticketData?.tickets),
        hasDeparture: !!ticketData?.departure,
        hasFromStation: !!ticketData?.fromStation,
        hasDestination: !!ticketData?.destination,
        hasToStation: !!ticketData?.toStation,
        keys: ticketData ? Object.keys(ticketData) : [],
      });

      // 提取并规范化车票数据，支持多种数据结构
      // 1. ticketData.tickets 数组
      // 2. ticketData 本身是数组
      // 3. ticketData.details 数组（某些 AI 可能返回这种格式）
      // 4. ticketData 是单个票据对象
      let rawTickets: any[] = [];
      if (Array.isArray(ticketData?.tickets)) {
        rawTickets = ticketData.tickets;
        console.log('[AI] 使用 ticketData.tickets 数组，数量:', rawTickets.length);
      } else if (Array.isArray(ticketData?.details)) {
        rawTickets = ticketData.details;
        console.log('[AI] 使用 ticketData.details 数组，数量:', rawTickets.length);
      } else if (Array.isArray(ticketData)) {
        rawTickets = ticketData;
        console.log('[AI] ticketData 本身是数组，数量:', rawTickets.length);
      } else if (ticketData && typeof ticketData === 'object' && Object.keys(ticketData).length > 0) {
        // 检查是否是单个票据对象（有关键字段）
        const hasTicketFields = ticketData.departure || ticketData.fromStation || ticketData.toStation || 
          ticketData.destination || ticketData.trainNumber || ticketData.ticketType ||
          ticketData.amount || ticketData.price || ticketData.departureDate || ticketData.date;
        if (hasTicketFields) {
          rawTickets = [ticketData];
          console.log('[AI] ticketData 是单个票据对象');
        } else {
          // 可能是包装对象，尝试查找第一个数组属性
          const arrayProp = Object.entries(ticketData).find(([_, v]) => Array.isArray(v));
          if (arrayProp) {
            rawTickets = arrayProp[1] as any[];
            console.log(`[AI] 从 ticketData.${arrayProp[0]} 提取票据数组，数量:`, rawTickets.length);
          }
        }
      }
      
      // 过滤掉空对象
      rawTickets = rawTickets.filter((t: any) => t && typeof t === 'object' && Object.keys(t).length > 0);
      console.log('[AI] 过滤后的原始票据数量:', rawTickets.length);
      console.log('[AI] 原始票据数据:', JSON.stringify(rawTickets, null, 2));

      // 规范化火车/机票字段，尽量填充出发地、目的地、日期、金额
      // 支持多种可能的字段名称
      const normalizeTicket = (t: any) => {
        // 出发地：支持多种字段名
        const departure = t.departure || t.fromStation || t.origin || t.from || t.startCity || 
          t.fromCity || t.departureStation || t.departureCity || t.start || '';
        // 目的地：支持多种字段名
        const destination = t.destination || t.toStation || t.arrival || t.to || t.endCity || 
          t.toCity || t.arrivalStation || t.arrivalCity || t.end || '';
        // 出发日期：支持多种字段名和格式
        let departureDate = t.departureDate || t.date || t.trainDate || t.flightDate || 
          t.travelDate || t.tripDate || t.startDate || '';
        // 到达日期
        let arrivalDate = t.arrivalDate || t.toDate || t.arriveDate || t.endDate || departureDate || '';
        // 日期格式处理：将 YYYYMMDD 转为 YYYY-MM-DD
        if (departureDate && /^\d{8}$/.test(departureDate)) {
          departureDate = `${departureDate.slice(0, 4)}-${departureDate.slice(4, 6)}-${departureDate.slice(6, 8)}`;
        }
        if (arrivalDate && /^\d{8}$/.test(arrivalDate)) {
          arrivalDate = `${arrivalDate.slice(0, 4)}-${arrivalDate.slice(4, 6)}-${arrivalDate.slice(6, 8)}`;
        }
        // 时间
        const departureTime = t.departureTime || t.time || t.startTime || '';
        const arrivalTime = t.arrivalTime || t.reachTime || t.endTime || '';
        // 金额：支持多种字段名，确保是数字
        const amountStr = t.amount || t.price || t.totalAmount || t.fare || t.ticketPrice || t.cost || '0';
        const amount = parseFloat(String(amountStr).replace(/[^0-9.]/g, '')) || 0;
        const price = amount;
        
        const normalized = {
          ...t,
          departure,
          destination,
          departureDate,
          arrivalDate,
          departureTime,
          arrivalTime,
          amount,
          price,
          ticketType: t.ticketType || t.type || (t.trainNumber ? '火车票' : t.flightNumber ? '飞机票' : ''),
          passengerName: t.passengerName || t.name || t.passenger || '',
          trainNumber: t.trainNumber || t.flightNumber || t.tripNumber || t.no || t.number || '',
        };
        console.log('[AI] 规范化票据:', JSON.stringify(normalized, null, 2));
        return normalized;
      };

      const tickets = rawTickets.map(normalizeTicket);
      console.log('[AI] 规范化后的票据数量:', tickets.length);
      console.log('[AI] 规范化后的票据数据:', JSON.stringify(tickets, null, 2));
      const hotels = Array.isArray(hotelData?.hotels)
        ? hotelData.hotels
        : Array.isArray(hotelData)
          ? hotelData
          : [];
      const taxiDetailsList = taxiData.details || [];

      // 配对往返票据
      const pairedTrips = pairTickets(tickets);

      // 构建出差行程
      const tripLegsData = buildTripLegs(pairedTrips, hotels);

      // 预计算不同来源的打车金额
      const invoiceTotalAmount = (taxiInvoiceData.details || []).reduce((sum: number, t: any) =>
        sum + (parseFloat(t.amount) || parseFloat(t.totalAmount) || parseFloat(t.price) || parseFloat(t.fare) || 0), 0);
      const tripSlipTotalAmount = (taxiTripData.details || []).reduce((sum: number, t: any) =>
        sum + (parseFloat(t.amount) || parseFloat(t.totalAmount) || parseFloat(t.price) || parseFloat(t.fare) || 0), 0);

      // 差旅场景：优先使用发票金额作为市内交通费；日常打车场景：也以发票金额为准
      const totalTaxiFee = invoiceTotalAmount || tripSlipTotalAmount || 0;

      // 将打车费分配到第一个行程段（仅差旅模式有行程段）
      if (tripLegsData.length > 0 && totalTaxiFee > 0) {
        tripLegsData[0].cityTrafficFee = totalTaxiFee;
      }

      // 计算每个行程的小计
      tripLegsData.forEach(leg => {
        leg.subTotal = (leg.transportFee || 0) + (leg.hotelFee || 0) +
          (leg.cityTrafficFee || 0) + (leg.mealFee || 0) + (leg.otherFee || 0);
      });

      setTripLegs(tripLegsData);

      // 判断报销类型：
      // - 如果只有打车发票（没有火车票/机票），则为"日常打车报销"
      // - 如果有火车票/机票，则为"差旅报销"
      const hasTickets = ticketFiles.length > 0;
      const hasHotel = hotelFiles.length > 0;
      const hasTaxiInvoiceOnly = taxiInvoiceFiles.length > 0;
      
      // 日常打车报销模式：只有打车发票，没有火车票/机票
      // 注意：即使有打车行程单，只要有打车发票且没有火车票/机票，就是日常打车报销
      const isTaxiOnlyMode = hasTaxiInvoiceOnly && !hasTickets && !hasHotel;
      
      // 计算打车总金额：以发票金额为准，若发票金额缺失则回退行程单金额
      const taxiTotalAmount = invoiceTotalAmount || tripSlipTotalAmount || 0;

      // 处理打车明细
      // 差旅模式：优先用行程单填充明细；日常打车模式：用发票（若无行程单）
      let rawDetailsForTable: any[] = [];
      if (isTaxiOnlyMode) {
        rawDetailsForTable = (taxiInvoiceData.details || []).length > 0
          ? taxiInvoiceData.details
          : taxiDetailsList;
      } else {
        rawDetailsForTable = (taxiTripData.details || []).length > 0
          ? taxiTripData.details
          : taxiDetailsList;
      }

      const processedTaxiDetails = processTaxiDetails(rawDetailsForTable, approvalData);
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

      // 提取打车发票的货物或应税劳务名称（用于日常打车报销的报销事由）
      // 优先从打车发票识别结果中获取 projectName（因为发票才有"货物或应税劳务名称"）
      console.log('[AI] 开始提取发票项目名称...');
      console.log('[AI] taxiInvoiceData.details:', JSON.stringify(taxiInvoiceData.details, null, 2));
      
      // 尝试多种可能的字段名
      const getProjectNameFromItem = (t: any): string | null => {
        // 优先级：projectName > serviceName > itemName > title > name
        return t.projectName || t.serviceName || t.itemName || t.title || t.goodsName || t.name || null;
      };
      
      const invoiceProjectNames = (taxiInvoiceData.details || [])
        .map((t: any) => getProjectNameFromItem(t))
        .filter(Boolean);
      
      console.log('[AI] 从发票提取的项目名称:', invoiceProjectNames);
      
      // 如果发票识别没有返回 projectName，从处理后的打车明细中获取
      const processedProjectNames = processedTaxiDetails
        .map(t => t.projectName)
        .filter(Boolean);
      
      console.log('[AI] 从处理后明细提取的项目名称:', processedProjectNames);
      
      const allProjectNames = invoiceProjectNames.length > 0 
        ? invoiceProjectNames
        : processedProjectNames;
      
      // 去重并合并项目名称
      const uniqueProjectNames = [...new Set(allProjectNames)];
      
      // 如果还是没有找到，使用默认值
      const taxiInvoiceProjectName = uniqueProjectNames.length > 0 
        ? uniqueProjectNames.join('、') 
        : '运输服务';
      
      console.log('[AI] 打车发票项目名称提取结果:', {
        invoiceProjectNames,
        processedProjectNames,
        allProjectNames,
        uniqueProjectNames,
        taxiInvoiceProjectName,
      });

      console.log('[AI] 差旅数据处理完成', {
        tripLegsCount: tripLegsData.length,
        taxiDetailsCount: processedTaxiDetails.length,
        taxiTotalAmount,
        matchedLoansCount: potentialLoans.length,
        tripReason,
        isTaxiOnlyMode,
        hasTickets,
        hasHotel,
        hasTaxiInvoice: hasTaxiInvoiceOnly,
        taxiInvoiceProjectName,
      });

      // 日常打车报销模式下，只返回发票的打车明细（不包含行程单）；差旅模式优先返回行程单明细
      let finalTaxiDetails = processedTaxiDetails;
      if (isTaxiOnlyMode) {
        const invoiceOnlyDetails = processTaxiDetails(taxiInvoiceData.details || [], approvalData);
        finalTaxiDetails = invoiceOnlyDetails;
      }

      return {
        success: true,
        tripLegs: tripLegsData,
        taxiDetails: finalTaxiDetails,  // 日常打车报销返回发票明细；差旅报销返回行程单/合并明细
        matchedLoans: potentialLoans,
        // 日常打车报销使用发票项目名称，差旅报销使用出差事由（需手动填写）
        tripReason: isTaxiOnlyMode ? taxiInvoiceProjectName : tripReason,
        autoSelectedBudgetId,
        approvalNumber: approvalData?.approvalNumber || '',
        // 新增字段
        isTaxiOnlyMode,
        taxiTotalAmount,
        taxiInvoiceProjectName, // 打车发票的货物或应税劳务名称
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
