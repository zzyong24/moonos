/**
 * SkillService — Skill Contract + Implementation 的 CRUD。
 * Skill 在 MoonOS 里分两层：
 *   - Contract：稳定的能力契约，跨平台不变
 *   - Implementation：面向特定平台的实现
 */
import { nanoid } from "nanoid";
import type { StorageAdapter, QueryFilter } from "../../storage/interface.js";
import { SkillContractSchema, SkillImplementationSchema } from "../../protocols/skill/schema.js";
import type { SkillContract, SkillImplementation } from "../../protocols/skill/schema.js";
import { validateStrategicSkill } from "../../protocols/skill/governance.js";
import { CURRENT_PROTOCOL_VERSION } from "../../protocols/_shared/base.js";

const CONTRACT_COLLECTION = "skill";
const IMPL_COLLECTION = "skill"; // 同 collection，靠 id 前缀区分

export class SkillService {
  constructor(private storage: StorageAdapter) {}

  // ─── Contract ───────────────────────────────────────────────

  async createContract(input: Omit<SkillContract, "id" | "version">): Promise<SkillContract> {
    const contract = SkillContractSchema.parse({
      id: `skill_contract_${nanoid(10)}`,
      version: CURRENT_PROTOCOL_VERSION,
      ...input,
    });

    // 战略类 Skill 强制校验
    const violation = validateStrategicSkill(contract);
    if (violation) {
      throw new Error(`Governance violation: ${violation}`);
    }

    await this.storage.create(CONTRACT_COLLECTION, { ...contract, id: contract.id, updated_at: new Date().toISOString() });
    return contract;
  }

  async getContract(id: string): Promise<SkillContract | null> {
    return this.storage.get<SkillContract>(CONTRACT_COLLECTION, id);
  }

  async listContracts(): Promise<SkillContract[]> {
    const all = await this.storage.list<SkillContract & { id: string }>(CONTRACT_COLLECTION);
    return all.filter((item) => item.id.startsWith("skill_contract_"));
  }

  // ─── Implementation ─────────────────────────────────────────

  async createImplementation(input: Omit<SkillImplementation, "id">): Promise<SkillImplementation> {
    const impl = SkillImplementationSchema.parse({
      id: `skill_impl_${nanoid(10)}`,
      ...input,
    });

    await this.storage.create(CONTRACT_COLLECTION, { ...impl, id: impl.id, updated_at: new Date().toISOString() });
    return impl;
  }

  async listImplementations(contractId?: string): Promise<SkillImplementation[]> {
    const all = await this.storage.list<SkillImplementation & { id: string }>(CONTRACT_COLLECTION);
    const impls = all.filter((item) => item.id.startsWith("skill_impl_"));
    if (contractId) {
      return impls.filter((impl) => impl.contract_id === contractId);
    }
    return impls;
  }

  async count(): Promise<number> {
    return this.storage.count(CONTRACT_COLLECTION);
  }
}
