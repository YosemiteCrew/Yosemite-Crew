'use strict';

import type { ControlledSubstanceLogbook } from './controlled-substance';

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

const hashPin = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const chr = pin.codePointAt(i) ?? 0;
    hash = Math.trunc((hash << 5) - hash + chr);
  }
  return hash.toString(16);
};

export const createDualWitnessLog = (deps: DualWitnessDeps): DualWitnessLog => {
  const now = deps.now || (() => Date.now());
  const generateId = deps.generateId || defaultId;
  const witnesses = new Map<string, WitnessAccount>();

  const setWitnessPin = (witnessId: string, witnessName: string, pin: string): void => {
    witnesses.set(witnessId, {
      id: witnessId,
      name: witnessName,
      pinHash: hashPin(pin),
    });
  };

  const verifyWitnessPin = (witnessId: string, pin: string): boolean => {
    const account = witnesses.get(witnessId);
    if (!account) return false;
    return account.pinHash === hashPin(pin);
  };

  const recordWaste = (
    input: { witnessPin: string } & Omit<
      WasteEvent,
      'id' | 'timestamp' | 'csTransactionId' | 'witnessPinVerified'
    >
  ): WasteEvent => {
    const pinVerified = verifyWitnessPin(input.witnessId, input.witnessPin);
    if (!pinVerified) {
      // Reject before touching inventory: an unverified or missing witness must not
      // produce a controlled-substance waste transaction (which would decrement stock
      // and later read back via getWasteEvents() as a compliant, verified record).
      return {
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
        witnessPinVerified: false,
        reason: input.reason,
        csTransactionId: '',
      };
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

    const event: WasteEvent = {
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
      witnessPinVerified: pinVerified,
      reason: input.reason,
      csTransactionId: csTx.id,
    };

    return event;
  };

  const getWasteEvents = (drugName?: string): WasteEvent[] => {
    const txs = drugName ? deps.logbook.getByDrug(drugName) : deps.logbook.getTransactions();
    return txs
      .filter((tx) => tx.action === 'waste')
      .map((tx) => ({
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
      }));
  };

  const getWasteByWitness = (witnessId: string): WasteEvent[] => {
    const txs = deps.logbook.getTransactions();
    return txs
      .filter((tx) => tx.action === 'waste' && tx.witnessId === witnessId)
      .map((tx) => ({
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
      }));
  };

  return {
    recordWaste,
    verifyWitnessPin,
    getWasteEvents,
    getWasteByWitness,
    setWitnessPin,
  };
};
