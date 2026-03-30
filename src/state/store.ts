import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuyPoint } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const BUY_POINTS_FILE = join(DATA_DIR, "buy-points.json");
const HIGH_POINTS_FILE = join(DATA_DIR, "high-points.json");

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

/** 读取近期高点记录 { [fundCode]: number } */
export async function loadHighPoints(): Promise<Record<string, number>> {
  return readJson<Record<string, number>>(HIGH_POINTS_FILE, {});
}

/** 保存近期高点记录 */
export async function saveHighPoints(points: Record<string, number>) {
  await writeJson(HIGH_POINTS_FILE, points);
}
