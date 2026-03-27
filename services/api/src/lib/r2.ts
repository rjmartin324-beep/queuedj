/**
 * Cloudflare R2 — stem file storage
 *
 * R2 is S3-compatible. Endpoint: https://{ACCOUNT_ID}.r2.cloudflarestorage.com
 *
 * Required env vars:
 *   R2_ACCOUNT_ID          — Cloudflare account ID (found in dashboard sidebar)
 *   R2_ACCESS_KEY_ID       — R2 API token → "Access Key ID"
 *   R2_SECRET_ACCESS_KEY   — R2 API token → "Secret Access Key"
 *   R2_BUCKET_NAME         — bucket name, e.g. "partyglue-stems"
 *
 * Stem file layout in bucket:
 *   stems/{isrc}/vocals.mp3
 *   stems/{isrc}/drums.mp3
 *   stems/{isrc}/bass.mp3
 *   stems/{isrc}/other.mp3
 *
 * How to create credentials:
 *   Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API Token
 *   Permissions: Object Read & Write on the stems bucket.
 */

import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl }                from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand }            from "@aws-sdk/client-s3";

// ─── Stem types ───────────────────────────────────────────────────────────────

export type StemName = "vocals" | "drums" | "bass" | "other";

export const STEM_NAMES: StemName[] = ["vocals", "drums", "bass", "other"];

export interface StemUrls {
  vocals: string;
  drums:  string;
  bass:   string;
  other:  string;
}

// ─── R2 client ────────────────────────────────────────────────────────────────

function makeR2Client(): S3Client | null {
  const accountId  = process.env.R2_ACCOUNT_ID;
  const accessKey  = process.env.R2_ACCESS_KEY_ID;
  const secretKey  = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKey || !secretKey) return null;

  return new S3Client({
    region:   "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     accessKey,
      secretAccessKey: secretKey,
    },
  });
}

// Lazy singleton — only constructed if env vars are present
let _client: S3Client | null | undefined;
function getClient(): S3Client | null {
  if (_client === undefined) _client = makeR2Client();
  return _client;
}

function getBucket(): string {
  return process.env.R2_BUCKET_NAME ?? "partyglue-stems";
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

export function stemKey(isrc: string, stem: StemName): string {
  return `stems/${isrc}/${stem}.mp3`;
}

// ─── Existence check ──────────────────────────────────────────────────────────

/**
 * Returns true if all four stem files exist in R2 for this ISRC.
 * Uses the vocals stem as sentinel — if it's there, all four were uploaded together.
 */
export async function stemsExist(isrc: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    await client.send(new HeadObjectCommand({
      Bucket: getBucket(),
      Key:    stemKey(isrc, "vocals"),
    }));
    return true;
  } catch {
    return false;
  }
}

// ─── Presigned URL generation ─────────────────────────────────────────────────

/**
 * Returns presigned GET URLs for all four stems (valid for 1 hour).
 * Caller must verify stemsExist() before calling this.
 */
export async function getPresignedStemUrls(isrc: string): Promise<StemUrls> {
  const client = getClient();
  if (!client) throw new Error("R2 not configured");

  const bucket  = getBucket();
  const expiry  = 3600; // 1 hour — enough to stream a full set

  const [vocals, drums, bass, other] = await Promise.all(
    STEM_NAMES.map((stem) =>
      getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: stemKey(isrc, stem) }),
        { expiresIn: expiry },
      )
    )
  );

  return { vocals, drums, bass, other };
}
