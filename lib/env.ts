import { z } from "zod";

const OptionalUrlSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

/**
 * Every environment variable the app depends on, validated once at module
 * load. A missing or malformed value fails loudly and immediately with a
 * clear message instead of surfacing as a cryptic error three requests into
 * production traffic (e.g. Prisma throwing on a malformed connection string
 * only when the first query runs).
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection string"),

  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .default("http://localhost:3000"),

  MEILISEARCH_HOST: OptionalUrlSchema,
  MEILISEARCH_API_KEY: z.string().optional(),
  MEILISEARCH_USERS_INDEX: z.string().min(1).default("users"),
  MEILISEARCH_ORGANIZATIONS_INDEX: z.string().min(1).default("organizations"),
  MEILISEARCH_ASSETS_INDEX: z.string().min(1).default("assets"),

  REDIS_URL: OptionalUrlSchema,
  CACHE_TTL_SECONDS: z.coerce.number().int().min(1).max(3600).default(20),

  S3_ENDPOINT: OptionalUrlSchema,
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().min(3).default("odoo-template"),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  STORAGE_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1).max(25 * 1024 * 1024).default(5 * 1024 * 1024),

  LLM_API_BASE_URL: OptionalUrlSchema,
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),

  LOKI_PUSH_URL: OptionalUrlSchema,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in real values.`
    );
  }

  return parsed.data;
}

export const env = loadEnv();
