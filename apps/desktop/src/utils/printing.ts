'use strict';

import { randomBytes } from 'node:crypto';

export interface PrintJob {
  id: string;
  template: string;
  data: Record<string, unknown>;
  options?: PrintOptions;
}

export interface PrintOptions {
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'Letter' | 'Legal' | 'A4';
  margins?: { top: number; right: number; bottom: number; left: number };
  copies?: number;
  silent?: boolean;
}

export interface PdfOutput {
  path: string;
  size: number;
  pages: number;
}

export interface PdfGenerator {
  generatePdf: (html: string, outputPath: string, opts?: PrintOptions) => Promise<PdfOutput>;
}

export interface PrintService {
  queuePrint: (job: PrintJob) => string;
  cancelPrint: (jobId: string) => boolean;
  getPendingJobs: () => PrintJob[];
  getCompletedJobs: () => PrintJob[];
}

export interface LabelSpec {
  type: 'cage-card' | 'vaccine' | 'folder' | 'vial' | 'custom';
  width: number;
  height: number;
  unit: 'mm' | 'in';
  data: Record<string, string>;
  copies: number;
}

export interface LabelPrintResult {
  id: string;
  label: LabelSpec;
  success: boolean;
  error?: string;
}

export interface LabelPrintService {
  printLabels: (labels: LabelSpec[]) => Promise<LabelPrintResult[]>;
  getSupportedLabelTypes: () => string[];
  getStatus: () => { printerAvailable: boolean; printerName?: string };
}

interface PrintDeps {
  generateId?: () => string;
  now?: () => number;
}

let jobCounter = 0;
const defaultGenerateId = (): string => `print-${Date.now()}-${++jobCounter}`;

export const createPrintService = (_pdfGen: PdfGenerator, deps: PrintDeps = {}): PrintService => {
  const generateId = deps.generateId || defaultGenerateId;
  const pendingJobs: PrintJob[] = [];
  const completedJobs: PrintJob[] = [];

  const queuePrint = (job: PrintJob): string => {
    const id = job.id || generateId();
    pendingJobs.push({ ...job, id });
    return id;
  };

  const cancelPrint = (jobId: string): boolean => {
    const idx = pendingJobs.findIndex((j) => j.id === jobId);
    if (idx === -1) return false;
    pendingJobs.splice(idx, 1);
    return true;
  };

  const getPendingJobs = (): PrintJob[] => [...pendingJobs];

  const getCompletedJobs = (): PrintJob[] => [...completedJobs];

  return { queuePrint, cancelPrint, getPendingJobs, getCompletedJobs };
};

export const createLabelPrintService = (
  deps: { getPrinters?: () => string[] } = {}
): LabelPrintService => {
  const supportedLabelTypes = ['cage-card', 'vaccine', 'folder', 'vial'];
  let printerAvailable = false;
  let printerName: string | undefined;

  const updatePrinterStatus = (): void => {
    try {
      const printers = deps.getPrinters ? deps.getPrinters() : [];
      if (printers.length > 0) {
        printerAvailable = true;
        printerName = printers[0];
      }
    } catch {
      printerAvailable = false;
      printerName = undefined;
    }
  };

  updatePrinterStatus();

  const printLabels = async (labels: LabelSpec[]): Promise<LabelPrintResult[]> => {
    const results: LabelPrintResult[] = [];
    for (const label of labels) {
      // Cryptographically-random suffix (Math.random is flagged as weak crypto).
      const id = `label-${Date.now()}-${randomBytes(4).toString('hex')}`;
      results.push({
        id,
        label,
        success: true,
      });
    }
    return results;
  };

  const getSupportedLabelTypes = (): string[] => [...supportedLabelTypes];

  const getStatus = (): { printerAvailable: boolean; printerName?: string } => {
    updatePrinterStatus();
    return { printerAvailable, printerName };
  };

  return { printLabels, getSupportedLabelTypes, getStatus };
};
