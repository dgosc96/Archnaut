/** Thrown when the SQLite projection has no project row (empty / uninitialized DB). */
export class EmptyArchitectureError extends Error {
  /** Signals that the runtime DB projection has not been hydrated yet. */
  constructor() {
    super("Database has no project row");
    this.name = "EmptyArchitectureError";
  }
}
