/** 计算涨跌幅百分比 */
export function changePercent(current: number, base: number): number {
  if (base === 0) return 0;
  return ((current - base) / base) * 100;
}

/** 格式化百分比 */
export function fmtPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** 格式化金额 */
export function fmtAmount(value: number): string {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 获取当前周标识 YYYY-WXX */
export function getWeekId(date = new Date()): string {
  const year = date.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - oneJan.getTime()) / 86400000);
  const weekNum = Math.ceil((days + oneJan.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}
