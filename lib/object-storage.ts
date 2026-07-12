import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

declare global {
  var objectStorageClient: S3Client | undefined;
  var objectStorageBucketReady: Promise<void> | undefined;
}

export function objectStorageConfigured(): boolean {
  return Boolean(env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
}

function getStorageClient(): S3Client | null {
  if (!objectStorageConfigured()) return null;

  if (!globalThis.objectStorageClient) {
    globalThis.objectStorageClient = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
      },
      maxAttempts: 2,
    });
  }

  return globalThis.objectStorageClient;
}

export async function ensureStorageBucket(): Promise<void> {
  const client = getStorageClient();
  if (!client) return;

  if (!globalThis.objectStorageBucketReady) {
    globalThis.objectStorageBucketReady = (async () => {
      try {
        await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
      } catch {
        await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
      }
    })();
  }

  await globalThis.objectStorageBucketReady;
}

export async function putObject({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<boolean> {
  const client = getStorageClient();
  if (!client) {
    logger.warn("storage.put_not_configured", { key });
    return false;
  }

  try {
    await ensureStorageBucket();
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return true;
  } catch (error) {
    logger.error("storage.put_failed", error, { key });
    return false;
  }
}

export async function getObject(key: string): Promise<{
  body: ReadableStream | null;
  contentType: string;
} | null> {
  const client = getStorageClient();
  if (!client) {
    logger.warn("storage.get_not_configured", { key });
    return null;
  }

  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    );
    return {
      body: response.Body?.transformToWebStream() ?? null,
      contentType: response.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    logger.warn("storage.get_failed", {
      key,
      errorMessage: error instanceof Error ? error.message : "Unknown storage error",
    });
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const client = getStorageClient();
  if (!client) {
    logger.warn("storage.delete_not_configured", { key });
    return;
  }

  try {
    await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  } catch (error) {
    logger.warn("storage.delete_failed", {
      key,
      errorMessage: error instanceof Error ? error.message : "Unknown storage error",
    });
  }
}

export async function checkObjectStorage(): Promise<"ok" | "not_configured" | "degraded"> {
  if (!objectStorageConfigured()) return "not_configured";

  try {
    await ensureStorageBucket();
    return "ok";
  } catch {
    globalThis.objectStorageBucketReady = undefined;
    return "degraded";
  }
}
