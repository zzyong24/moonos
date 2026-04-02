/**
 * Shared base schemas — 所有协议的公共字段和工具类型。
 * protocols 包唯一的外部依赖是 Zod。
 */
import { z } from "zod";
import { MoonOSError } from "../../core/errors.js";

// ─── Primitive Schemas ────────────────────────────────────────────

export const NonEmptyString = z.string().trim().min(1);

export const IsoDateTimeString = z.string().datetime({ offset: true });

export const UnitInterval = z.number().min(0).max(1);

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
export const SemverString = z.string().regex(SEMVER_RE, "Version must match major.minor.patch");

const SEMVER_SELECTOR_RE = /^\d+\.\d+\.(?:\d+|x)$/;
export const SemverSelectorString = z.string().regex(SEMVER_SELECTOR_RE, "Version selector must match major.minor.patch or major.minor.x");

const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
export const Sha256Digest = z.string().regex(SHA256_RE, "Hash must match sha256:<64 hex chars>");

export const YearMonthString = z.string().regex(/^\d{4}-\d{2}$/, "Month must match YYYY-MM");

export const StringMap = z.record(NonEmptyString, NonEmptyString);
export const UnknownRecord = z.record(z.string(), z.unknown());

// ─── Protocol Version ─────────────────────────────────────────────

export const CURRENT_PROTOCOL_VERSION = "0.3.0" as const;

export type ProtocolSemver = `${number}.${number}.${number}`;

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export function parseSemver(version: string): ParsedSemver {
  const parsed = SemverString.safeParse(version);
  if (!parsed.success) {
    throw new MoonOSError(
      "error.protocol.invalidSemver",
      `Invalid semver: ${version}`,
      { version },
    );
  }
  const [major, minor, patch] = parsed.data.split(".").map(Number);
  return { major, minor, patch, raw: parsed.data };
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

// ─── Base Asset Schema ────────────────────────────────────────────

/** 所有可管理资产的公共字段 */
export const BaseAssetFields = z.object({
  id: NonEmptyString,
  created_at: IsoDateTimeString,
  updated_at: IsoDateTimeString,
});
