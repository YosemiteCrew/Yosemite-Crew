import { demoSpecialities } from "@/app/pages/Organization/demo";

describe("organization demo data", () => {
  it("includes demo specialities with services", () => {
    expect(demoSpecialities.length).toBeGreaterThan(0);
    const first = demoSpecialities[0];
    expect(first.name).toBeTruthy();
    const services = first.services ?? [];
    expect(services.length).toBeGreaterThan(0);
    expect(services[0]).toHaveProperty("name");
  });
});
