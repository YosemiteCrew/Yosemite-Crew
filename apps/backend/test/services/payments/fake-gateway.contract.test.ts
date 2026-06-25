import { FakeGateway, WebhookVerificationError } from "src/services/payments";
import type { NormalizedPaymentEvent } from "src/services/payments";

import {
  runPaymentProviderContract,
  type ProviderContractHarness,
} from "./provider-contract";

const harness: ProviderContractHarness = {
  providerLabel: "fake",
  makeGateway: () => new FakeGateway(),
  makeValidWebhook: (gateway) => {
    const fake = gateway as FakeGateway;
    const expected: NormalizedPaymentEvent = {
      providerEventRef: "evt_1",
      type: "PAYMENT_SUCCEEDED",
      invoiceRef: "inv_1",
      providerPaymentRef: "fake_pi_1",
      amount: { minorAmount: 1999, currency: "USD" },
    };
    const { rawBody, headers } = fake.buildSignedWebhook(expected);
    return { rawBody, headers, expected };
  },
  makeTamperedWebhook: (gateway) => {
    const fake = gateway as FakeGateway;
    const { rawBody } = fake.buildSignedWebhook({
      providerEventRef: "evt_2",
      type: "PAYMENT_FAILED",
    });
    return { rawBody, headers: { "x-fake-signature": "0".repeat(64) } };
  },
};

runPaymentProviderContract(harness);

describe("FakeGateway specifics", () => {
  it("honours an explicit provider id and webhook secret", () => {
    const gateway = new FakeGateway({
      provider: "STRIPE",
      webhookSecret: "s3cret",
    });
    expect(gateway.provider).toBe("STRIPE");
  });

  it("returns a null account ref before any account exists", async () => {
    const gateway = new FakeGateway();
    const status = await gateway.getAccountStatus("org_unknown");
    expect(status.accountRef).toBeNull();
    expect(status.onboardingState).toBe("NOT_STARTED");
    expect(status.chargesEnabled).toBe(false);
  });

  it("moves to in-progress when an onboarding link is created", async () => {
    const gateway = new FakeGateway();
    await gateway.createOnboardingLink("org_1");
    const status = await gateway.getAccountStatus("org_1");
    expect(status.onboardingState).toBe("IN_PROGRESS");
  });

  it("becomes ready once the account is marked ready", async () => {
    const gateway = new FakeGateway();
    await gateway.createOrGetConnectedAccount("org_1");
    gateway.markAccountReady("org_1");
    const status = await gateway.getAccountStatus("org_1");
    expect(status.onboardingState).toBe("READY");
    expect(status.chargesEnabled).toBe(true);
    expect(status.payoutsEnabled).toBe(true);
  });

  it("normalizes a batch of events from one signed payload", () => {
    const gateway = new FakeGateway();
    const { rawBody, headers } = gateway.buildSignedWebhook([
      { providerEventRef: "evt_a", type: "PAYMENT_SUCCEEDED" },
      { providerEventRef: "evt_b", type: "REFUND_SUCCEEDED" },
    ]);
    const events = gateway.verifyAndNormalizeWebhook(rawBody, headers);
    expect(events.map((event) => event.providerEventRef)).toEqual([
      "evt_a",
      "evt_b",
    ]);
  });

  it("rejects a webhook with a missing signature header", () => {
    const gateway = new FakeGateway();
    const { rawBody } = gateway.buildSignedWebhook({
      providerEventRef: "evt_c",
      type: "ACCOUNT_UPDATED",
    });
    expect(() => gateway.verifyAndNormalizeWebhook(rawBody, {})).toThrow(
      WebhookVerificationError,
    );
  });
});
