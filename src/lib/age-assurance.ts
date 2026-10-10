/**
 * Age-assurance policy for KOVA.
 *
 * Important: Firebase/Google sign-in proves account identity, not that the
 * account holder is 18+. This module deliberately fails closed until a real,
 * approved age-assurance provider is integrated and verified server-side.
 */
export type AgeAssuranceStatus = "unverified" | "verified_adult" | "verified_minor";

export type AgeAssuranceRecord = {
  status: AgeAssuranceStatus;
  checkedAt: string | null;
  provider: string | null;
};

export const DEFAULT_AGE_ASSURANCE: AgeAssuranceRecord = {
  status: "unverified",
  checkedAt: null,
  provider: null,
};

/** Only a trusted server-verified status may unlock age-restricted features. */
export function canAccessAgeRestrictedContent(record: AgeAssuranceRecord | null | undefined): boolean {
  return record?.status === "verified_adult" &&
    typeof record.checkedAt === "string" &&
    typeof record.provider === "string" &&
    record.provider.trim().length > 0;
}

/** Treat missing or malformed records as unverified. */
export function normalizeAgeAssurance(value: unknown): AgeAssuranceRecord {
  if (!value || typeof value !== "object") return DEFAULT_AGE_ASSURANCE;
  const record = value as Partial<AgeAssuranceRecord>;
  if (
    (record.status === "verified_adult" || record.status === "verified_minor" || record.status === "unverified") &&
    (record.checkedAt === null || typeof record.checkedAt === "string") &&
    (record.provider === null || typeof record.provider === "string")
  ) {
    return {
      status: record.status,
      checkedAt: record.checkedAt ?? null,
      provider: record.provider ?? null,
    };
  }
  return DEFAULT_AGE_ASSURANCE;
}
