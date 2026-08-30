export interface ShutdownResources {
  stopAccepting: () => Promise<unknown>;
  closeWorkers: () => Promise<unknown>;
  closeQueues: () => Promise<unknown>;
  closeRedis: () => Promise<unknown>;
  closeLogger: () => Promise<unknown>;
  closeSentry: () => Promise<unknown>;
  closeDatabase: () => Promise<unknown>;
}

export async function runShutdownSequence(resources: ShutdownResources) {
  const errors: unknown[] = [];
  for (const close of [
    resources.stopAccepting,
    resources.closeWorkers,
    resources.closeQueues,
    resources.closeRedis,
    resources.closeLogger,
    resources.closeSentry,
    resources.closeDatabase,
  ]) {
    try {
      await close();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, "One or more shutdown steps failed");
  }
}
