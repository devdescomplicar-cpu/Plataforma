import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../../cache');
const CACHE_DURATION_DAYS = 10;
const CACHE_DURATION_MS = CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000;

interface CacheMetadata {
  lastUpdated: string;
  data: unknown;
}

async function ensureCacheDir(): Promise<void> {
  try {
    await fs.access(CACHE_DIR);
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
}

async function getCacheFilePath(key: string): Promise<string> {
  await ensureCacheDir();
  return path.join(CACHE_DIR, `${key}.json`);
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const filePath = await getCacheFilePath(key);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const cache: CacheMetadata = JSON.parse(fileContent);
    
    const lastUpdated = new Date(cache.lastUpdated).getTime();
    const now = Date.now();
    const age = now - lastUpdated;
    
    // Se o cache expirou (mais de 10 dias), retornar null para forçar atualização
    if (age > CACHE_DURATION_MS) {
      return null;
    }
    
    return cache.data as T;
  } catch (error) {
    // Arquivo não existe ou erro ao ler
    return null;
  }
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  try {
    const filePath = await getCacheFilePath(key);
    const cache: CacheMetadata = {
      lastUpdated: new Date().toISOString(),
      data,
    };
    
    await fs.writeFile(filePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[FIPE Cache] Error saving cache for ${key}:`, error);
  }
}

export async function clearCache(key?: string): Promise<void> {
  try {
    if (key) {
      const filePath = await getCacheFilePath(key);
      await fs.unlink(filePath);
    } else {
      // Limpar todo o cache
      const files = await fs.readdir(CACHE_DIR);
      await Promise.all(
        files
          .filter((file) => file.endsWith('.json'))
          .map((file) => fs.unlink(path.join(CACHE_DIR, file)))
      );
    }
  } catch (error) {
    console.error(`[FIPE Cache] Error clearing cache:`, error);
  }
}
