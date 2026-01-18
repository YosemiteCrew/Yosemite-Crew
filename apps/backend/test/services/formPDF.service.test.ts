import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as fs from 'node:fs';
import { chromium } from 'playwright';
import {
  buildPdfViewModel,
  renderPdf,
  generateFormSubmissionPdf,
  PdfViewModel
} from '../../src/services/formPDF.service';
import { FormField } from '@yosemite-crew/types';

// ----------------------------------------------------------------------
// 1. MOCKS
// ----------------------------------------------------------------------
jest.mock('node:fs');
jest.mock('playwright');

const mockPage = {
  setContent: jest.fn(),
  pdf: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn(),
  close: jest.fn(),
};

// ----------------------------------------------------------------------
// 2. TEST SUITE
// ----------------------------------------------------------------------
describe('FormPDFService', () => {
  const mockDate = new Date('2023-01-01T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation for fs.readFileSync
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fs.readFileSync as any).mockReturnValue('<html>{{title}} {{submittedAt}} {{sections}}</html>');

    // Default mock implementation for playwright
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chromium.launch as any).mockResolvedValue(mockBrowser);

    // FIX: Cast the mock function itself to any to avoid 'never' inference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockBrowser.newPage as any).mockResolvedValue(mockPage);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockPage.pdf as any).mockResolvedValue(Buffer.from('mock-pdf-buffer'));
  });

  /* ========================================================================
   * VIEW MODEL & FORMATTING
   * ======================================================================*/
  describe('buildPdfViewModel (Value Formatting)', () => {
    it('should format simple primitives correctly', () => {
      const schema: FormField[] = [
        { id: 'f1', type: 'input', label: 'String', required: false, order: 1 },
        { id: 'f2', type: 'number', label: 'Number', required: false, order: 2 },
      ];
      const answers = { f1: 'Hello', f2: 123 };

      const vm = buildPdfViewModel({ title: 'Test', schema, answers, submittedAt: mockDate });

      expect(vm.sections[0].fields).toEqual([
        { label: 'String', value: 'Hello' },
        { label: 'Number', value: '123' },
      ]);
    });

    it('should format booleans as Yes/No', () => {
      // Cast to any to bypass strict 'ChoiceField' requirement for 'options'
      const schema: FormField[] = [
        { id: 'b1', type: 'boolean', label: 'Bool True', required: false, order: 1 },
        { id: 'b2', type: 'boolean', label: 'Bool False', required: false, order: 2 },
      ] as unknown as FormField[];

      const answers = { b1: true, b2: false };

      const vm = buildPdfViewModel({ title: 'Test', schema, answers, submittedAt: mockDate });

      expect(vm.sections[0].fields).toEqual([
        { label: 'Bool True', value: 'Yes' },
        { label: 'Bool False', value: 'No' },
      ]);
    });

    it('should format dates correctly', () => {
      const schema: FormField[] = [
        { id: 'd1', type: 'date', label: 'Date Obj', required: false, order: 1 },
        { id: 'd2', type: 'date', label: 'Date String', required: false, order: 2 },
        { id: 'd3', type: 'date', label: 'Invalid Date', required: false, order: 3 },
      ];
      const dateObj = new Date('2023-01-01');
      const answers = {
        d1: dateObj,
        d2: '2023-01-01',
        d3: 'not-a-date'
      };

      const vm = buildPdfViewModel({ title: 'Test', schema, answers, submittedAt: mockDate });

      expect(vm.sections[0].fields[0].value).toBe(dateObj.toLocaleDateString());
      expect(vm.sections[0].fields[1].value).toBe(new Date('2023-01-01').toLocaleDateString());
      expect(vm.sections[0].fields[2].value).toBe('not-a-date'); // Fallback to stringify
    });

    it('should format signature fields', () => {
      const schema: FormField[] = [
        { id: 's1', type: 'signature', label: 'Sign', required: false, order: 1 }
      ];
      const answers = { s1: 'some-signature-data' };
      const vm = buildPdfViewModel({ title: 'Test', schema, answers, submittedAt: mockDate });

      expect(vm.sections[0].fields[0].value).toBe('Signed electronically');
    });

    it('should handle arrays by joining values', () => {
      const schema: FormField[] = [
        { id: 'a1', type: 'input', label: 'Array', required: false, order: 1 }
      ];
      const answers = { a1: ['A', 'B', 'C'] };
      const vm = buildPdfViewModel({ title: 'Test', schema, answers, submittedAt: mockDate });

      expect(vm.sections[0].fields[0].value).toBe('A, B, C');
    });

    it('should handle null/undefined values', () => {
       const schema: FormField[] = [
        { id: 'n1', type: 'input', label: 'Null', required: false, order: 1 },
        { id: 'u1', type: 'input', label: 'Undefined', required: false, order: 2 }
       ];
       const answers = { n1: null, u1: undefined };
       const vm = buildPdfViewModel({ title: 'Test', schema, answers, submittedAt: mockDate });

       expect(vm.sections[0].fields[0].value).toBe('');
       expect(vm.sections[0].fields[1].value).toBe('');
    });
  });

  describe('stringifyValue Edge Cases', () => {
     // Helper to access private stringifyValue via a dummy field call
     const testStringify = (val: unknown) => {
        const schema: FormField[] = [{ id: 'x', type: 'input', label: 'X', required: false, order: 1 }];
        const vm = buildPdfViewModel({
            title: 'T', schema, answers: { x: val }, submittedAt: mockDate
        });
        return vm.sections[0].fields[0].value;
     };

     it('should handle BigInt', () => {
         expect(testStringify(BigInt(123))).toBe('123');
     });

     it('should handle Symbols', () => {
         expect(testStringify(Symbol('sym'))).toBe('Symbol(sym)');
     });

     it('should handle Functions', () => {
         expect(testStringify(() => {})).toBe('[function]');
     });

     it('should handle Objects via JSON.stringify', () => {
         expect(testStringify({ a: 1 })).toBe('{"a":1}');
     });

     it('should handle circular objects gracefully', () => {
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const circular: any = { a: 1 };
         circular.self = circular;
         expect(testStringify(circular)).toBe('[unserializable]');
     });

     it('should handle Date objects in default case', () => {
         // When field type is NOT 'date', but value IS a Date object
         const d = new Date('2023-01-01');
         expect(testStringify(d)).toBe(d.toISOString());
     });
  });

  /* ========================================================================
   * STRUCTURE & GROUPING
   * ======================================================================*/
  describe('buildPdfViewModel (Structure)', () => {
      it('should group fields correctly', () => {
          const schema: FormField[] = [
              { id: 'f1', type: 'input', label: 'F1', required: false, order: 1 },
              {
                  id: 'g1', type: 'group', label: 'Group 1', required: false, order: 2,
                  fields: [
                      { id: 'g1f1', type: 'input', label: 'G1F1', required: false, order: 1 }
                  ]
              },
              { id: 'f2', type: 'input', label: 'F2', required: false, order: 3 }
          ];
          const answers = { f1: 'v1', g1f1: 'gv1', f2: 'v2' };

          const vm = buildPdfViewModel({ title: 'Structure', schema, answers, submittedAt: mockDate });

          expect(vm.sections).toHaveLength(3);

          // Section 1: Default 'Details' for f1
          expect(vm.sections[0].title).toBe('Details');
          expect(vm.sections[0].fields).toHaveLength(1);
          expect(vm.sections[0].fields[0].label).toBe('F1');

          // Section 2: 'Group 1'
          expect(vm.sections[1].title).toBe('Group 1');
          expect(vm.sections[1].fields).toHaveLength(1);
          expect(vm.sections[1].fields[0].label).toBe('G1F1');

          // Section 3: Default 'Details' for f2 (new default section created after group closed)
          expect(vm.sections[2].title).toBe('Details');
          expect(vm.sections[2].fields).toHaveLength(1);
          expect(vm.sections[2].fields[0].label).toBe('F2');
      });
  });

  /* ========================================================================
   * RENDERING & PDF GENERATION
   * ======================================================================*/
  describe('renderPdf', () => {
      const mockVm: PdfViewModel = {
          title: 'Test Form',
          submittedAt: '2023-01-01',
          sections: [
              { title: 'S1', fields: [{ label: 'L1', value: 'V1' }] }
          ]
      };

      it('should launch browser, set content, and return pdf buffer', async () => {
          const result = await renderPdf(mockVm);

          expect(chromium.launch).toHaveBeenCalled();
          expect(mockBrowser.newPage).toHaveBeenCalled();
          expect(fs.readFileSync).toHaveBeenCalled();

          // Verify template replacement happened (implicitly by setContent call)
          expect(mockPage.setContent).toHaveBeenCalledWith(
              expect.stringContaining('<h2>S1</h2>'), // Check if section title rendered
              { waitUntil: 'load' }
          );
          expect(mockPage.setContent).toHaveBeenCalledWith(
              expect.stringContaining('V1'), // Check if value rendered
              { waitUntil: 'load' }
          );

          expect(mockPage.pdf).toHaveBeenCalledWith({
              format: 'A4',
              printBackground: true
          });
          expect(mockBrowser.close).toHaveBeenCalled();
          expect(result).toBeInstanceOf(Buffer);
      });
  });

  describe('generateFormSubmissionPdf', () => {
      it('should integrate buildPdfViewModel and renderPdf', async () => {
          const schema: FormField[] = [{ id: 'f1', type: 'input', label: 'L1', required: false, order: 1 }];
          const answers = { f1: 'V1' };

          const result = await generateFormSubmissionPdf({
              title: 'Integration Test',
              schema,
              answers,
              submittedAt: mockDate
          });

          expect(chromium.launch).toHaveBeenCalled();
          expect(result).toEqual(Buffer.from('mock-pdf-buffer'));
      });
  });
});