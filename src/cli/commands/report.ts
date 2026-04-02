import { Command } from "commander";
import { FalsificationReportGenerator } from "../../core/reports/falsification.js";
import { printJson } from "../formatters/json.js";
import { formatCliError, t } from "../i18n.js";
import { resolveWorkspaceOrExit, handleError } from "../util.js";

export function registerReportCommands(program: Command): void {
  const report = program
    .command("report")
    .description(t("report.command.description"));

  report
    .command("generate <month>")
    .description(t("report.generate.description"))
    .option("--json", t("common.outputJson"))
    .action(async (month, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const gen = new FalsificationReportGenerator(ws.storage);
        const { report: r, actions_taken } = await gen.generate(month);

        if (opts.json) {
          printJson({ report: r, actions_taken });
          return;
        }

        console.log(t("report.generate.success", { reportId: r.report_id }));
        console.log(t("report.generate.month", { month: r.month }));
        console.log(t("report.generate.judgments", { count: r.summary.falsified_judgments }));
        console.log(t("report.generate.highImpact", { count: r.summary.high_impact_judgments }));
        console.log(t("report.generate.frozenMemories", { count: r.summary.frozen_memories }));
        console.log(t("report.generate.hash", { hash: r.integrity.hash }));
        if (actions_taken.length > 0) {
          console.log(`\n${t("report.generate.actions")}`);
          for (const a of actions_taken) console.log(`  - ${formatCliError(new Error(a))}`);
        }
        if (r.summary.falsified_judgments === 0) {
          console.log(`\n${t("report.generate.none")}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  report
    .command("show <month>")
    .description(t("report.show.description"))
    .option("--json", t("common.outputJson"))
    .action(async (month, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const gen = new FalsificationReportGenerator(ws.storage);
        const r = await gen.getReport(month);
        if (!r) {
          console.error(`${t("common.errorPrefix")}: ${t("error.report.notFound", { month })}`);
          process.exit(1);
        }

        if (opts.json) {
          printJson(r);
          return;
        }

        console.log(t("report.show.title", { month: r.month }));
        console.log(t("report.show.generated", { generatedAt: r.generated_at }));
        console.log(t("report.show.hash", { hash: r.integrity.hash }));
        console.log(t("report.show.acknowledged", {
          value: r.acknowledgement.acknowledged_at ?? t("report.show.notYet"),
        }));
        console.log("");
        console.log(t("report.show.summary"));
        console.log(t("report.generate.judgments", { count: r.summary.falsified_judgments }));
        console.log(t("report.generate.highImpact", { count: r.summary.high_impact_judgments }));
        console.log(t("report.generate.frozenMemories", { count: r.summary.frozen_memories }));

        if (r.judgments.length > 0) {
          console.log(`\n${t("report.show.judgments")}`);
          for (const j of r.judgments) {
            console.log(`  [${j.impact.toUpperCase()}] ${j.title}`);
            console.log(t("report.show.sourceEvidence", {
              source: j.source,
              evidence: j.evidence_refs.join(", "),
            }).replace(/^/, "    "));
            if (j.required_actions.length > 0) {
              console.log(t("report.show.actions", {
                actions: j.required_actions.join("; "),
              }).replace(/^/, "    "));
            }
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  report
    .command("acknowledge <month>")
    .description(t("report.acknowledge.description"))
    .option("--json", t("common.outputJson"))
    .action(async (month, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const gen = new FalsificationReportGenerator(ws.storage);
        const r = await gen.acknowledgeReport(month);

        if (opts.json) {
          printJson(r);
          return;
        }
        console.log(t("report.acknowledge.success", {
          month: r.month,
          timestamp: r.acknowledgement.acknowledged_at,
        }));
      } catch (err) {
        handleError(err);
      }
    });

  report
    .command("list")
    .description(t("report.list.description"))
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const gen = new FalsificationReportGenerator(ws.storage);
        const reports = await gen.listReports();

        if (opts.json) {
          printJson(reports);
          return;
        }
        if (reports.length === 0) {
          console.log(t("report.list.none"));
          return;
        }

        for (const r of reports) {
          const ack = r.acknowledgement.acknowledged_at ? "✓" : t("report.list.unacknowledged");
          console.log(t("report.list.line", {
            month: r.month,
            judgments: r.summary.falsified_judgments,
            high: r.summary.high_impact_judgments,
            ack,
          }));
        }
      } catch (err) {
        handleError(err);
      }
    });
}
