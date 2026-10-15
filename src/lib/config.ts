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
