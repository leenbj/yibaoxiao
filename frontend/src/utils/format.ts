/**
 * 易报销系统 - 格式化工具函数
 * 包含日期格式化、数字格式化等工具方法
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param isoDate ISO格式的日期字符串
 * @returns 格式化后的日期字符串
 */
export const formatDate = (isoDate: string): string => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 格式化日期时间
 * @param isoDate ISO格式的日期字符串
 * @returns 格式化后的日期字符串（目前与formatDate相同）
 */
export const formatDateTime = (isoDate: string): string => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 数字转中文大写金额
 * 例如：123.45 → 壹佰贰拾叁元肆角伍分
 *
 * @param n 数字金额
 * @returns 中文大写金额字符串
 */
export const digitToChinese = (n: number): string => {
  const fraction = ['角', '分'];
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']];
  const head = n < 0 ? '欠' : '';
  n = Math.abs(n);
  let s = '';

  // 处理小数部分
  for (let i = 0; i < fraction.length; i++) {
    s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
  }
  s = s || '整';

  // 处理整数部分
  n = Math.floor(n);
  for (let i = 0; i < unit[0].length && n > 0; i++) {
    let p = '';
    for (let j = 0; j < unit[1].length && n > 0; j++) {
      p = digit[n % 10] + unit[1][j] + p;
      n = Math.floor(n / 10);
    }
    s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
  }

  return head + s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整');
};

/**
 * 格式化金额为千分位格式
 * 例如：1234567.89 → 1,234,567.89
 *
 * @param amount 金额数字
 * @param decimals 小数位数（默认2位）
 * @returns 格式化后的金额字符串
 */
export const formatCurrency = (amount: number, decimals: number = 2): string => {
  return amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * 格式化文件大小
 * 例如：1536 → 1.5 KB
 *
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
