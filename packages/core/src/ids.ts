import { v7 as uuidv7 } from 'uuid';
import { randomUUID } from 'node:crypto';

/** Time-ordered id for records, oplog-friendly (uuid v7 sorts by creation time). */
export function newRecordId(): string {
  return uuidv7();
}

export function newJobId(): string {
  return uuidv7();
}

export function newDeviceId(): string {
  return randomUUID();
}
