/**
 * 借款单智能匹配工具
 * 支持多维度匹配：审批单号、金额、关键词、事由等
 */

export interface LoanRecord {
  id: string;
  amount: number;
  reason?: string;
  approvalNumber?: string;
  date?: string;
  status?: string;
  [key: string]: any;
}

export interface ApprovalData {
  approvalNumber?: string;
  eventSummary?: string;
  eventDetail?: string;
  loanAmount?: number;
  expenseAmount?: number;
  applicant?: string;
  budgetProject?: string;
  [key: string]: any;
}

export interface MatchedLoan extends LoanRecord {
  matchScore: number;
  matchReason: string[];
  matchType: 'exact' | 'fuzzy' | 'amount' | 'keyword';
}

/**
 * 标准化审批单号（去除空格、连字符、转小写）
 */
const normalizeApprovalNumber = (num: string | undefined): string => {
  if (!num) return '';
  return num.toString().toLowerCase().replace(/[\s\-_]/g, '');
};

/**
 * 提取关键词（中英文分词）
 */
const extractKeywords = (text: string | undefined): string[] => {
  if (!text) return [];
  
  // 移除标点符号，保留中文和英文
  const cleanText = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ');
  
  // 分割并过滤
  const words = cleanText.split(/\s+/).filter(w => w.length >= 2);
  
  // 中文按字分割（每2-3个字为一个词）
  const chineseWords: string[] = [];
  const chineseText: string[] = text.match(/[\u4e00-\u9fa5]+/g) || [];
  chineseText.forEach((ct: string) => {
    if (ct.length >= 2) {
      chineseWords.push(ct);
      // 对于长词，额外提取2-3字的子词
      for (let i = 0; i < ct.length - 1; i++) {
        chineseWords.push(ct.substring(i, i + 2));
        if (i + 3 <= ct.length) {
          chineseWords.push(ct.substring(i, i + 3));
        }
      }
    }
  });
  
  return [...new Set([...words, ...chineseWords])];
};

/**
 * 计算关键词匹配度
 */
const calculateKeywordScore = (keywords1: string[], keywords2: string[]): number => {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  const set1 = new Set(keywords1.map(k => k.toLowerCase()));
  const set2 = new Set(keywords2.map(k => k.toLowerCase()));
  
  let matchCount = 0;
  set1.forEach(k1 => {
    set2.forEach(k2 => {
      if (k1 === k2 || k1.includes(k2) || k2.includes(k1)) {
        matchCount++;
      }
    });
  });
  
  // 归一化到 0-100
  const maxPossibleMatches = Math.min(set1.size, set2.size);
  return maxPossibleMatches > 0 ? Math.min(100, (matchCount / maxPossibleMatches) * 100) : 0;
};

/**
 * 计算金额匹配度
 */
const calculateAmountScore = (amount1: number, amount2: number, tolerance: number = 0.1): number => {
  if (amount1 === 0 || amount2 === 0) return 0;
  
  const diff = Math.abs(amount1 - amount2);
  const maxAmount = Math.max(amount1, amount2);
  const diffRatio = diff / maxAmount;
  
  // 完全匹配
  if (diff === 0) return 100;
  
  // 在容差范围内
  if (diffRatio <= tolerance) {
    return Math.round(100 * (1 - diffRatio / tolerance));
  }
  
  // 超出容差但金额相近（20%以内）
  if (diffRatio <= 0.2) {
    return Math.round(50 * (1 - (diffRatio - tolerance) / 0.1));
  }
  
  return 0;
};

/**
 * 智能匹配借款记录
 * 
 * @param loans 所有借款记录
 * @param approvalData AI 识别的审批单数据
 * @param invoiceAmount 发票总金额
 * @param invoiceContent 发票内容/项目名称
 * @returns 匹配的借款记录列表（按匹配度排序）
 */
export const matchLoans = (
  loans: LoanRecord[],
  approvalData: ApprovalData,
  invoiceAmount: number = 0,
  invoiceContent: string = ''
): MatchedLoan[] => {
  if (!loans || loans.length === 0) return [];
  
  const results: MatchedLoan[] = [];
  
  // 提取审批单关键词
  const approvalKeywords = extractKeywords(
    `${approvalData.eventSummary || ''} ${approvalData.eventDetail || ''}`
  );
  
  // 提取发票内容关键词
  const invoiceKeywords = extractKeywords(invoiceContent);
  
  // 合并搜索关键词
  const searchKeywords = [...new Set([...approvalKeywords, ...invoiceKeywords])];
  
  const normalizedApprovalNum = normalizeApprovalNumber(approvalData.approvalNumber);
  
  loans.forEach(loan => {
    let score = 0;
    const matchReasons: string[] = [];
    let matchType: MatchedLoan['matchType'] = 'keyword';
    
    // 1. 审批单号匹配（最高优先级）
    if (normalizedApprovalNum && loan.approvalNumber) {
      const normalizedLoanNum = normalizeApprovalNumber(loan.approvalNumber);
      
      // 完全匹配
      if (normalizedLoanNum === normalizedApprovalNum) {
        score += 100;
        matchReasons.push('审批单号完全匹配');
        matchType = 'exact';
      }
      // 包含匹配
      else if (normalizedLoanNum.includes(normalizedApprovalNum) || 
               normalizedApprovalNum.includes(normalizedLoanNum)) {
        score += 60;
        matchReasons.push('审批单号部分匹配');
        matchType = 'fuzzy';
      }
      // 前缀匹配（常见于流水号）
      else if (normalizedLoanNum.slice(-10) === normalizedApprovalNum.slice(-10)) {
        score += 40;
        matchReasons.push('审批单号后缀匹配');
        matchType = 'fuzzy';
      }
    }
    
    // 2. 金额匹配
    const amountToMatch = invoiceAmount || approvalData.loanAmount || approvalData.expenseAmount || 0;
    if (amountToMatch > 0 && loan.amount > 0) {
      const amountScore = calculateAmountScore(loan.amount, amountToMatch);
      if (amountScore > 0) {
        score += amountScore * 0.5; // 金额权重 50%
        if (amountScore >= 90) {
          matchReasons.push(`金额匹配 (¥${loan.amount.toFixed(2)})`);
          if (matchType === 'keyword') matchType = 'amount';
        } else if (amountScore >= 50) {
          matchReasons.push(`金额相近 (¥${loan.amount.toFixed(2)})`);
        }
      }
    }
    
    // 3. 关键词/事由匹配
    if (searchKeywords.length > 0 && loan.reason) {
      const loanKeywords = extractKeywords(loan.reason);
      const keywordScore = calculateKeywordScore(searchKeywords, loanKeywords);
      if (keywordScore > 0) {
        score += keywordScore * 0.3; // 关键词权重 30%
        if (keywordScore >= 50) {
          matchReasons.push('借款事由相关');
        }
      }
    }
    
    // 只返回有一定匹配度的记录
    if (score > 20 || matchReasons.length > 0) {
      results.push({
        ...loan,
        matchScore: Math.round(score),
        matchReason: matchReasons.length > 0 ? matchReasons : ['金额或事由相关'],
        matchType
      });
    }
  });
  
  // 按匹配度排序
  results.sort((a, b) => b.matchScore - a.matchScore);
  
  console.log('[借款匹配] 匹配结果', {
    totalLoans: loans.length,
    matchedCount: results.length,
    topMatch: results[0] ? {
      id: results[0].id,
      score: results[0].matchScore,
      reasons: results[0].matchReason
    } : null
  });
  
  return results;
};

/**
 * 获取推荐的借款记录（过滤未完成借款）
 */
export const getRecommendedLoans = (
  loans: LoanRecord[],
  approvalData: ApprovalData,
  invoiceAmount: number = 0,
  invoiceContent: string = ''
): MatchedLoan[] => {
  // 只匹配未完成的借款（草稿或已提交）
  const pendingLoans = loans.filter(loan => 
    loan.status !== 'paid' && loan.status !== 'cancelled'
  );
  
  return matchLoans(pendingLoans, approvalData, invoiceAmount, invoiceContent);
};

/**
 * 格式化匹配理由显示
 */
export const formatMatchReasons = (reasons: string[]): string => {
  if (reasons.length === 0) return '可能相关';
  return reasons.join('、');
};

/**
 * 获取匹配类型的中文描述
 */
export const getMatchTypeLabel = (type: MatchedLoan['matchType']): string => {
  switch (type) {
    case 'exact':
      return '精确匹配';
    case 'fuzzy':
      return '模糊匹配';
    case 'amount':
      return '金额匹配';
    case 'keyword':
      return '关键词匹配';
    default:
      return '相关';
  }
};
