// Mock API transport.
//
// This module simulates a backend so the frontend can be developed and demoed
// end-to-end. It is the ONLY file that knows the data is fake:
//  - state lives in memory, seeded from mockData.js, persisted to localStorage
//    (key below) so demo edits survive a reload;
//  - every call is async with a small latency so loading states are real;
//  - RBAC is enforced HERE, not only in the UI — mirroring how the real
//    Spring Boot backend will reject unauthorized calls server-side;
//  - every mutation writes an immutable audit entry (who/what/old/new).
//
// Swapping to the real backend = replacing this file with an HTTP client
// (same function signatures), exactly like RegulaOne's src/lib/api.js.

import { buildSeed } from './mockData';
import { can } from '../lib/permissions';

const STORAGE_KEY = 'pp_mock_db_v1';
const LATENCY_MS = 250;

let db = null;

function load() {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      db = JSON.parse(raw);
      // Migration for databases seeded before the AI settings existed.
      if (!db.settings.ai) {
        db.settings.ai = { enabled: true, excludeSpecialCategories: true };
        persist();
      }
      return db;
    }
  } catch {
    // corrupted storage — fall through to reseed
  }
  db = buildSeed();
  persist();
  return db;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // storage full/unavailable — demo keeps working in memory
  }
}

export function resetMockDb() {
  db = buildSeed();
  persist();
}

const delay = (ms = LATENCY_MS) => new Promise((r) => setTimeout(r, ms));

/** Read-only access. Returns deep copies so pages can't mutate state directly. */
export async function apiGet(selector) {
  await delay();
  const data = selector(load());
  return structuredClone(data);
}

/**
 * Mutation with mandatory RBAC + audit.
 *  actor    — the signed-in user object (name, role, permissions[]) — RBAC uses
 *             their PrivacyPilot permission codes, not the platform role.
 *  action   — permission from ACTIONS that authorizes this mutation
 *  audit    — audit entry fields { action, entityType, entityId, entityLabel,
 *             oldValue, newValue } OR a function (result) => fields, so the
 *             entry can reference ids/diffs computed inside the mutator
 *  mutator  — (db) => result; mutates the db in place, returns the payload
 */
export async function apiMutate({ actor, action, audit, mutator }) {
  await delay();
  if (!actor || !can(actor, action)) {
    const err = new Error('FORBIDDEN');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const d = load();
  const result = mutator(d);
  const entry = typeof audit === 'function' ? audit(result) : audit;
  if (entry) {
    d.audit.unshift({
      id: `aud-${Date.now()}-${d.audit.length}`,
      at: new Date().toISOString(),
      actorName: actor.name,
      // Record the capacity they acted under: their most-privileged PrivacyPilot
      // code (e.g. PRIVACYPILOT_ADMIN), falling back to the platform role.
      actorRole: actor.primaryPermission ?? actor.role,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      ...entry,
    });
  }
  persist();
  return structuredClone(result ?? null);
}

/** Simple id generator for new records. */
export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
