import {
  createPrintService,
  createLabelPrintService,
  PdfGenerator,
  PrintJob,
  LabelSpec,
} from '../src/utils/printing';

describe('createPrintService', () => {
  const mockPdfGen: PdfGenerator = {
    generatePdf: jest.fn().mockResolvedValue({ path: '/tmp/test.pdf', size: 100, pages: 1 }),
  };

  let idCounter = 0;

  const makeDeps = () => ({
    generateId: jest.fn(() => `job-${++idCounter}`),
    now: jest.fn(() => 1000),
  });

  beforeEach(() => {
    idCounter = 0;
    jest.clearAllMocks();
  });

  test('queuePrint adds a job and returns its id', () => {
    const svc = createPrintService(mockPdfGen, makeDeps());
    const job: PrintJob = {
      id: '',
      template: '{{name}}',
      data: { name: 'Buddy' },
    };
    const id = svc.queuePrint(job);
    expect(id).toBe('job-1');
    expect(svc.getPendingJobs()).toHaveLength(1);
  });

  test('cancelPrint removes a pending job', () => {
    const svc = createPrintService(mockPdfGen, makeDeps());
    const id = svc.queuePrint({ id: '', template: 'test', data: {} });
    expect(svc.cancelPrint(id)).toBe(true);
    expect(svc.getPendingJobs()).toHaveLength(0);
  });

  test('cancelPrint returns false for unknown job', () => {
    const svc = createPrintService(mockPdfGen, makeDeps());
    expect(svc.cancelPrint('nonexistent')).toBe(false);
  });

  test('getPendingJobs returns copy of pending jobs', () => {
    const svc = createPrintService(mockPdfGen, makeDeps());
    svc.queuePrint({ id: 'a', template: 't1', data: {} });
    svc.queuePrint({ id: 'b', template: 't2', data: {} });
    expect(svc.getPendingJobs()).toHaveLength(2);
    // verify it's a copy
    svc.getPendingJobs().pop();
    expect(svc.getPendingJobs()).toHaveLength(2);
  });

  test('createPrintService return type has correct methods', () => {
    const svc = createPrintService(mockPdfGen, makeDeps());
    expect(typeof svc.queuePrint).toBe('function');
    expect(typeof svc.cancelPrint).toBe('function');
    expect(typeof svc.getPendingJobs).toBe('function');
    expect(typeof svc.getCompletedJobs).toBe('function');
  });
});

describe('createLabelPrintService', () => {
  test('printLabels returns results for each label', async () => {
    const svc = createLabelPrintService();
    const labels: LabelSpec[] = [
      {
        type: 'cage-card',
        width: 50,
        height: 30,
        unit: 'mm',
        data: { patient: 'Buddy', room: '101' },
        copies: 1,
      },
      {
        type: 'vaccine',
        width: 50,
        height: 20,
        unit: 'mm',
        data: { vaccine: 'Rabies', lot: 'LOT-001' },
        copies: 2,
      },
    ];

    const results = await svc.printLabels(labels);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].label.type).toBe('cage-card');
  });

  test('getSupportedLabelTypes returns supported types', () => {
    const svc = createLabelPrintService();
    const types = svc.getSupportedLabelTypes();
    expect(types).toContain('cage-card');
    expect(types).toContain('vaccine');
    expect(types).toContain('folder');
    expect(types).toContain('vial');
  });

  test('getStatus returns printer availability', () => {
    const svc = createLabelPrintService({
      getPrinters: () => ['Zebra_Label_Printer'],
    });
    const status = svc.getStatus();
    expect(status.printerAvailable).toBe(true);
    expect(status.printerName).toBe('Zebra_Label_Printer');
  });

  test('getStatus returns unavailable when no printers', () => {
    const svc = createLabelPrintService({ getPrinters: () => [] });
    const status = svc.getStatus();
    expect(status.printerAvailable).toBe(false);
  });
});
