// Firebase removed - replaced with mock auth system for development
// OLD: initializeApp, getAuth, getFirestore were here

export const auth = {
  currentUser: null,
  signOut: async () => {},
};

export const db = {};
export const googleProvider = {};

// OLD: export enum OperationType — converted to Object.freeze for plain JS compatibility
export const OperationType = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST:   'list',
  GET:    'get',
  WRITE:  'write',
});

export function handleFirestoreError(
  error,
  operationType,
  path
) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Data error [${operationType}] at ${path}: ${message}`);
  throw new Error(message);
}
