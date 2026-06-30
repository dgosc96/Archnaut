// Schema types
export type {
  PackageManager,
  WorkspaceKind,
  NodeKind,
  NodeStatus,
  NodeLayer,
  EdgeType,
  EdgeStatus,
  ConcernSeverity,
  ConcernStatus,
  ConcernSource,
  HookPolicy,
} from "./schema/enums.js";
export type { Project } from "./schema/project.js";
export type { Workspace } from "./schema/workspace.js";
export type { Node, NodeMetadata } from "./schema/node.js";
export type { Edge, EdgeMetadata } from "./schema/edge.js";
export type { Concern } from "./schema/concern.js";
export type { Meta, LayoutEntry } from "./schema/meta.js";
export {
  ARCHNAUT_FILE_VERSION,
  type ArchnautFileV1,
} from "./schema/archnaut-file.js";

// Validation
export type {
  ValidationIssue,
  ValidationIssueCode,
  ValidationResult,
} from "./validation/issues.js";
export { validationOk, validationFail, WARNING_CODES } from "./validation/issues.js";
export type { ValidationContext } from "./validation/validation-context.js";
export { validateArchnautFile } from "./validation/validate-archnaut-file.js";
export { validateNode, type NodeValidationResult } from "./validation/validate-node.js";
export { validateEdge } from "./validation/validate-edge.js";
export { validateWorkspace } from "./validation/validate-workspace.js";
export { validateConcern } from "./validation/validate-concern.js";
export { validateProject } from "./validation/validate-project.js";
export { validateMeta } from "./validation/validate-meta.js";

// Normalization
export { normalizeArchnautFile } from "./normalize/normalize-archnaut-file.js";
export { serializeArchnautFile } from "./normalize/serialize.js";
export { sortById, sortStringArray, dedupeSorted } from "./normalize/sort.js";

// IDs
export type { NodeIdPrefix, ParsedNodeId } from "./ids/parse-node-id.js";
export { parseNodeId } from "./ids/parse-node-id.js";
export type { ParsedWorkspaceId } from "./ids/parse-workspace-id.js";
export { parseWorkspaceId } from "./ids/parse-workspace-id.js";
export type { ParsedEdgeId } from "./ids/parse-edge-id.js";
export { parseEdgeId } from "./ids/parse-edge-id.js";
export type { GenerateNodeIdInput } from "./ids/generate-node-id.js";
export { generateNodeId } from "./ids/generate-node-id.js";
export { endpointSlug } from "./ids/endpoint-slug.js";
export { generateEdgeId } from "./ids/generate-edge-id.js";
export { generateWorkspaceId } from "./ids/generate-workspace-id.js";
export { generateConcernId } from "./ids/generate-concern-id.js";

// Repository
export {
  ArchnautFileNotFoundError,
  ArchnautParseError,
  ArchnautValidationError,
  ArchnautWriteError,
} from "./repository/errors.js";
export { DEFAULT_ARCHNAUT_FILENAME } from "./repository/paths.js";
export { loadArchnautFile, type LoadArchnautFileOptions } from "./repository/load.js";
export { saveArchnautFile, type SaveArchnautFileOptions } from "./repository/save.js";
export {
  createArchnautRepository,
  type ArchnautRepository,
  type ArchnautRepositoryOptions,
} from "./repository/archnaut-repository.js";

// DB projection
export { migrateDb, clearDb, clearNodesAndEdges } from "./db/migrate.js";
export { initDbFromFile } from "./db/init-from-file.js";
export { rebuildDbFromFile } from "./db/rebuild-from-file.js";
export { getArchitectureSnapshot } from "./db/queries.js";
export { nodeExists, workspaceExists } from "./db/mutations.js";

// Services
export {
  loadValidateNormalize,
  persistArchitecture,
  applyArchitectureMutation,
  readArchitectureSnapshot,
  applyUpsertNode,
  applyUpsertEdge,
  applyPatchNode,
  applyInsertConcern,
  type UpsertNodeInput,
  type UpsertEdgeInput,
  type PatchNodeInput,
  type InsertConcernInput,
} from "./services/architecture-pipeline.js";
