export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`CONFIG_${name}`);
  return value;
}
export const limits = {
  maxBytes: 500_000_000,
  partSize: 10 * 1024 * 1024,
  minDuration: 120_000,
  maxDuration: 1_800_000,
  retentionDays: 7,
};
export function authConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.BETTER_AUTH_URL,
  );
}

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

/**
 * Storage is not optional for uploading: fail before creating an orphan project.
 * This check only reports whether required configuration exists, not whether
 * the bucket, credentials, CORS, and lifecycle rules are actually valid.
 */
export function storageConfigured() {
  return [
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ].every((key) => Boolean(process.env[key]?.trim()));
}
