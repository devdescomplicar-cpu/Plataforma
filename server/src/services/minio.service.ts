import * as Minio from 'minio';
import sharp from 'sharp';
import { Readable } from 'stream';

class MinioService {
  private static instance: MinioService;
  private client: Minio.Client;
  private bucketName: string;

  private constructor() {
    this.bucketName = process.env.MINIO_BUCKET || 'vehicle-images';
    
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });

    this.ensureBucket().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[S3] Unavailable – uploads will fail until storage is running:', msg);
    });
  }

  public static getInstance(): MinioService {
    if (!MinioService.instance) {
      MinioService.instance = new MinioService();
    }
    return MinioService.instance;
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        // Configurar política pública para leitura
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.client.setBucketPolicy(this.bucketName, JSON.stringify(policy));
      }
    } catch (error) {
      console.error('Error ensuring bucket:', error);
    }
  }

  private static readonly MAX_IMAGE_BYTES = 300 * 1024; // 300KB

  /**
   * Comprime imagem até no máximo 300KB.
   * Redimensiona (inside 1071x1428), reduz qualidade progressivamente até atingir o limite.
   */
  public async uploadImage(
    file: Express.Multer.File,
    vehicleId: string,
    order: number = 0
  ): Promise<{ url: string; key: string; sizeBytes: number }> {
    const key = `vehicles/${vehicleId}/${Date.now()}-${order}.jpg`;
    console.log('[MinIO] uploadImage started', { vehicleId, order, size: file.buffer?.length });
    try {

      let processedImage: Buffer;
      let quality = 80;
      const minQuality = 25;

      const meta = await sharp(file.buffer).metadata();
      const maxWidth = 1071;
      const maxHeight = 1428;

      do {
        processedImage = await sharp(file.buffer)
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3,
          })
          .jpeg({
            quality,
            mozjpeg: true,
          })
          .toBuffer();

        if (processedImage.length <= MinioService.MAX_IMAGE_BYTES) break;
        quality -= 10;
        if (quality < minQuality) {
          const scale = Math.sqrt(MinioService.MAX_IMAGE_BYTES / processedImage.length);
          const w = Math.max(320, Math.floor((meta.width ?? maxWidth) * scale));
          const h = Math.max(320, Math.floor((meta.height ?? maxHeight) * scale));
          processedImage = await sharp(file.buffer)
            .resize(w, h, { fit: 'inside', withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
            .jpeg({ quality: minQuality, mozjpeg: true })
            .toBuffer();
          break;
        }
      } while (processedImage.length > MinioService.MAX_IMAGE_BYTES);

      await this.client.putObject(
        this.bucketName,
        key,
        Readable.from(processedImage),
        processedImage.length,
        { 'Content-Type': 'image/jpeg' }
      );

      console.log('[S3] uploadImage done', { key, bytes: processedImage.length });
      return { url: this.getImageUrl(key), key, sizeBytes: processedImage.length };
    } catch (error) {
      console.error('[S3] uploadImage error', { vehicleId, order, error });
      throw new Error('Failed to upload image');
    }
  }

  /**
   * Upload store logo. Key: stores/{accountId}/logo.jpg.
   * Resized to max 400x400, JPEG, suitable for reports/prints.
   */
  public async uploadStoreLogo(
    accountId: string,
    file: Express.Multer.File
  ): Promise<{ url: string; key: string; sizeBytes: number }> {
    const key = `stores/${accountId}/logo.jpg`;
    const maxWidth = 400;
    const maxHeight = 400;
    const maxBytes = 150 * 1024; // 150KB for logo
    try {
      let processedImage = await sharp(file.buffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      if (processedImage.length > maxBytes) {
        processedImage = await sharp(processedImage)
          .jpeg({ quality: 70, mozjpeg: true })
          .toBuffer();
      }
      await this.client.putObject(
        this.bucketName,
        key,
        Readable.from(processedImage),
        processedImage.length,
        { 'Content-Type': 'image/jpeg' }
      );
      return { url: this.getImageUrl(key), key, sizeBytes: processedImage.length };
    } catch (error) {
      console.error('[S3] uploadStoreLogo error', { accountId, error });
      throw new Error('Failed to upload store logo');
    }
  }

  /** Logo da loja para modo escuro (PDFs/relatórios). Key: stores/{accountId}/logo-dark.jpg */
  public async uploadStoreLogoDark(
    accountId: string,
    file: Express.Multer.File
  ): Promise<{ url: string; key: string; sizeBytes: number }> {
    const key = `stores/${accountId}/logo-dark.jpg`;
    const maxWidth = 400;
    const maxHeight = 400;
    const maxBytes = 150 * 1024;
    try {
      let processedImage = await sharp(file.buffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      if (processedImage.length > maxBytes) {
        processedImage = await sharp(processedImage)
          .jpeg({ quality: 70, mozjpeg: true })
          .toBuffer();
      }
      await this.client.putObject(
        this.bucketName,
        key,
        Readable.from(processedImage),
        processedImage.length,
        { 'Content-Type': 'image/jpeg' }
      );
      return { url: this.getImageUrl(key), key, sizeBytes: processedImage.length };
    } catch (error) {
      console.error('[S3] uploadStoreLogoDark error', { accountId, error });
      throw new Error('Failed to upload store logo (dark)');
    }
  }

  public async deleteImage(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketName, key);
    } catch (error) {
      console.error('Error deleting image:', error);
      throw new Error('Failed to delete image');
    }
  }

  /** URL interna do Servidor S3 (usado apenas no banco; o cliente deve usar a rota da API). */
  public getImageUrl(key: string): string {
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    return `${protocol}://${endpoint}:${port}/${this.bucketName}/${key}`;
  }

  /**
   * Returns bucket stats: total size, object count, largest object size.
   * Used by admin storage dashboard.
   */
  public getBucketStats(): Promise<{
    totalSizeBytes: number;
    objectCount: number;
    largestObjectBytes: number;
    available: boolean;
  }> {
    return new Promise((resolve) => {
      this.client
        .bucketExists(this.bucketName)
        .then((exists) => {
          if (!exists) {
            resolve({ totalSizeBytes: 0, objectCount: 0, largestObjectBytes: 0, available: false });
            return;
          }
          let totalSize = 0;
          let objectCount = 0;
          let largestBytes = 0;
          const stream = this.client.listObjects(this.bucketName, '', true);
          stream.on('data', (obj: { size?: number }) => {
            const sz = obj.size ?? 0;
            objectCount += 1;
            totalSize += sz;
            if (sz > largestBytes) largestBytes = sz;
          });
          stream.on('end', () => {
            resolve({ totalSizeBytes: totalSize, objectCount, largestObjectBytes: largestBytes, available: true });
          });
          stream.on('error', (e) => {
            console.error('[S3] getBucketStats stream error', e);
            resolve({ totalSizeBytes: totalSize, objectCount, largestObjectBytes: largestBytes, available: true });
          });
        })
        .catch((e) => {
          console.error('[S3] getBucketStats error', e);
          resolve({ totalSizeBytes: 0, objectCount: 0, largestObjectBytes: 0, available: false });
        });
    });
  }

  /**
   * List all object keys and sizes in the bucket (for top consumers / quality).
   */
  public async listObjectSizes(): Promise<{ key: string; size: number }[]> {
    const exists = await this.client.bucketExists(this.bucketName);
    if (!exists) return [];
    const list: { key: string; size: number }[] = [];
    return new Promise((resolve, reject) => {
      const stream = this.client.listObjects(this.bucketName, '', true);
      stream.on('data', (obj: { name?: string; size?: number }) => {
        const key = obj.name ?? '';
        if (key) list.push({ key, size: obj.size ?? 0 });
      });
      stream.on('end', () => resolve(list));
      stream.on('error', reject);
    });
  }

  /**
   * Get bucket lifecycle (retention) configuration. Returns null if none or invalid.
   */
  public async getBucketLifecycle(): Promise<{ Rule?: unknown[] } | null> {
    try {
      const lifecycle = await this.client.getBucketLifecycle(this.bucketName);
      if (lifecycle && typeof lifecycle === 'object' && lifecycle !== null) {
        return lifecycle as { Rule?: unknown[] };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Set bucket lifecycle (retention) – e.g. abort incomplete multipart after 7 days.
   */
  public async setBucketLifecycle(config: { Rule: unknown[] }): Promise<void> {
    await this.client.setBucketLifecycle(this.bucketName, config as Minio.Lifecycle);
  }

  /**
   * Stream do objeto no Servidor S3 para repassar na resposta HTTP.
   * Uso: GET /api/vehicle-images/:key → mesmo domínio, sem mixed content.
   */
  public async getObjectStream(key: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string }> {
    const ext = key.split('.').pop()?.toLowerCase() ?? 'jpg';
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const stream = await this.client.getObject(this.bucketName, key);
    return { stream, contentType };
  }
}

export const minioService = MinioService.getInstance();

/** URL pública da imagem pela API (mesmo domínio HTTPS, sem expor o Servidor S3). */
export function getPublicImageUrl(key: string): string {
  const base = '/api/vehicle-images';
  const normalized = key.startsWith('/') ? key.slice(1) : key;
  return `${base}/${normalized}`;
}
