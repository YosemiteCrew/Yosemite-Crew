jest.mock("src/config/prisma", () => ({
  prisma: {
    patient: { findMany: jest.fn(), updateMany: jest.fn() },
    codeEntry: { findMany: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

import { prisma } from "src/config/prisma";
import { main, planBackfill } from "src/scripts/backfill-breed-codes";

const patientFind = (prisma as unknown as { patient: { findMany: jest.Mock } })
  .patient.findMany;
const codeFind = (prisma as unknown as { codeEntry: { findMany: jest.Mock } })
  .codeEntry.findMany;

beforeEach(() => jest.clearAllMocks());

describe("planBackfill", () => {
  it("scopes the lookup to the companion's own species", async () => {
    // The trap this exists for. `Abyssinian` is a cat breed AND a horse breed;
    // `Maltese` is a dog AND a cat. Matching on display alone would have coded an
    // Abyssinian cat as a horse and then handed it equine guidance.
    patientFind.mockResolvedValue([
      { id: "p1", breed: "Abyssinian", type: "cat" },
    ]);
    codeFind.mockResolvedValue([
      { code: "YBREED:FELINE:ABYSSINIAN", display: "Abyssinian" },
    ]);

    const [outcome] = await planBackfill();

    expect(codeFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          code: { startsWith: "YBREED:FELINE:" },
          display: { in: ["Abyssinian"], mode: "insensitive" },
        }),
      }),
    );
    expect(outcome.resolved).toBe("YBREED:FELINE:ABYSSINIAN");
  });

  it("collapses the two spellings of one breed instead of calling it a conflict", async () => {
    patientFind.mockResolvedValue([
      { id: "p1", breed: "American Curl", type: "cat" },
    ]);
    codeFind.mockResolvedValue([
      { code: "YBREED:FELINE:AMERICAN_CURL", display: "American Curl" },
      { code: "YBREED:FELINE:AMERICAN-CURL", display: "American Curl" },
    ]);

    const [outcome] = await planBackfill();

    expect(outcome.resolved).toBe("YBREED:FELINE:AMERICAN_CURL");
  });

  it("skips rather than guesses when two genuinely different codes remain", async () => {
    // A wrong code is worse than a missing one: a missing code shows no
    // recommendations, a wrong one shows confident recommendations for the
    // wrong animal.
    patientFind.mockResolvedValue([
      { id: "p1", breed: "Maltese", type: "dog" },
    ]);
    codeFind.mockResolvedValue([
      { code: "YBREED:CANINE:MALTESE", display: "Maltese" },
      { code: "YBREED:CANINE:MALTESE_CANINE", display: "Maltese" },
    ]);

    const [outcome] = await planBackfill();

    expect(outcome.resolved).toBeNull();
    expect(outcome.reason).toMatch(/ambiguous/);
  });

  it("skips a species with no breed vocabulary", async () => {
    patientFind.mockResolvedValue([
      { id: "p1", breed: "Something", type: "other" },
    ]);

    const [outcome] = await planBackfill();

    expect(outcome.resolved).toBeNull();
    expect(outcome.reason).toMatch(/no breed vocabulary/);
    expect(codeFind).not.toHaveBeenCalled();
  });

  it("skips a companion with no breed text", async () => {
    patientFind.mockResolvedValue([{ id: "p1", breed: "   ", type: "dog" }]);

    const [outcome] = await planBackfill();

    expect(outcome.resolved).toBeNull();
    expect(outcome.reason).toMatch(/no breed text/);
  });

  it("reports a breed the vocabulary does not hold for that species", async () => {
    patientFind.mockResolvedValue([
      { id: "p1", breed: "Nonesuch", type: "dog" },
    ]);
    codeFind.mockResolvedValue([]);

    const [outcome] = await planBackfill();

    expect(outcome.resolved).toBeNull();
    expect(outcome.reason).toMatch(/no vocabulary entry/);
  });

  it("only considers companions that have no code yet", async () => {
    patientFind.mockResolvedValue([]);
    await planBackfill();
    expect(patientFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { breedCode: null } }),
    );
  });
});

describe("planBackfill query volume", () => {
  it("asks the vocabulary once per species, not once per companion", async () => {
    // Every lookup asks the same species-scoped question, so one round trip per
    // companion bought no new information.
    patientFind.mockResolvedValue([
      { id: "p1", breed: "Pug", type: "dog" },
      { id: "p2", breed: "Beagle", type: "dog" },
      { id: "p3", breed: "Boxer", type: "dog" },
      { id: "p4", breed: "Abyssinian", type: "cat" },
    ]);
    codeFind.mockResolvedValue([]);

    await planBackfill();

    // Two species present, so two queries - not four.
    expect(codeFind).toHaveBeenCalledTimes(2);
  });
});

describe("main", () => {
  const patientUpdateMany = (
    prisma as unknown as { patient: { updateMany: jest.Mock } }
  ).patient.updateMany;

  let log: jest.SpyInstance;
  let argv: string[];

  beforeEach(() => {
    argv = process.argv;
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    patientFind.mockResolvedValue([{ id: "p1", breed: "Pug", type: "dog" }]);
    codeFind.mockResolvedValue([{ code: "YBREED:CANINE:PUG", display: "Pug" }]);
    patientUpdateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    process.argv = argv;
    log.mockRestore();
  });

  const output = () => log.mock.calls.map((c) => String(c[0])).join("\n");

  it("writes nothing without --apply", async () => {
    process.argv = ["node", "backfill-breed-codes.ts"];
    await main();

    expect(patientUpdateMany).not.toHaveBeenCalled();
    expect(output()).toMatch(/dry run/);
  });

  it("writes only when --apply is passed, and only while the row is still uncoded", async () => {
    process.argv = ["node", "backfill-breed-codes.ts", "--apply"];
    await main();

    // updateMany with breedCode: null in the where, not update by id. A parent
    // editing their companion between the plan and the write would otherwise
    // have their new breed overwritten by a stale planned value.
    expect(patientUpdateMany).toHaveBeenCalledWith({
      where: { id: "p1", breedCode: null },
      data: {
        speciesCode: "YSPEC:CANINE",
        breedCode: "YBREED:CANINE:PUG",
      },
    });
    expect(output()).toMatch(/wrote 1 companions/);
  });

  it("reports a row that someone else coded while it was running", async () => {
    process.argv = ["node", "backfill-breed-codes.ts", "--apply"];
    patientUpdateMany.mockResolvedValue({ count: 0 });

    await main();

    expect(output()).toMatch(/wrote 0 companions/);
    expect(output()).toMatch(/coded by someone else/);
  });

  it("names every skipped companion and why", async () => {
    process.argv = ["node", "backfill-breed-codes.ts"];
    patientFind.mockResolvedValue([
      { id: "p1", breed: "Nonesuch", type: "dog" },
    ]);
    codeFind.mockResolvedValue([]);

    await main();

    expect(output()).toMatch(/SKIP dog "Nonesuch"/);
    expect(output()).toMatch(/no vocabulary entry/);
  });
});
