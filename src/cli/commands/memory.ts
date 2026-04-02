import { Command } from "commander";
import { MemoryService } from "../../core/memory/service.js";
import type { BatchReviewItem } from "../../core/memory/service.js";
import { printJson } from "../formatters/json.js";
import { printTable } from "../formatters/table.js";
import { formatDateShort, formatGovernanceViolation, t } from "../i18n.js";
import { resolveWorkspaceOrExit, handleError } from "../util.js";

export function registerMemoryCommands(program: Command): void {
  const memory = program
    .command("memory")
    .description(t("memory.command.description"));

  memory
    .command("create")
    .description(t("memory.create.description"))
    .requiredOption("-t, --type <type>", t("memory.create.option.type"))
    .requiredOption("--title <title>", t("memory.create.option.title"))
    .requiredOption("--content <content>", t("memory.create.option.content"))
    .option("--summary <summary>", t("memory.create.option.summary"))
    .option("--source <source>", t("memory.create.option.source"), "manual")
    .option("--scope <scope>", t("memory.create.option.scope"), "global")
    .option("--product <product>", t("memory.create.option.product"))
    .option("--confidence <n>", t("memory.create.option.confidence"), parseFloat)
    .option("--tags <tags>", t("memory.create.option.tags"), (v: string) => v.split(",").map((tag: string) => tag.trim()))
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);
        const summary = opts.summary ?? opts.content.slice(0, 100);

        const { item, governance } = await service.create({
          type: opts.type,
          title: opts.title,
          summary,
          content: opts.content,
          source: opts.source,
          scope: opts.scope,
          product: opts.product,
          confidence: opts.confidence,
          tags: opts.tags ?? [],
          counter_evidence: [],
        });

        if (opts.json) {
          printJson({ item, governance });
          return;
        }

        console.log(t("memory.create.success", { id: item.id }));
        console.log(t("memory.create.meta", {
          type: item.type,
          status: item.status,
          scope: item.scope,
        }));
        console.log(t("memory.create.title", { title: item.title }));
        if (item.expires_at) console.log(t("memory.create.expires", { expiresAt: item.expires_at }));
        printWarnings(governance.warnings.map((w) => formatGovernanceViolation(w)));
      } catch (err) {
        handleError(err);
      }
    });

  memory
    .command("list")
    .description(t("memory.list.description"))
    .option("-t, --type <type>", t("memory.list.option.type"))
    .option("-s, --status <status>", t("memory.list.option.status"))
    .option("--limit <n>", t("memory.list.option.limit"), parseInt)
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);

        const where: Record<string, unknown> = {};
        if (opts.type) where.type = opts.type;
        if (opts.status) where.status = opts.status;

        const items = await service.list({
          where: Object.keys(where).length > 0 ? where : undefined,
          limit: opts.limit,
          sort_by: "updated_at",
          sort_order: "desc",
        });

        if (opts.json) { printJson(items); return; }
        if (items.length === 0) { console.log(t("memory.list.none")); return; }

        printTable(
          [
            t("memory.list.header.id"),
            t("memory.list.header.type"),
            t("memory.list.header.status"),
            t("memory.list.header.title"),
            t("memory.list.header.confidence"),
            t("memory.list.header.expires"),
          ],
          items.map((m) => [
            m.id,
            m.type,
            m.status,
            m.title.length > 30 ? `${m.title.slice(0, 30)}...` : m.title,
            String(m.confidence),
            m.expires_at ? formatDateShort(m.expires_at) : t("common.none"),
          ]),
        );
        console.log(`\n${t("memory.list.total", { count: items.length })}`);
      } catch (err) {
        handleError(err);
      }
    });

  memory
    .command("get <id>")
    .description(t("memory.get.description"))
    .option("--json", t("common.outputJson"))
    .action(async (id, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);
        const item = await service.get(id);
        if (!item) { console.error(`${t("common.errorPrefix")}: ${t("error.memory.notFound", { id })}`); process.exit(1); }

        if (opts.json) { printJson(item); return; }

        console.log(`${t("memory.get.id")}:       ${item.id}`);
        console.log(`${t("memory.get.type")}:     ${item.type}`);
        console.log(`${t("memory.get.status")}:   ${item.status}`);
        console.log(`${t("memory.get.title")}:    ${item.title}`);
        console.log(`${t("memory.get.summary")}:  ${item.summary}`);
        console.log(`${t("memory.get.content")}:  ${item.content}`);
        console.log(t("memory.get.sourceScope", { source: item.source, scope: item.scope }));
        console.log(`${t("memory.get.confidence")}: ${item.confidence}`);
        console.log(`${t("memory.get.tags")}:     ${item.tags.join(", ") || t("common.none")}`);
        if (item.expires_at) console.log(`${t("memory.get.expires")}:  ${item.expires_at}`);
        if (item.counter_evidence.length > 0) {
          console.log(`${t("memory.get.counterEvidence")}:`);
          for (const ce of item.counter_evidence) console.log(`  - ${ce}`);
        }
        console.log(`${t("memory.get.review")}:   state=${item.review.state} policy=${item.review.policy}`);
        if (item.review.last_outcome) console.log(`          ${t("memory.get.lastOutcome").toLowerCase().replace(/\s+/g, "_")}=${item.review.last_outcome}`);
        console.log(`${t("memory.get.created")}:  ${item.created_at}`);
        console.log(`${t("memory.get.updated")}:  ${item.updated_at}`);
      } catch (err) {
        handleError(err);
      }
    });

  memory
    .command("activate <id>")
    .description(t("memory.activate.description"))
    .option("--notes <text>", t("memory.activate.option.notes"))
    .option("--json", t("common.outputJson"))
    .action(async (id, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);
        const { item, governance } = await service.activate(id, opts.notes);

        if (opts.json) { printJson({ item, governance }); return; }

        console.log(t("memory.activate.success", { id: item.id }));
        console.log(t("memory.activate.status", { status: item.status }));
        console.log(t("memory.activate.expires", { expiresAt: item.expires_at ?? t("common.none") }));
        printWarnings(governance.warnings.map((w) => formatGovernanceViolation(w)));
      } catch (err) {
        handleError(err);
      }
    });

  memory
    .command("review <id>")
    .description(t("memory.review.description"))
    .requiredOption("-d, --decision <decision>", t("memory.review.option.decision"))
    .option("--notes <text>", t("memory.review.option.notes"))
    .option("--json", t("common.outputJson"))
    .action(async (id, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);
        const { item, governance } = await service.review(id, opts.decision, opts.notes);

        if (opts.json) { printJson({ item, governance }); return; }

        console.log(t("memory.review.success", { id: item.id }));
        console.log(t("memory.review.decision", { decision: opts.decision }));
        console.log(t("memory.review.status", { status: item.status, reviewState: item.review.state }));
        if (item.expires_at) console.log(t("memory.review.expires", { expiresAt: item.expires_at }));
        printWarnings(governance.warnings.map((w) => formatGovernanceViolation(w)));
      } catch (err) {
        handleError(err);
      }
    });

  memory
    .command("batch-review")
    .description(t("memory.batchReview.description"))
    .option("--action <action>", t("memory.batchReview.option.action"), "delay")
    .option("--notes <text>", t("memory.batchReview.option.notes"))
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);
        const needsReview = await service.findNeedingReview();

        if (needsReview.length === 0) {
          console.log(t("memory.batchReview.none"));
          return;
        }

        const action = opts.action as "confirm" | "delay";
        const batchItems: BatchReviewItem[] = needsReview.map((m) => ({
          memory: m,
          decision: action,
          notes: opts.notes,
        }));

        const result = await service.batchReview(batchItems);

        if (opts.json) { printJson(result); return; }

        console.log(t("memory.batchReview.completed"));
        console.log(t("memory.batchReview.processed", { count: result.processed }));
        if (result.confirmed > 0) console.log(t("memory.batchReview.confirmed", { count: result.confirmed }));
        if (result.delayed > 0) console.log(t("memory.batchReview.delayed", { count: result.delayed }));
        if (result.skipped > 0) console.log(t("memory.batchReview.skipped", { count: result.skipped }));
        printWarnings(result.warnings);
      } catch (err) {
        handleError(err);
      }
    });

  memory
    .command("auto-downgrade")
    .description(t("memory.autoDowngrade.description"))
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);
        const result = await service.autoDowngrade();

        if (opts.json) { printJson(result); return; }

        if (result.downgraded === 0) {
          console.log(t("memory.autoDowngrade.none"));
          return;
        }

        console.log(t("memory.autoDowngrade.header", { count: result.downgraded }));
        for (const item of result.items) {
          console.log(t("memory.autoDowngrade.item", { id: item.id, title: item.title }));
        }
      } catch (err) {
        handleError(err);
      }
    });

  memory
    .command("needs-review")
    .description(t("memory.needsReview.description"))
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);
        const items = await service.findNeedingReview();

        if (opts.json) { printJson(items); return; }
        if (items.length === 0) { console.log(t("memory.needsReview.none")); return; }

        console.log(`${t("memory.needsReview.heading", { count: items.length })}\n`);
        printTable(
          [
            t("memory.needsReview.header.id"),
            t("memory.needsReview.header.type"),
            t("memory.needsReview.header.title"),
            t("memory.needsReview.header.expiredSince"),
          ],
          items.map((m) => [
            m.id,
            m.type,
            m.title.length > 30 ? `${m.title.slice(0, 30)}...` : m.title,
            m.expires_at ?? t("common.none"),
          ]),
        );
      } catch (err) {
        handleError(err);
      }
    });

  memory
    .command("add-counter-evidence <id>")
    .description(t("memory.addCounterEvidence.description"))
    .requiredOption("--text <text>", t("memory.addCounterEvidence.option.text"))
    .option("--json", t("common.outputJson"))
    .action(async (id, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);
        const item = await service.addCounterEvidence(id, opts.text);

        if (opts.json) { printJson(item); return; }

        console.log(t("memory.addCounterEvidence.success", { id: item.id }));
        console.log(t("memory.addCounterEvidence.total", { count: item.counter_evidence.length }));
        for (const ce of item.counter_evidence) {
          console.log(`    - ${ce}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  memory
    .command("stats")
    .description(t("memory.stats.description"))
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);
        const s = await service.stats();

        if (opts.json) { printJson(s); return; }

        console.log(t("memory.stats.title"));
        console.log("──────────────────────────");
        console.log(t("memory.stats.total", { count: s.total }));
        console.log("");
        console.log(t("memory.stats.byStatus"));
        for (const [k, v] of Object.entries(s.by_status)) {
          console.log(`  ${k}: ${v}`);
        }
        console.log("");
        console.log(t("memory.stats.byType"));
        for (const [k, v] of Object.entries(s.by_type)) {
          console.log(`  ${k}: ${v}`);
        }
        console.log("");
        if (s.expiring_soon > 0) console.log(t("memory.stats.expiringSoon", { count: s.expiring_soon }));
        if (s.overdue > 0) console.log(t("memory.stats.overdue", { count: s.overdue }));
        if (s.needs_downgrade > 0) console.log(t("memory.stats.needsDowngrade", { count: s.needs_downgrade }));
        if (s.expiring_soon === 0 && s.overdue === 0 && s.needs_downgrade === 0) {
          console.log(t("memory.stats.healthy"));
        }
      } catch (err) {
        handleError(err);
      }
    });
}

function printWarnings(warnings: string[]): void {
  if (warnings.length === 0) return;
  console.log("");
  for (const warning of warnings) {
    console.log(`  ⚠ ${warning}`);
  }
}
