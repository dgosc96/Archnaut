import { WORKSPACE_ID_PATTERN } from "./patterns.js";

export interface ParsedWorkspaceId {
  name: string;
  raw: string;
}

export function parseWorkspaceId(id: string): ParsedWorkspaceId | null {
  if (!WORKSPACE_ID_PATTERN.test(id)) {
    return null;
  }
  const name = id.slice(3);
  if (!name) {
    return null;
  }
  return { name, raw: id };
}
