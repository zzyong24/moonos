import { describe, it, expect, beforeEach } from "vitest";
import { GovernanceEngine, GovernanceViolationError } from "../../src/core/governance/engine.js";
import type { GovernanceRule, GovernanceViolation } from "../../src/core/governance/engine.js";

describe("GovernanceEngine", () => {
  let engine: GovernanceEngine;

  beforeEach(() => {
    engine = new GovernanceEngine();
  });

  it("should pass when no rules registered", () => {
    const result = engine.check("memory:create", {});
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should register and execute a rule", () => {
    const rule: GovernanceRule = {
      id: "test-rule",
      description: "Always fails",
      operations: ["test:op"],
      priority: 10,
      check(): GovernanceViolation[] {
        return [{ rule: "test-rule", message: "Fail!", severity: "error" }];
      },
    };

    engine.register(rule);
    const result = engine.check("test:op", {});
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toBe("Fail!");
  });

  it("should separate warnings from errors", () => {
    engine.register({
      id: "warn-rule",
      description: "Warns",
      operations: ["test:op"],
      priority: 10,
      check(): GovernanceViolation[] {
        return [{ rule: "warn-rule", message: "Watch out", severity: "warning" }];
      },
    });

    const result = engine.check("test:op", {});
    expect(result.passed).toBe(true); // warnings don't block
    expect(result.warnings).toHaveLength(1);
  });

  it("should enforce and throw on error violations", () => {
    engine.register({
      id: "block-rule",
      description: "Blocks",
      operations: ["test:op"],
      priority: 10,
      check(): GovernanceViolation[] {
        return [{ rule: "block-rule", message: "Blocked!", severity: "error" }];
      },
    });

    expect(() => engine.enforce("test:op", {})).toThrow(GovernanceViolationError);
  });

  it("should only run rules matching the operation", () => {
    let ran = false;
    engine.register({
      id: "specific-rule",
      description: "Only for memory:create",
      operations: ["memory:create"],
      priority: 10,
      check(): GovernanceViolation[] {
        ran = true;
        return [];
      },
    });

    engine.check("workflow:create", {});
    expect(ran).toBe(false);

    engine.check("memory:create", {});
    expect(ran).toBe(true);
  });

  it("should support wildcard operations", () => {
    let ran = false;
    engine.register({
      id: "global-rule",
      description: "Runs on everything",
      operations: ["*"],
      priority: 100,
      check(): GovernanceViolation[] {
        ran = true;
        return [];
      },
    });

    engine.check("anything:here", {});
    expect(ran).toBe(true);
  });

  it("should run rules in priority order", () => {
    const order: number[] = [];

    engine.register({
      id: "rule-20",
      description: "",
      operations: ["test:op"],
      priority: 20,
      check() { order.push(20); return []; },
    });
    engine.register({
      id: "rule-5",
      description: "",
      operations: ["test:op"],
      priority: 5,
      check() { order.push(5); return []; },
    });
    engine.register({
      id: "rule-10",
      description: "",
      operations: ["test:op"],
      priority: 10,
      check() { order.push(10); return []; },
    });

    engine.check("test:op", {});
    expect(order).toEqual([5, 10, 20]);
  });

  it("should list registered rules", () => {
    engine.register({
      id: "r1", description: "Rule 1", operations: ["a"], priority: 10,
      check() { return []; },
    });
    engine.register({
      id: "r2", description: "Rule 2", operations: ["b"], priority: 5,
      check() { return []; },
    });

    const list = engine.listRules();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("r2"); // priority 5 first
    expect(list[1].id).toBe("r1");
  });
});
