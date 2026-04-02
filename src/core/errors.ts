export type MoonOSErrorCode =
  | "error.workspace.notFound"
  | "error.memory.notFound"
  | "error.memory.unknownReviewDecision"
  | "error.trace.notFound"
  | "error.report.notFound"
  | "error.storage.itemAlreadyExists"
  | "error.storage.itemNotFound"
  | "error.protocol.invalidSemver";

export class MoonOSError extends Error {
  constructor(
    public readonly code: MoonOSErrorCode,
    message: string,
    public readonly params: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "MoonOSError";
  }
}
