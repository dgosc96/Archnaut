import { readArchitectureSnapshot, type ArchnautFileV1 } from "@archnaut/core";

import type { Store } from "../store.js";

export type SnapshotResult = ArchnautFileV1 | { isError: true; message: string };

const EMPTY_ARCHITECTURE_ERROR = "Database has no project row";

/**
 * Read the architecture snapshot, mapping empty DB to a user-facing error.
 *
 * @param store - Runtime store for SQLite projection access.
 * @returns Architecture file or structured error for MCP tools.
 */
export async function tryGetSnapshot(store: Store): Promise<SnapshotResult> {
  try {
    return await readArchitectureSnapshot(store.getDb());
  } catch (error) {
    if (error instanceof Error && error.message === EMPTY_ARCHITECTURE_ERROR) {
      return {
        isError: true,
        message:
          "Architecture is empty. Run the scan skill in your AI tool to populate it.",
      };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      message: `Failed to read architecture snapshot: ${detail}`,
    };
  }
}

/**
 * MCP tool error response with plain-text content.
 *
 * @param message - Error text returned to the agent.
 * @returns MCP content block marked as error.
 */
export function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

/**
 * MCP tool success response with JSON-serialized content.
 *
 * @param data - Payload to stringify as tool output.
 * @returns MCP content block with formatted JSON text.
 */
export function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}
