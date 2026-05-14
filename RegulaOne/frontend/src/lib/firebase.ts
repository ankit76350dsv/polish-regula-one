// Firebase removed - replaced with mock auth system for development
// OLD: initializeApp, getAuth, getFirestore were here

export const auth = {
  currentUser: null as null,
  signOut: async () => {},
};

export const db = {};
export const googleProvider = {};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Data error [${operationType}] at ${path}: ${message}`);
  throw new Error(message);
}
