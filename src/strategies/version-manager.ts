import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Strategy, StrategyParams } from "./types";

/**
 * 策略版本管理器（Strategy Version Manager）
 *
 * 职责：
 * - 自动保存策略配置历史版本
 * - 支持版本回滚
 * - 追踪策略参数变更
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSIONS_DIR = join(__dirname, "../../data/strategy-versions");

/** 策略版本记录 */
export interface StrategyVersion {
  strategyName: string;
  version: string;
  params: StrategyParams;
  savedAt: string;
  savedBy?: string;
  changeNote?: string;
  previousVersion?: string;
}

/**
 * 保存策略版本
 */
export async function saveStrategyVersion(
  strategy: Strategy,
  changeNote?: string
): Promise<void> {
  await mkdir(VERSIONS_DIR, { recursive: true });

  const version: StrategyVersion = {
    strategyName: strategy.metadata.name,
    version: strategy.metadata.version,
    params: strategy.params,
    savedAt: new Date().toISOString(),
    changeNote,
  };

  const filename = `${strategy.metadata.name}-${strategy.metadata.version}-${Date.now()}.json`;
  const filepath = join(VERSIONS_DIR, filename);

  await writeFile(filepath, JSON.stringify(version, null, 2), "utf-8");
  console.log(`[version-manager] 策略版本已保存: ${filename}`);
}

/**
 * 加载策略版本历史
 */
export async function loadStrategyVersions(
  strategyName: string
): Promise<StrategyVersion[]> {
  // TODO: Phase 2 MVP - 简化实现
  // 完整版需要：
  // 1. 扫描版本目录
  // 2. 过滤指定策略的版本文件
  // 3. 按时间排序
  // 4. 返回版本列表

  return [];
}

/**
 * 回滚到指定版本
 */
export async function rollbackToVersion(
  strategyName: string,
  version: string
): Promise<StrategyVersion | null> {
  // TODO: Phase 2 MVP - 简化实现
  // 完整版需要：
  // 1. 加载指定版本的配置
  // 2. 验证配置有效性
  // 3. 返回版本配置

  return null;
}

/**
 * 比较两个版本的差异
 */
export function compareVersions(
  v1: StrategyVersion,
  v2: StrategyVersion
): {
  added: string[];
  removed: string[];
  changed: { key: string; oldValue: any; newValue: any }[];
} {
  const diff = {
    added: [] as string[],
    removed: [] as string[],
    changed: [] as { key: string; oldValue: any; newValue: any }[],
  };

  const keys1 = Object.keys(v1.params);
  const keys2 = Object.keys(v2.params);

  // 检查新增参数
  for (const key of keys2) {
    if (!keys1.includes(key)) {
      diff.added.push(key);
    }
  }

  // 检查删除参数
  for (const key of keys1) {
    if (!keys2.includes(key)) {
      diff.removed.push(key);
    }
  }

  // 检查修改参数
  for (const key of keys1) {
    if (keys2.includes(key) && v1.params[key] !== v2.params[key]) {
      diff.changed.push({
        key,
        oldValue: v1.params[key],
        newValue: v2.params[key],
      });
    }
  }

  return diff;
}
