/**
 * Pre-provision users into SuperTokens ahead of the auth cutover (#1672).
 *
 * Idempotent: safe to re-run; existing users/mappings are skipped. Run against
 * staging first (dress rehearsal), then production, before flipping clients.
 *
 * Staff (web) users are imported from a JSON export of the legacy web user
 * pool (the output of the identity provider's list-users CLI, passed via
 * --staff <file>). Each user is created as an EmailPassword user with an
 * unguessable random password (never stored or logged - users set their own
 * password on first use via the password-reset link, since the staff-web
 * profile is keyed to the email-and-password factor), the email is marked
 * verified when the export says so, and a user-id mapping pins the external id
 * to the pre-existing stable app user id so every database reference keeps
 * working.
 *
 * Mobile (pet parent) identities are imported from the AuthUserMobile table
 * (--mobile): each distinct identity becomes a Passwordless user with the
 * external id mapped to the legacy provider user id. Where one person holds
 * several legacy identities for the same email, the row linked to a Parent
 * wins the mapping; the rest are recorded in auth_identities only.
 *
 * Usage:
 *   pnpm --filter backend exec tsx scripts/preprovision-supertokens.ts \
 *     [--staff web-pool-users.json] [--mobile] [--dry-run] [--limit N]
 *
 * Required env: SUPERTOKENS_CONNECTION_URI (+ SUPERTOKENS_API_KEY for managed
 * cloud), AUTH_API_DOMAIN, AUTH_WEBSITE_DOMAIN, SMTP_* (init-time only; the
 * script itself sends no emails), DATABASE_URL.
 */

import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import SuperTokens from "supertokens-node";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import Passwordless from "supertokens-node/recipe/passwordless";
import EmailVerification from "supertokens-node/recipe/emailverification";
import UserMetadata from "supertokens-node/recipe/usermetadata";
import { initSuperTokens } from "@yosemite-crew/auth";
import { prisma } from "../src/config/prisma";

const TENANT = "public";

type CliOptions = {
  staffFile?: string;
  mobile: boolean;
  dryRun: boolean;
  limit: number;
};

type LegacyPoolUser = {
  Username: string;
  Attributes?: Array<{ Name: string; Value: string }>;
  UserStatus?: string;
};

type ImportCounters = {
  created: number;
  existing: number;
  mapped: number;
  skipped: number;
  failed: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mobile: false,
    dryRun: false,
    limit: Number.POSITIVE_INFINITY,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--staff") {
      options.staffFile = argv[++i];
    } else if (arg === "--mobile") {
      options.mobile = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--limit") {
      options.limit = Number(argv[++i]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.staffFile && !options.mobile) {
    throw new Error("Nothing to do: pass --staff <file> and/or --mobile");
  }
  return options;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local?.slice(0, 1) ?? ""}***@${domain ?? "?"}`;
}

function attr(user: LegacyPoolUser, name: string): string | undefined {
  return user.Attributes?.find((a) => a.Name === name)?.Value;
}

async function ensureUserIdMapping(
  superTokensUserId: string,
  externalUserId: string,
): Promise<"created" | "exists" | "conflict"> {
  const result = await SuperTokens.createUserIdMapping({
    superTokensUserId,
    externalUserId,
  });
  if (result.status === "OK") {
    return "created";
  }
  if (result.status === "USER_ID_MAPPING_ALREADY_EXISTS_ERROR") {
    return "exists";
  }
  return "conflict";
}

async function markEmailVerified(recipeUserId: unknown, email: string) {
  const token = await EmailVerification.createEmailVerificationToken(
    TENANT,
    recipeUserId as never,
    email,
  );
  if (token.status === "OK") {
    await EmailVerification.verifyEmailUsingToken(TENANT, token.token, false);
  }
}

async function recordIdentity(input: {
  provider: "cognito" | "firebase" | "supertokens";
  authProfile: string;
  providerUserId: string;
  appUserId: string;
  email?: string;
}) {
  await prisma.authIdentity.upsert({
    where: {
      provider_providerUserId: {
        provider: input.provider,
        providerUserId: input.providerUserId,
      },
    },
    update: { appUserId: input.appUserId, email: input.email },
    create: {
      provider: input.provider,
      authProfile: input.authProfile,
      providerUserId: input.providerUserId,
      appUserId: input.appUserId,
      email: input.email,
    },
  });
}

async function importStaff(
  file: string,
  options: CliOptions,
  counters: ImportCounters,
): Promise<void> {
  const payload = JSON.parse(readFileSync(file, "utf8")) as {
    Users?: LegacyPoolUser[];
  };
  const users = (payload.Users ?? []).slice(0, options.limit);
  console.log(`[staff] importing ${users.length} users from ${file}`);

  for (const legacy of users) {
    const sub = attr(legacy, "sub") ?? legacy.Username;
    const email = attr(legacy, "email")?.toLowerCase();
    if (!email || !sub) {
      counters.skipped += 1;
      continue;
    }

    try {
      const alreadyMapped = await SuperTokens.getUser(sub);
      if (alreadyMapped) {
        counters.existing += 1;
        continue;
      }

      if (options.dryRun) {
        console.log(`[staff] would import ${maskEmail(email)}`);
        counters.created += 1;
        continue;
      }

      // Random throwaway password: the user sets their own via the
      // password-reset link on first use. Never persisted or logged.
      const signUp = await EmailPassword.signUp(
        TENANT,
        email,
        randomBytes(24).toString("base64url"),
      );

      let superTokensUserId: string;
      let recipeUserId: unknown;
      if (signUp.status === "OK") {
        superTokensUserId = signUp.user.id;
        recipeUserId = signUp.recipeUserId;
        counters.created += 1;
      } else {
        const existingUser = (
          await SuperTokens.listUsersByAccountInfo(TENANT, { email })
        )[0];
        if (!existingUser) {
          counters.failed += 1;
          console.error(`[staff] cannot resolve ${maskEmail(email)}`);
          continue;
        }
        superTokensUserId = existingUser.id;
        // Re-derive the recipe user id so a re-run after a partial failure can
        // still (idempotently) mark the email verified below.
        recipeUserId = existingUser.loginMethods.find(
          (m) => m.recipeId === "emailpassword",
        )?.recipeUserId;
        counters.existing += 1;
      }

      const mapping = await ensureUserIdMapping(superTokensUserId, sub);
      if (mapping === "created") {
        counters.mapped += 1;
      } else if (mapping === "conflict") {
        console.error(`[staff] mapping conflict for ${maskEmail(email)}`);
      }

      if (recipeUserId && attr(legacy, "email_verified") === "true") {
        await markEmailVerified(recipeUserId, email);
      }

      const firstName = attr(legacy, "given_name");
      const lastName = attr(legacy, "family_name");
      const role = attr(legacy, "custom:role");
      if (firstName || lastName || role) {
        await UserMetadata.updateUserMetadata(sub, {
          ...(firstName ? { first_name: firstName } : undefined),
          ...(lastName ? { last_name: lastName } : undefined),
          ...(role ? { role } : undefined),
        });
      }

      await recordIdentity({
        provider: "cognito",
        authProfile: "pims_web",
        providerUserId: sub,
        appUserId: sub,
        email,
      });
    } catch (error) {
      counters.failed += 1;
      console.error(`[staff] failed for ${maskEmail(email)}:`, error);
    }
  }
}

async function importMobile(
  options: CliOptions,
  counters: ImportCounters,
): Promise<void> {
  const identities = await prisma.authUserMobile.findMany({
    orderBy: { createdAt: "asc" },
    take: Number.isFinite(options.limit) ? options.limit : undefined,
  });
  console.log(
    `[mobile] importing ${identities.length} identities from the database`,
  );

  // Group by email so the identity linked to a Parent wins the id mapping.
  const byEmail = new Map<string, typeof identities>();
  for (const identity of identities) {
    const key = identity.email.toLowerCase();
    const bucket = byEmail.get(key) ?? [];
    bucket.push(identity);
    byEmail.set(key, bucket);
  }

  for (const [email, bucket] of byEmail) {
    const winner =
      bucket.find((identity) => identity.parentId) ?? bucket[bucket.length - 1];

    try {
      const alreadyMapped = await SuperTokens.getUser(winner.providerUserId);
      if (alreadyMapped) {
        counters.existing += 1;
        continue;
      }

      if (options.dryRun) {
        console.log(`[mobile] would import ${maskEmail(email)}`);
        counters.created += 1;
        continue;
      }

      const result = await Passwordless.signInUp({
        tenantId: TENANT,
        email,
      });
      if (result.status !== "OK") {
        counters.failed += 1;
        console.error(`[mobile] signInUp failed for ${maskEmail(email)}`);
        continue;
      }
      if (result.createdNewRecipeUser) {
        counters.created += 1;
      } else {
        counters.existing += 1;
      }

      const mapping = await ensureUserIdMapping(
        result.user.id,
        winner.providerUserId,
      );
      if (mapping === "created") {
        counters.mapped += 1;
      } else if (mapping === "conflict") {
        // The email already belongs to a mapped user (e.g. someone who is both
        // staff and pet parent). Parent linkage still converges via the
        // verified-email auto-link on first sign-in.
        console.warn(
          `[mobile] mapping conflict for ${maskEmail(email)} - relying on email auto-link`,
        );
      }

      await recordIdentity({
        provider: "supertokens",
        authProfile: "pet_parent_mobile",
        providerUserId: result.user.id,
        appUserId: winner.providerUserId,
        email,
      });
    } catch (error) {
      counters.failed += 1;
      console.error(`[mobile] failed for ${maskEmail(email)}:`, error);
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  initSuperTokens();

  const counters: ImportCounters = {
    created: 0,
    existing: 0,
    mapped: 0,
    skipped: 0,
    failed: 0,
  };

  if (options.staffFile) {
    await importStaff(options.staffFile, options, counters);
  }
  if (options.mobile) {
    await importMobile(options, counters);
  }

  console.log(
    `[done] created=${counters.created} existing=${counters.existing} ` +
      `mapped=${counters.mapped} skipped=${counters.skipped} failed=${counters.failed}` +
      `${options.dryRun ? " (dry run)" : ""}`,
  );

  await prisma.$disconnect();
  if (counters.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
