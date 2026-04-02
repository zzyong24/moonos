import { Command } from "commander";
import { TraceService } from "../../core/trace/service.js";
import { printJson } from "../formatters/json.js";
import { printTable } from "../formatters/table.js";
import { t } from "../i18n.js";
import { resolveWorkspaceOrExit, handleError } from "../util.js";

export function registerTraceCommands(program: Command): void {
  const trace = program
    .command("trace")
    .description(t("trace.command.description"));

  trace
    .command("start")
    .description(t("trace.start.description"))
    .requiredOption("--session <id>", t("trace.start.option.session"))
    .option("--workflow <id>", t("trace.start.option.workflow"))
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new TraceService(ws.storage);
        const item = await service.startTrace(opts.session, opts.workflow);

        if (opts.json) {
          printJson(item);
          return;
        }
        console.log(t("trace.start.success", { traceId: item.trace_id }));
        console.log(t("trace.start.session", { sessionId: item.session_id }));
        if (item.workflow_id) console.log(t("trace.start.workflow", { workflowId: item.workflow_id }));
      } catch (err) {
        handleError(err);
      }
    });

  trace
    .command("event <trace-id>")
    .description(t("trace.event.description"))
    .requiredOption("--type <type>", t("trace.event.option.type"))
    .option("--node <id>", t("trace.event.option.node"))
    .option("--payload <json>", t("trace.event.option.payload"), "{}")
    .option("--json", t("common.outputJson"))
    .action(async (traceId, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new TraceService(ws.storage);
        let payload: Record<string, unknown> = {};
        try { payload = JSON.parse(opts.payload); } catch { }

        const item = await service.appendEvent(traceId, {
          type: opts.type,
          node_id: opts.node,
          payload,
        });

        if (opts.json) {
          printJson(item);
          return;
        }
        console.log(t("trace.event.success", {
          traceId,
          eventType: opts.type,
          count: item.events.length,
        }));
      } catch (err) {
        handleError(err);
      }
    });

  trace
    .command("finalize <trace-id>")
    .description(t("trace.finalize.description"))
    .requiredOption("--status <s>", t("trace.finalize.option.status"))
    .option("--lesson <text>", t("trace.finalize.option.lesson"), collect, [])
    .option("--counterfactual <text>", t("trace.finalize.option.counterfactual"), collect, [])
    .option("--json", t("common.outputJson"))
    .action(async (traceId, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new TraceService(ws.storage);
        const item = await service.finalize(traceId, opts.status, {
          lessons: opts.lesson,
          counterfactuals: opts.counterfactual,
        });

        if (opts.json) {
          printJson(item);
          return;
        }
        console.log(t("trace.finalize.success", { traceId }));
        console.log(t("trace.finalize.status", { status: item.status }));
        console.log(t("trace.finalize.events", { count: item.events.length }));
        if (item.lessons.length > 0) console.log(t("trace.finalize.lessons", { count: item.lessons.length }));
        if (item.counterfactuals.length > 0) console.log(t("trace.finalize.counterfactuals", { count: item.counterfactuals.length }));
      } catch (err) {
        handleError(err);
      }
    });

  trace
    .command("list")
    .description(t("trace.list.description"))
    .option("--status <s>", t("trace.list.option.status"))
    .option("--limit <n>", t("trace.list.option.limit"), parseInt)
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new TraceService(ws.storage);
        const traces = await service.list({ status: opts.status, limit: opts.limit });

        if (opts.json) {
          printJson(traces);
          return;
        }
        if (traces.length === 0) {
          console.log(t("trace.list.none"));
          return;
        }

        printTable(
          [
            t("trace.list.header.traceId"),
            t("trace.list.header.session"),
            t("trace.list.header.status"),
            t("trace.list.header.events"),
            t("trace.list.header.lessons"),
          ],
          traces.map((item) => [
            item.trace_id,
            item.session_id,
            item.status,
            String(item.events.length),
            String(item.lessons.length),
          ]),
        );
        console.log(`\n${t("trace.list.total", { count: traces.length })}`);
      } catch (err) {
        handleError(err);
      }
    });

  trace
    .command("get <trace-id>")
    .description(t("trace.get.description"))
    .option("--summary", t("trace.get.option.summary"))
    .option("--json", t("common.outputJson"))
    .action(async (traceId, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new TraceService(ws.storage);
        const item = await service.get(traceId);
        if (!item) {
          console.error(`${t("common.errorPrefix")}: ${t("error.trace.notFound", { id: traceId })}`);
          process.exit(1);
        }

        if (opts.summary) {
          const summary = service.summarize(item);
          if (opts.json) {
            printJson(summary);
            return;
          }
          console.log(t("trace.get.summary.trace", { traceId: summary.trace_id }));
          console.log(t("trace.get.summary.statusEvents", {
            status: summary.status,
            count: summary.event_count,
          }));
          console.log(t("trace.get.summary.groups", {
            groups: Object.entries(summary.event_groups).map(([k, v]) => `${k}:${v}`).join(", "),
          }));
          if (summary.has_failures) console.log(t("trace.get.summary.containsFailures"));
          if (summary.has_falsifications) console.log(t("trace.get.summary.containsFalsifications"));
          if (summary.lessons_count > 0) console.log(t("trace.get.summary.lessons", { count: summary.lessons_count }));
          return;
        }

        if (opts.json) {
          printJson(item);
          return;
        }

        console.log(`${t("trace.get.detail.traceId")}:  ${item.trace_id}`);
        console.log(`${t("trace.get.detail.session")}:   ${item.session_id}`);
        if (item.workflow_id) console.log(`${t("trace.get.detail.workflow")}:  ${item.workflow_id}`);
        console.log(`${t("trace.get.detail.status")}:    ${item.status}`);
        console.log(`${t("trace.get.detail.events", { count: item.events.length })}:`);
        for (const event of item.events) {
          const node = event.node_id ? ` [${event.node_id}]` : "";
          console.log(`  ${event.ts} ${event.type}${node}`);
        }
        if (item.lessons.length > 0) {
          console.log(t("trace.get.detail.lessons"));
          for (const lesson of item.lessons) console.log(`  - ${lesson}`);
        }
        if (item.counterfactuals.length > 0) {
          console.log(t("trace.get.detail.counterfactuals"));
          for (const c of item.counterfactuals) console.log(`  - ${c}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  trace
    .command("falsified")
    .description(t("trace.falsified.description"))
    .option("--limit <n>", t("trace.falsified.option.limit"), parseInt)
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new TraceService(ws.storage);
        const items = await service.extractFalsifiedHypotheses({ limit: opts.limit });

        if (opts.json) {
          printJson(items);
          return;
        }
        if (items.length === 0) {
          console.log(t("trace.falsified.none"));
          return;
        }

        console.log(`${t("trace.falsified.heading", { count: items.length })}\n`);
        for (const h of items) {
          console.log(`  [${h.trace_id}] ${h.hypothesis}`);
          console.log(`    ${t("trace.falsified.evidence", { evidence: h.evidence })}`);
          console.log(`    ${t("trace.falsified.time", { time: h.ts })}\n`);
        }
      } catch (err) {
        handleError(err);
      }
    });
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
