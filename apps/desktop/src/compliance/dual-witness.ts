'use strict';

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { ControlledSubstanceLogbook, CsTransaction } from './controlled-substance';

export interface WasteEvent {
  id: string;
  timestamp: number;
  drugName: string;
  drugClass: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  veterinarianId: string;
  veterinarianName: string;
  witnessId: string;
  witnessName: string;
  witnessPinVerified: boolean;
  reason: string;
  csTransactionId: string;
}

export interface DualWitnessLog {
  recordWaste: (
    event: Omit<WasteEvent, 'id' | 'timestamp' | 'csTransactionId' | 'witnessPinVerified'> & {
      witnessPin: string;
    }
  ) => WasteEvent;
  verifyWitnessPin: (witnessId: string, pin: string) => boolean;
  getWasteEvents: (drugName?: string) => WasteEvent[];
  getWasteByWitness: (witnessId: string) => WasteEvent[];
  setWitnessPin: (witnessId: string, witnessName: string, pin: string) => void;
}

interface DualWitnessDeps {
  logbook: ControlledSubstanceLogbook;
  now?: () => number;
  generateId?: () => string;
}

interface WitnessAccount {
  id: string;
  name: string;
  pinHash: string;
}

let dwCounter = 0;
const defaultId = (): string => `waste-${Date.now()}-${++dwCounter}`;

// Salted scrypt hashing for witness PINs. The dual-witness check is a DEA
// control, so the stored value must not be brute-forceable or collidable (the
// previous 32-bit string hash was both). Stored as "<saltHex>:<hashHex>".
const PIN_KEYLEN = 32;
const makePinHash = (pin: string): string => {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pin, salt, PIN_KEYLEN).toString('hex')}`;
};
const verifyPinHash = (pin: string, stored: string): boolean => {
  const [saltHex = '', hashHex = ''] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), PIN_KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

// A persisted waste transaction read back from the controlled-substance logbook
// is, by definition, one that passed dual-witness verification at record time.
const txToWasteEvent = (tx: CsTransaction): WasteEvent => ({
  id: tx.id,
  timestamp: tx.timestamp,
  drugName: tx.drugName,
  drugClass: tx.drugClass,
  lotNumber: tx.lotNumber,
  quantity: tx.quantity,
  unit: tx.unit,
  veterinarianId: tx.veterinarianId,
  veterinarianName: tx.veterinarianName,
  witnessId: tx.witnessId || '',
  witnessName: tx.witnessName || '',
  witnessPinVerified: true,
  reason: tx.notes || '',
  csTransactionId: tx.id,
});

export const createDualWitnessLog = (deps: DualWitnessDeps): DualWitnessLog => {
  const now = deps.now || (() => Date.now());
  const generateId = deps.generateId || defaultId;
  const witnesses = new Map<string, WitnessAccount>();

  const setWitnessPin = (witnessId: string, witnessName: string, pin: string): void => {
    witnesses.set(witnessId, {
      id: witnessId,
      name: witnessName,
      pinHash: makePinHash(pin),
    });
  };

  const verifyWitnessPin = (witnessId: string, pin: string): boolean => {
    const account = witnesses.get(witnessId);
    if (!account) return false;
    return verifyPinHash(pin, account.pinHash);
  };

  const recordWaste = (
    input: { witnessPin: string } & Omit<
      WasteEvent,
      'id' | 'timestamp' | 'csTransactionId' | 'witnessPinVerified'
    >
  ): WasteEvent => {
    const pinVerified = verifyWitnessPin(input.witnessId, input.witnessPin);
    const buildEvent = (witnessPinVerified: boolean, csTransactionId: string): WasteEvent => ({
      id: generateId(),
      timestamp: now(),
      drugName: input.drugName,
      drugClass: input.drugClass,
      lotNumber: input.lotNumber,
      quantity: input.quantity,
      unit: input.unit,
      veterinarianId: input.veterinarianId,
      veterinarianName: input.veterinarianName,
      witnessId: input.witnessId,
      witnessName: input.witnessName,
      witnessPinVerified,
      reason: input.reason,
      csTransactionId,
    });

    if (!pinVerified) {
      // Reject before touching inventory: an unverified or missing witness must not
      // produce a controlled-substance waste transaction (which would decrement stock
      // and later read back via getWasteEvents() as a compliant, verified record).
      return buildEvent(false, '');
    }

    const csTx = deps.logbook.record({
      action: 'waste',
      drugName: input.drugName,
      drugClass: input.drugClass,
      lotNumber: input.lotNumber,
      quantity: input.quantity,
      unit: input.unit,
      veterinarianId: input.veterinarianId,
      veterinarianName: input.veterinarianName,
      witnessId: input.witnessId,
      witnessName: input.witnessName,
    });

    return buildEvent(pinVerified, csTx.id);
  };

  const getWasteEvents = (drugName?: string): WasteEvent[] => {
    const txs = drugName ? deps.logbook.getByDrug(drugName) : deps.logbook.getTransactions();
    return txs.filter((tx) => tx.action === 'waste').map(txToWasteEvent);
  };

  const getWasteByWitness = (witnessId: string): WasteEvent[] => {
    const txs = deps.logbook.getTransactions();
    return txs
      .filter((tx) => tx.action === 'waste' && tx.witnessId === witnessId)
      .map(txToWasteEvent);
  };

  return {
    recordWaste,
    verifyWitnessPin,
    getWasteEvents,
    getWasteByWitness,
    setWitnessPin,
  };
};
