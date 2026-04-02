// MoonOS Protocol Catalog — barrel export

// Shared
export { CURRENT_PROTOCOL_VERSION } from "./_shared/base.js";
export type { ProtocolSemver, ParsedSemver } from "./_shared/base.js";
export { parseSemver, compareSemver, NonEmptyString, IsoDateTimeString, UnitInterval, SemverString, Sha256Digest, BaseAssetFields } from "./_shared/base.js";
export { AssetLifecycleSchema, canTransition, assertTransition, LifecycleTransitionError } from "./_shared/lifecycle.js";
export type { AssetLifecycle } from "./_shared/lifecycle.js";
export { buildJsonSchemaDoc, extractRequiredFields } from "./_shared/json-schema.js";
export type { JsonSchemaDocument } from "./_shared/json-schema.js";

// Memory
export * from "./memory/index.js";

// Skill
export * from "./skill/index.js";

// Workflow
export * from "./workflow/index.js";

// Trace
export * from "./trace/index.js";

// Feedback
export * from "./feedback/index.js";

// Envelope
export * from "./envelope/index.js";

// Operations
export * from "./operations/index.js";

// Catalog
export { PROTOCOL_CATALOG, SUPPORTING_OBJECT_CATALOG, FULL_CATALOG, getCatalogEntry, getCatalogEntryIds } from "./catalog.js";
export type { ProtocolEntry } from "./catalog.js";
