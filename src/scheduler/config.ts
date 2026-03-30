/**
 * 定时任务配置
 *
 * Phase 1：支持 cron 定时触发，替代手动运行
 *
 * 使用方式：
 * 1. 通过 LangGraph Cloud / LangGraph Server 的 cron 功能
 * 2. 通过系统 crontab（Linux/Mac）或任务计划程序（Windows）
 * 3. 通过 GitHub Actions / CI/CD 定时触发
 */

/**
 * 预设的运行计划
 */
export const SCHEDULE_PRESETS = {
  /** 每两周周四晚上 9:00 */
  biweekly: "0 21 * * 4/2",

  /** 每月 13 号晚上 9:00 */
  monthly: "0 21 13 * *",

  /** 每周日晚上 10:00（原需求） */
  weekly: "0 22 * * 0",

  /** 测试用：每小时 */
  hourly: "0 * * * *",
} as const;

/**
 * 当前使用的运行计划
 * 可通过环境变量覆盖：FUND_AGENT_SCHEDULE
 */
export const CURRENT_SCHEDULE =
  process.env.FUND_AGENT_SCHEDULE || SCHEDULE_PRESETS.biweekly;

/**
 * 检查是否应该运行
 * 用于手动触发时判断是否到了运行时间
 */
export function shouldRunNow(schedule: string = CURRENT_SCHEDULE): boolean {
  // TODO: 实现 cron 表达式解析和时间匹配
  // 可使用 node-cron 或 cron-parser 库
  // Phase 1 MVP：始终返回 true，由外部调度控制
  return true;
}

/**
 * 获取下次运行时间
 */
export function getNextRunTime(schedule: string = CURRENT_SCHEDULE): Date {
  // TODO: 实现 cron 表达式解析
  // 可使用 cron-parser 库
  // Phase 1 MVP：返回明天同一时间
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return next;
}
