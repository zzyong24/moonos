import { afterEach, describe, expect, it } from "vitest";
import { MoonOSError } from "../../src/core/errors.js";
import type { GovernanceViolation } from "../../src/core/governance/engine.js";
import {
  formatCliError,
  formatGovernanceViolation,
  normalizeCliLocale,
  setCliLocale,
  t,
} from "../../src/cli/i18n.js";

describe("CLI i18n", () => {
  afterEach(() => {
    setCliLocale("en");
  });

  it("should normalize common locale formats", () => {
    expect(normalizeCliLocale("en_US.UTF-8")).toBe("en");
    expect(normalizeCliLocale("zh_CN.UTF-8")).toBe("zh-CN");
    expect(normalizeCliLocale("zh")).toBe("zh-CN");
    expect(normalizeCliLocale("fr-FR")).toBe("en");
  });

  it("should translate catalog messages for the active locale", () => {
    setCliLocale("zh-CN");
    expect(t("status.description")).toBe("查看工作区状态");

    setCliLocale("en");
    expect(t("status.description")).toBe("Show workspace status");
  });

  it("should format MoonOS errors using the active locale", () => {
    const err = new MoonOSError(
      "error.memory.notFound",
      "Memory not found: mem_123",
      { id: "mem_123" },
    );

    setCliLocale("zh-CN");
    expect(formatCliError(err)).toBe("未找到记忆：mem_123");

    setCliLocale("en");
    expect(formatCliError(err)).toBe("Memory not found: mem_123");
  });

  it("should translate governance violations by key", () => {
    const violation: GovernanceViolation = {
      rule: "memory.low-confidence-warning",
      message: "Memory confidence is only 0.2; collect more evidence before activation",
      severity: "warning",
      message_key: "governance.memory.lowConfidence",
      message_params: { confidence: 0.2 },
    };

    setCliLocale("zh-CN");
    expect(formatGovernanceViolation(violation)).toBe("记忆 confidence 仅为 0.2，建议收集更多证据后再激活");

    setCliLocale("en");
    expect(formatGovernanceViolation(violation)).toBe("Memory confidence is only 0.2; collect more evidence before activation");
  });
});
