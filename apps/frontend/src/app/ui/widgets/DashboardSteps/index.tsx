'use client';
import React, { useMemo } from 'react';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { useServicesForPrimaryOrgSpecialities } from '@/app/hooks/useSpecialities';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useSubscriptionForPrimaryOrg } from '@/app/hooks/useBilling';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';

type Step = {
  key: 'services' | 'team' | 'stripe';
  title: string;
  description: string;
  buttonSrc: string;
  buttonText: string;
  isCompleted: boolean;
  isVisible: boolean;
};

const DashboardSteps = () => {
  const primaryOrg = usePrimaryOrg();
  const subscription = useSubscriptionForPrimaryOrg();
  const services = useServicesForPrimaryOrgSpecialities();
  const teams = useTeamForPrimaryOrg();
  const { can } = usePermissions();

  const steps: Step[] = useMemo(() => {
    if (!primaryOrg || !subscription) return [];
    const hasServices = (services?.length ?? 0) > 0;
    const hasTeam = (teams?.length ?? 0) > 1;
    const hasStripeAccount = Boolean(subscription.connectAccountId);
    const stripeCompleted = Boolean(subscription.connectChargesEnabled);
    const canManageServices = can(PERMISSIONS.SPECIALITIES_EDIT_ANY);
    const canManageTeam = can(PERMISSIONS.TEAMS_EDIT_ANY);
    const canManageStripe = can({
      allOf: [PERMISSIONS.ORG_EDIT, PERMISSIONS.SUBSCRIPTION_EDIT_ANY],
    });

    let stripeButtonText = 'Connect Stripe';
    if (stripeCompleted) {
      stripeButtonText = 'Stripe connected';
    } else if (hasStripeAccount) {
      stripeButtonText = 'Continue setup';
    }

    const nextSteps: Step[] = [
      {
        key: 'services',
        title: 'Step 1 - Add services',
        description: 'Create services with price & duration that will be visible to parents',
        buttonSrc: '/organization/specialities',
        buttonText: hasServices ? 'View services' : 'Add services',
        isCompleted: hasServices,
        isVisible: canManageServices,
      },
      {
        key: 'team',
        title: 'Step 2 - Invite team',
        description: 'You can easily invite all your team members with just a few clicks',
        buttonSrc: '/organization',
        buttonText: hasTeam ? 'View team' : 'Invite team',
        isCompleted: hasTeam,
        isVisible: canManageTeam,
      },
      {
        key: 'stripe',
        title: 'Step 3 - Connect Stripe',
        description: 'Configure Stripe to ensure a seamless booking experience',
        buttonSrc: `/stripe-onboarding?orgId=${primaryOrg._id}`,
        buttonText: stripeButtonText,
        isCompleted: stripeCompleted,
        isVisible: canManageStripe,
      },
    ];
    return nextSteps.filter((step) => step.isVisible);
  }, [can, primaryOrg, services, teams, subscription]);

  const completedCount = useMemo(() => steps.filter((s) => s.isCompleted).length, [steps]);

  if (
    !primaryOrg ||
    !subscription ||
    !primaryOrg.isVerified ||
    steps.length === 0 ||
    completedCount === steps.length
  )
    return null;

  return (
    <PermissionGate
      anyOf={[
        PERMISSIONS.SPECIALITIES_EDIT_ANY,
        PERMISSIONS.TEAMS_EDIT_ANY,
        PERMISSIONS.SUBSCRIPTION_EDIT_ANY,
      ]}
    >
      <div className="flex flex-col gap-3">
        <div className="flex w-full items-center justify-between">
          <div className="text-body-1 text-text-primary">Get started</div>
          <div className="text-body-4 text-text-primary">
            {completedCount} of {steps.length} done
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step: Step) => (
            <div
              key={step.title}
              className={`flex flex-col items-center justify-between gap-3 p-3 rounded-2xl border border-card-border bg-white ${step.isCompleted && 'opacity-50'}`}
            >
              <div className="flex flex-col items-center">
                <div className="text-body-4 text-text-primary">{step.title}</div>
                <div className="text-caption-1 text-text-tertiary text-center">
                  {step.description}
                </div>
              </div>
              <Secondary
                href={step.buttonSrc}
                text={step.buttonText}
                isDisabled={step.isCompleted}
              />
            </div>
          ))}
        </div>
      </div>
    </PermissionGate>
  );
};

export default DashboardSteps;
