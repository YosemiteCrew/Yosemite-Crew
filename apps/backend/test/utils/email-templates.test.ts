import {
  emailTemplates,
  renderEmailTemplate,
  renderOrganisationInviteTemplate,
  renderPetParentOrganisationInviteEmail,
  OrganisationInviteTemplateData,
  PetParentOrganisationInviteData,
  AppointmentAssignedTemplateData,
  TaskAssignedTemplateData,
  TaskReminderTemplateData,
  SpecialityHeadAssignedTemplateData,
  FreePlanLimitReachedTemplateData,
  PermissionsUpdatedTemplateData,
  EmailTemplateId,
} from '../../src/utils/email-templates';

describe('Email Templates Utils', () => {
  // We use a fixed date for consistent testing
  const fixedDate = new Date('2025-01-01T12:00:00Z');
  const fixedDateString = fixedDate.toUTCString();

  describe('Global Helpers (Implicitly tested via templates)', () => {
    // The `formatDate` and `renderBaseEmail` functions are not exported,
    // so we test them via the templates that use them.

    it('should format Date objects correctly', () => {
      const result = renderOrganisationInviteTemplate({
        organisationName: 'Org',
        acceptUrl: 'http://accept',
        expiresAt: fixedDate, // Pass Date object
      });
      expect(result.textBody).toContain(fixedDateString);
    });

    it('should format string dates correctly', () => {
      const result = renderOrganisationInviteTemplate({
        organisationName: 'Org',
        acceptUrl: 'http://accept',
        expiresAt: '2025-01-01T12:00:00Z', // Pass string
      });
      // The internal logic creates a new Date(string), so it might match local or UTC depending on env,
      // but essentially we check it produces a valid string that isn't the raw input.
      expect(result.textBody).toContain('2025');
    });
  });

  describe('Templates', () => {

    describe('organisationInvite', () => {
      it('should render with FULL data (custom names, decline URL, custom support)', () => {
        const data: OrganisationInviteTemplateData = {
          organisationName: ' My Org ',
          inviteeName: ' John ',
          inviterName: ' Jane ',
          acceptUrl: 'http://accept',
          declineUrl: 'http://decline',
          expiresAt: fixedDate,
          supportEmail: 'help@org.com',
        };

        const result = emailTemplates.organisationInvite(data);

        // Subject
        expect(result.subject).toBe('You’re invited to join My Org on Yosemite Crew');
        // HTML Body
        expect(result.htmlBody).toContain('Hi John,');
        expect(result.htmlBody).toContain('Jane</strong> invited you');
        expect(result.htmlBody).toContain('href="http://decline"'); // Decline button present
        expect(result.htmlBody).toContain('href="mailto:help@org.com"');
        // Text Body
        expect(result.textBody).toContain('Decline: http://decline');
      });

      it('should render with MINIMAL data (defaults, no decline URL)', () => {
        const data: OrganisationInviteTemplateData = {
          organisationName: 'My Org',
          acceptUrl: 'http://accept',
          expiresAt: fixedDate,
          // Missing optional fields
        };

        const result = emailTemplates.organisationInvite(data);

        expect(result.htmlBody).toContain('Hi there,'); // Default invitee
        expect(result.htmlBody).toContain('a team member</strong> invited you'); // Default inviter
        expect(result.htmlBody).not.toContain('Decline Invitation'); // No decline button
        expect(result.textBody).not.toContain('Decline:');
        expect(result.htmlBody).toContain('support@yosemitecrew.com'); // Default support
      });
    });

    describe('petParentOrganisationInvite', () => {
      it('should render with FULL data', () => {
        const data: PetParentOrganisationInviteData = {
          organisationName: 'Vet Clinic',
          petParentName: 'Alice',
          acceptUrl: 'http://join',
          expiresAt: fixedDate,
          supportEmail: 'custom@support.com',
        };

        const result = renderPetParentOrganisationInviteEmail(data); // Testing the alias export

        expect(result.subject).toBe('Alice invited you to join Yosemite Crew PMS');
        expect(result.htmlBody).toContain('Alice</strong>');
        expect(result.htmlBody).toContain('Vet Clinic</strong>');
        expect(result.textBody).toContain('custom@support.com');
      });

      it('should render with MINIMAL data', () => {
        const data: PetParentOrganisationInviteData = {
          organisationName: 'Vet Clinic',
          petParentName: 'Alice',
          acceptUrl: 'http://join',
          expiresAt: fixedDate,
        };

        const result = emailTemplates.petParentOrganisationInvite(data);

        expect(result.textBody).toContain('support@yosemitecrew.com'); // Default fallback
      });
    });

    describe('appointmentAssigned', () => {
      it('should render with FULL data (Specific Type, Location, CTA Label)', () => {
        const data: AppointmentAssignedTemplateData = {
          employeeName: 'Dr. Smith',
          companionName: 'Rex',
          appointmentType: 'Surgery',
          appointmentTime: 'Tomorrow 10am',
          organisationName: 'Happy Paws',
          locationName: 'Room 1',
          appointmentUrl: 'http://view-appt',
          ctaLabel: 'Check In',
          supportEmail: 'admin@happypaws.com'
        };

        const result = emailTemplates.appointmentAssigned(data);

        expect(result.subject).toBe('New appointment assigned at Happy Paws');
        expect(result.htmlBody).toContain('Surgery for Rex');
        expect(result.htmlBody).toContain('Where:</strong> Room 1');
        expect(result.htmlBody).toContain('Check In');
        expect(result.htmlBody).toContain('href="http://view-appt"');
      });

      it('should render with MINIMAL data (Generic Type, Defaults, Fallback CTA)', () => {
        const data: AppointmentAssignedTemplateData = {
          companionName: 'Rex',
          appointmentTime: 'Tomorrow 10am',
          ctaUrl: 'http://fallback-url' // Used if appointmentUrl missing
        };

        const result = emailTemplates.appointmentAssigned(data);

        expect(result.subject).toBe('New appointment assigned at Yosemite Crew'); // Default Org
        expect(result.htmlBody).toContain('Hi there,'); // Default Name
        expect(result.htmlBody).toContain('Appointment for Rex'); // Generic type
        expect(result.htmlBody).not.toContain('Where:'); // No location
        expect(result.htmlBody).toContain('View Appointment'); // Default label
        expect(result.htmlBody).toContain('href="http://fallback-url"');
      });

      it('should render with NO CTA if no URLs provided', () => {
        const data: AppointmentAssignedTemplateData = {
          companionName: 'Rex',
          appointmentTime: '10am',
        };
        const result = emailTemplates.appointmentAssigned(data);
        expect(result.htmlBody).not.toContain('bgcolor="#2563eb"'); // No button
      });
    });

    describe('taskAssigned', () => {
      it('should render with FULL data (Companion, Notes, Custom Assigner)', () => {
        const data: TaskAssignedTemplateData = {
          employeeName: 'Nurse Joy',
          taskName: 'Give Meds',
          companionName: 'Pikachu',
          dueTime: 'NOW',
          assignedByName: 'Dr. Oak',
          taskUrl: 'http://task',
          additionalNotes: 'Be careful',
        };

        const result = emailTemplates.taskAssigned(data);

        expect(result.subject).toBe('New task assigned: Give Meds');
        expect(result.htmlBody).toContain('Dr. Oak</strong> assigned you');
        expect(result.htmlBody).toContain('Companion:</strong> Pikachu');
        expect(result.htmlBody).toContain('Notes:</strong> Be careful');
        expect(result.textBody).toContain('Notes: Be careful');
      });

      it('should render with MINIMAL data (Defaults)', () => {
        const data: TaskAssignedTemplateData = {
          taskName: 'Clean up',
          dueTime: 'Later',
          ctaUrl: 'http://cta'
        };

        const result = emailTemplates.taskAssigned(data);

        expect(result.htmlBody).toContain('a team member</strong> assigned you');
        expect(result.htmlBody).not.toContain('Companion:');
        expect(result.htmlBody).not.toContain('Notes:');
        expect(result.htmlBody).toContain('View Task'); // Default label
      });

      it('should render with NO CTA', () => {
          const data = { taskName: 'T', dueTime: 'N' };
          const result = emailTemplates.taskAssigned(data);
          expect(result.htmlBody).not.toContain('class="button"'); // Check abstractly for button
          expect(result.textBody).not.toContain('http');
      });
    });

    describe('taskReminder', () => {
      it('should render with FULL data', () => {
        const data: TaskReminderTemplateData = {
          employeeName: 'Joy',
          taskName: 'Check Vitals',
          companionName: 'Eevee',
          dueTime: '10:00',
          taskUrl: 'http://task'
        };

        const result = emailTemplates.taskReminder(data);

        expect(result.subject).toBe('Task reminder: Check Vitals');
        expect(result.htmlBody).toContain('Companion:</strong> Eevee');
        expect(result.htmlBody).toContain('href="http://task"');
      });

      it('should render with MINIMAL data (fallback ctaUrl)', () => {
        const data: TaskReminderTemplateData = {
          taskName: 'General Task',
          dueTime: '10:00',
          ctaUrl: 'http://cta',
          ctaLabel: 'Go'
        };

        const result = emailTemplates.taskReminder(data);

        expect(result.htmlBody).toContain('Hi there,');
        expect(result.htmlBody).not.toContain('Companion:');
        expect(result.htmlBody).toContain('href="http://cta"');
        expect(result.htmlBody).toContain('Go');
      });

      it('should render with NO CTA', () => {
        const result = emailTemplates.taskReminder({ taskName: 'T', dueTime: 'D' });
        expect(result.htmlBody).not.toContain('bgcolor="#2563eb"');
      });
    });

    describe('specialityHeadAssigned', () => {
      it('should render with FULL data', () => {
        const data: SpecialityHeadAssignedTemplateData = {
          employeeName: 'Sam',
          specialityName: 'Surgery',
          organisationName: 'General Hospital',
          ctaUrl: 'http://pms',
          ctaLabel: 'Login'
        };

        const result = emailTemplates.specialityHeadAssigned(data);

        expect(result.subject).toBe('You’re the Surgery head at General Hospital');
        expect(result.htmlBody).toContain('Surgery</strong> head at General Hospital');
        expect(result.htmlBody).toContain('Login');
      });

      it('should render with MINIMAL data', () => {
        const data: SpecialityHeadAssignedTemplateData = {
          specialityName: 'Dermatology',
        };

        const result = emailTemplates.specialityHeadAssigned(data);

        expect(result.subject).toBe('You’re the Dermatology head');
        expect(result.htmlBody).toContain('Dermatology</strong> head.'); // Ends with period, no "at..."
        expect(result.htmlBody).not.toContain('bgcolor="#2563eb"'); // No button
      });

      it('should use default CTA label if URL provided but no label', () => {
        const result = emailTemplates.specialityHeadAssigned({
            specialityName: 'X',
            ctaUrl: 'http://x'
        });
        expect(result.htmlBody).toContain('Open PMS');
      });
    });

    describe('freePlanLimitReached', () => {
      it('should render limits list and custom CTA', () => {
        const data: FreePlanLimitReachedTemplateData = {
          ownerName: 'Owner',
          organisationName: 'Org1',
          limitItems: [
            { label: 'Users', used: 5, limit: 5 },
            { label: 'Storage', used: 100, limit: 100 }
          ],
          ctaUrl: 'http://upgrade',
          ctaLabel: 'Buy Now'
        };

        const result = emailTemplates.freePlanLimitReached(data);

        expect(result.subject).toBe("You've reached your free plan limits");
        expect(result.htmlBody).toContain('<li>Users: 5 of 5</li>');
        expect(result.htmlBody).toContain('<li>Storage: 100 of 100</li>');
        expect(result.textBody).toContain('Users: 5 of 5');
        expect(result.htmlBody).toContain('Buy Now');
      });

      it('should render with defaults and no CTA', () => {
        const data: FreePlanLimitReachedTemplateData = {
          organisationName: 'Org1',
          limitItems: []
        };
        const result = emailTemplates.freePlanLimitReached(data);
        expect(result.htmlBody).toContain('Hi there,');
        // If no CTA URL, the label "Upgrade Plan" is never rendered.
        expect(result.htmlBody).not.toContain('Upgrade Plan');
        expect(result.htmlBody).not.toContain('bgcolor="#2563eb"');
      });

      it('should render default CTA label if URL present', () => {
          const result = emailTemplates.freePlanLimitReached({
              organisationName: 'O', limitItems: [], ctaUrl: 'http://up'
          });
          expect(result.htmlBody).toContain('Upgrade Plan');
      });
    });

    describe('permissionsUpdated', () => {
      it('should render with role name and CTA', () => {
        const data: PermissionsUpdatedTemplateData = {
          employeeName: 'User',
          organisationName: 'Org',
          roleName: 'Admin',
          ctaUrl: 'http://check'
        };

        const result = emailTemplates.permissionsUpdated(data);

        expect(result.subject).toBe('Your PMS permissions were updated');
        expect(result.htmlBody).toContain('Your role is now Admin.');
        expect(result.htmlBody).toContain('Review Access'); // Default label
      });

      it('should render without role name and CTA', () => {
        const data: PermissionsUpdatedTemplateData = {
          organisationName: 'Org',
        };

        const result = emailTemplates.permissionsUpdated(data);

        expect(result.htmlBody).not.toContain('Your role is now');
        expect(result.htmlBody).not.toContain('bgcolor="#2563eb"');
      });
    });
  });

  describe('renderEmailTemplate (Registry)', () => {
    it('should correctly dispatch to organisationInvite', () => {
      const data: OrganisationInviteTemplateData = {
        organisationName: 'Dispatch Org',
        acceptUrl: 'http://dispatch',
        expiresAt: fixedDate
      };

      const result = renderEmailTemplate('organisationInvite', data);
      expect(result.subject).toContain('Dispatch Org');
    });

    it('should correctly dispatch to taskAssigned', () => {
      const data: TaskAssignedTemplateData = {
        taskName: 'Dispatch Task',
        dueTime: 'Now'
      };

      const result = renderEmailTemplate('taskAssigned', data);
      expect(result.subject).toContain('Dispatch Task');
    });
  });
});