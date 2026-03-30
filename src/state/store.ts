import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuyPoint, HighPoint, TriggeredTiers } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const BUY_POINTS_FILE = join(DATA_DIR, "buy-points.json");
const HIGH_POINTS_FILE = join(DATA_DIR, "high-points.json");
const TRIGGERED_TIERS_FILE = join(DATA_DIR, "triggered-tiers.json");

async function ensureDataDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error("[store] ❌ 创建数据目录失败:", error instanceof Error ? error.message : String(error));
    throw new Error(`无法创建数据目录 ${DATA_DIR}`);
  }
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    // 文件不存在是正常情况，使用fallback
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[store] ⚠️  读取文件失败，使用默认值: ${path}`, error instanceof Error ? error.message : String(error));
    }
    return fallback;
  }
}

async function writeJson(path: string, data: unknown) {
  try {
    await ensureDataDir();
    await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`[store] ❌ 写入文件失败: ${path}`, error instanceof Error ? error.message : String(error));
    throw new Error(`无法写入文件 ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** 读取所有补仓点 */
export async function loadBuyPoints(): Promise<BuyPoint[]> {
  return readJson<BuyPoint[]>(BUY_POINTS_FILE, []);
}

/** 保存补仓点 */
export async function saveBuyPoints(points: BuyPoint[]) {
  await writeJson(BUY_POINTS_FILE, points);
}

/** 添加一条补仓记录 */
export async function addBuyPoint(point: BuyPoint) {
  const points = await loadBuyPoints();
  points.push(point);
  await saveBuyPoints(points);
}

/** 读取近期高点记录（支持旧格式向新格式迁移） */
export async function loadHighPoints(): Promise<Record<string, HighPoint>> {
  const data = await readJson<Record<string, number | HighPoint>>(HIGH_POINTS_FILE, {});

  // 自动迁移旧格式 { code: number } → { code: { value: number, date: string } }
  const migrated: Record<string, HighPoint> = {};
  for (const [code, value] of Object.entries(data)) {
    if (typeof value === "number") {
      migrated[code] = { value, date: new Date().toISOString() };
    } else {
      migrated[code] = value;
    }
  }
  return migrated;
}

/** 保存近期高点记录 */
export async function saveHighPoints(points: Record<string, HighPoint>) {
  await writeJson(HIGH_POINTS_FILE, points);
}

/** 读取已触发档位记录 */
export async function loadTriggeredTiers(): Promise<Record<string, TriggeredTiers>> {
  return readJson<Record<string, TriggeredTiers>>(TRIGGERED_TIERS_FILE, {});
}

/** 保存已触发档位记录 */
export async function saveTriggeredTiers(tiers: Record<string, TriggeredTiers>) {
  await writeJson(TRIGGERED_TIERS_FILE, tiers);
}

/** 标记档位已触发 */
export async function markTierTriggered(code: string, action: "buy" | "sell", tier: number) {
  const tiers = await loadTriggeredTiers();
  if (!tiers[code]) {
    tiers[code] = {};
  }
  tiers[code][action] = tier;
  await saveTriggeredTiers(tiers);
}

/** 清除基金的触发记录（当高点重置或完成交易后） */
export async function clearTriggeredTiers(code: string, action?: "buy" | "sell") {
  const tiers = await loadTriggeredTiers();
  if (!tiers[code]) return;

  if (action) {
    delete tiers[code][action];
  } else {
    delete tiers[code];
  }
  await saveTriggeredTiers(tiers);
}
