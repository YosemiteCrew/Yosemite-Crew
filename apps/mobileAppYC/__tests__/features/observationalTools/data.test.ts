import {
  observationalToolDefinitions,
  observationalToolProviders,
} from '../../../src/features/observationalTools/data';

// --- Mocks ---

// We mock the Images object. We use a Proxy to return a predictable string
// for any image key accessed (e.g., Images.felineEarForward -> 'mock-felineEarForward')
jest.mock('@/assets/images', () => {
  return {
    Images: new Proxy(
      {},
      {
        get: (target, prop) => `mock-image-${String(prop)}`,
      },
    ),
  };
});

describe('Observational Tools Data', () => {
  describe('observationalToolDefinitions', () => {
    it('should contain all defined tool keys', () => {
      const keys = Object.keys(observationalToolDefinitions);
      expect(keys).toContain('feline-grimace-scale');
      expect(keys).toContain('canine-acute-pain-scale');
      expect(keys).toContain('equine-grimace-scale');
    });

    describe('Feline Grimace Scale (Has Images)', () => {
      const tool = observationalToolDefinitions['feline-grimace-scale'];

      it('should correctly map top-level tool properties', () => {
        expect(tool.name).toBe('Feline Grimace Scale');
        expect(tool.species).toBe('cat');
        // Verify the image key was resolved via the mock
        expect(tool.heroImage).toBe('mock-image-otFelineHero');
        expect(tool.overviewParagraphs.length).toBeGreaterThan(0);
      });

      it('should populate the default empty state', () => {
        expect(tool.emptyState).toEqual({
            title: 'Not just yet!',
            message: expect.stringContaining("medical team isn't handing out"),
            image: 'mock-image-otNoProviders',
        });
      });

      it('should map steps correctly', () => {
        // FGS has 5 steps defined in TOOL_SEEDS
        expect(tool.steps).toHaveLength(5);
        expect(tool.steps[0].id).toBe('fgs-ear-position');
        expect(tool.steps[0].title).toBe('Ear Position');
      });

      it('should map options with images correctly', () => {
        const earStep = tool.steps[0];
        // 'ears-forward' is the first option in this step
        const firstOption = earStep.options[0];

        expect(firstOption.id).toBe('ears-forward');
        expect(firstOption.title).toBe('Ears facing forward');
        // This option has an imageKey in OPTION_SEEDS
        expect(firstOption.image).toBe('mock-image-felineEarForward');
      });
    });

    describe('Canine Acute Pain Scale (Text Only)', () => {
      const tool = observationalToolDefinitions['canine-acute-pain-scale'];

      it('should correctly map top-level tool properties', () => {
        expect(tool.name).toBe('Canine Acute Pain Scale');
        expect(tool.species).toBe('dog');
        expect(tool.heroImage).toBe('mock-image-otCanineHero');
      });

      it('should map options without images correctly', () => {
        // 'caps-behaviour-rest' is the first step
        const restStep = tool.steps[0];
        // 'rest-comfortable' is the first option
        const firstOption = restStep.options[0];

        expect(firstOption.id).toBe('rest-comfortable');
        expect(firstOption.title).toBe('Comfortable, happy, relaxed');
        // This option does NOT have an imageKey in OPTION_SEEDS
        expect(firstOption.image).toBeUndefined();
      });
    });

    describe('Equine Grimace Scale', () => {
      const tool = observationalToolDefinitions['equine-grimace-scale'];

      it('should correctly map top-level tool properties', () => {
        expect(tool.name).toBe('Equine Grimace Scale');
        expect(tool.species).toBe('horse');
      });

      it('should map specific equine options', () => {
        // 'egs-ear-position' step
        const step = tool.steps[0];
        expect(step.title).toBe('Stiffly backwards ear');

        // 'ear-not-present' option
        const option = step.options[0];
        expect(option.title).toBe('Not present');
        expect(option.image).toBe('mock-image-equineEarNotPresent');
      });
    });
  });

  describe('observationalToolProviders', () => {
    it('should contain providers for feline-grimace-scale', () => {
      const providers = observationalToolProviders['feline-grimace-scale'];
      expect(providers).toHaveLength(2);
      expect(providers[0]).toEqual({
        businessId: 'biz_sfamc',
        employeeId: 'emp_brown',
        evaluationFee: 20,
        appointmentFee: 100,
      });
    });

    it('should contain providers for canine-acute-pain-scale', () => {
      const providers = observationalToolProviders['canine-acute-pain-scale'];
      expect(providers).toHaveLength(2);
      expect(providers[1].businessId).toBe('biz_pawpet');
    });

    it('should contain providers for equine-grimace-scale', () => {
      const providers = observationalToolProviders['equine-grimace-scale'];
      expect(providers).toHaveLength(2);
      expect(providers[0].evaluationFee).toBe(30);
    });
  });
});