import {
  planDesignations,
  type DesignationExtract,
  type Designation,
} from "src/scripts/import-venom-designations";

const extract = (
  designations: Array<[string, string, string, string]>,
): DesignationExtract => ({
  source: "VeNom",
  release: "g",
  released: "2024-01",
  designations,
});

const existing = (pairs: Array<[string, Designation[]]>) => new Map(pairs);

describe("planDesignations", () => {
  it("adds a translation to an existing concept rather than creating a new term", () => {
    // A translation must never become a separate concept, or a clinician would be
    // offered "Alopecia" and its Spanish label as two different things to pick.
    const plan = planDesignations(
      extract([["YC-1", "Anomalía de comportamiento", "es-ES", "name"]]),
      existing([
        [
          "YC-1",
          [
            {
              term: "Behavioural abnormality",
              lang: "en",
              source: "venom",
              preferred: true,
            },
          ],
        ],
      ]),
    );

    expect(plan.concepts).toHaveLength(1);
    expect(plan.concepts[0].designations).toEqual([
      {
        term: "Behavioural abnormality",
        lang: "en",
        source: "venom",
        preferred: true,
      },
      {
        term: "Anomalía de comportamiento",
        lang: "es-ES",
        source: "venom",
        preferred: false,
      },
    ]);
  });

  it("never marks a translation preferred", () => {
    // The preferred designation decides what the UI shows by default. A translation
    // taking that slot would silently change the displayed term.
    const plan = planDesignations(
      extract([["YC-1", "Sangrado", "es-ES", "name"]]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts[0].designations.every((d) => !d.preferred)).toBe(true);
  });

  it("keeps the designations a concept already had", () => {
    const plan = planDesignations(
      extract([["YC-1", "Alopecia", "pt-BR", "name"]]),
      existing([
        [
          "YC-1",
          [
            {
              term: "Hair loss",
              lang: "en",
              source: "local",
              preferred: false,
            },
          ],
        ],
      ]),
    );

    expect(plan.concepts[0].designations).toContainEqual({
      term: "Hair loss",
      lang: "en",
      source: "local",
      preferred: false,
    });
  });

  it("does not add a designation the concept already carries", () => {
    const plan = planDesignations(
      extract([["YC-1", "Alopecia", "es-ES", "name"]]),
      existing([
        [
          "YC-1",
          [
            {
              term: "Alopecia",
              lang: "es-ES",
              source: "venom",
              preferred: false,
            },
          ],
        ],
      ]),
    );

    expect(plan.concepts).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/already present/);
  });

  it("treats the same word in another language as a different designation", () => {
    // "Alopecia" is its own translation in Spanish. That is a real designation, not a
    // duplicate, and dropping it would leave the Spanish label missing.
    const plan = planDesignations(
      extract([["YC-1", "Alopecia", "es-ES", "name"]]),
      existing([
        [
          "YC-1",
          [{ term: "Alopecia", lang: "en", source: "venom", preferred: true }],
        ],
      ]),
    );

    expect(plan.concepts[0].added).toBe(1);
  });

  it("collapses a duplicate appearing twice in the file", () => {
    const plan = planDesignations(
      extract([
        ["YC-1", "Sangrado", "es-ES", "name"],
        ["YC-1", "Sangrado", "es-ES", "name"],
      ]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts[0].added).toBe(1);
    expect(plan.skipped[0].reason).toMatch(/already present/);
  });

  it("skips a translation for a concept we do not hold", () => {
    const plan = planDesignations(
      extract([["YC-nope", "Sangrado", "es-ES", "name"]]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/concept not found/);
  });

  it("skips an empty term or language", () => {
    const plan = planDesignations(
      extract([
        ["YC-1", "   ", "es-ES", "name"],
        ["YC-1", "Sangrado", "  ", "name"],
      ]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts).toHaveLength(0);
    expect(plan.skipped).toHaveLength(2);
  });

  it("carries a synonym in the same language, not only translations", () => {
    // VeNom's file also holds two en-GB synonyms. They are designations too.
    const plan = planDesignations(
      extract([["YC-1", "German shepherd dog", "en-GB", "synonym"]]),
      existing([["YC-1", []]]),
    );

    expect(plan.concepts[0].designations[0]).toMatchObject({
      term: "German shepherd dog",
      lang: "en-GB",
    });
  });

  it("reports nothing to do when every translation is already present", () => {
    const plan = planDesignations(
      extract([["YC-1", "Sangrado", "es-ES", "name"]]),
      existing([
        [
          "YC-1",
          [
            {
              term: "sangrado",
              lang: "ES-es",
              source: "venom",
              preferred: false,
            },
          ],
        ],
      ]),
    );

    // Case and locale casing must not create a second copy of the same designation.
    expect(plan.concepts).toHaveLength(0);
  });
});
