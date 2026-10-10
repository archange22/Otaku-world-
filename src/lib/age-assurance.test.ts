import { describe, expect, it } from "vitest";
import {
  canAccessAgeRestrictedContent,
  DEFAULT_AGE_ASSURANCE,
  normalizeAgeAssurance,
} from "./age-assurance";

describe("age assurance policy", () => {
  it("denies access when no record exists", () => {
    expect(canAccessAgeRestrictedContent(undefined)).toBe(false);
    expect(canAccessAgeRestrictedContent(null)).toBe(false);
  });

  it("denies access by default", () => {
    expect(canAccessAgeRestrictedContent(DEFAULT_AGE_ASSURANCE)).toBe(false);
  });

  it("requires an adult status, timestamp and provider", () => {
    expect(canAccessAgeRestrictedContent({
      status: "verified_adult",
      checkedAt: "2026-10-10T12:00:00.000Z",
      provider: "trusted-provider",
    })).toBe(true);

    expect(canAccessAgeRestrictedContent({
      status: "verified_adult",
      checkedAt: null,
      provider: "trusted-provider",
    })).toBe(false);

    expect(canAccessAgeRestrictedContent({
      status: "verified_adult",
      checkedAt: "2026-10-10T12:00:00.000Z",
      provider: " ",
    })).toBe(false);
  });

  it("denies verified minors", () => {
    expect(canAccessAgeRestrictedContent({
      status: "verified_minor",
      checkedAt: "2026-10-10T12:00:00.000Z",
      provider: "trusted-provider",
    })).toBe(false);
  });

  it("normalizes malformed data to the unverified default", () => {
    expect(normalizeAgeAssurance({ status: "admin", checkedAt: "now", provider: "fake" }))
      .toEqual(DEFAULT_AGE_ASSURANCE);
    expect(normalizeAgeAssurance(null)).toEqual(DEFAULT_AGE_ASSURANCE);
  });
});
