import {
  avatarAccentFor,
  humanize,
  initialsOf,
  orgTypePillLabel,
  teamStatusPill,
} from '@/app/features/organization/pages/Organization/Sections/orgDisplay';

describe('orgDisplay helpers', () => {
  describe('avatarAccentFor', () => {
    it('is deterministic for the same seed', () => {
      expect(avatarAccentFor('team-1')).toBe(avatarAccentFor('team-1'));
    });

    it('returns one of the known accent classes', () => {
      const accent = avatarAccentFor('anything');
      expect(accent).toMatch(/avatar-|blue-soft/);
    });

    it('handles an empty seed', () => {
      expect(avatarAccentFor('')).toMatch(/avatar-|blue-soft/);
      expect(avatarAccentFor()).toMatch(/avatar-|blue-soft/);
    });
  });

  describe('initialsOf', () => {
    it('takes up to two initials', () => {
      expect(initialsOf('Sarah Weber')).toBe('SW');
    });

    it('ignores an (owner)-style suffix', () => {
      expect(initialsOf('John (owner)')).toBe('J');
    });

    it('falls back to a single glyph', () => {
      expect(initialsOf('')).toBe('?');
      expect(initialsOf()).toBe('?');
    });
  });

  describe('teamStatusPill', () => {
    it('maps requested to INVITED', () => {
      expect(teamStatusPill('Requested').label).toBe('INVITED');
    });

    it('maps off-duty to OFF DUTY muted', () => {
      const pill = teamStatusPill('Off-Duty');
      expect(pill.label).toBe('OFF DUTY');
      expect(pill.tokens.bg).toMatch(/band/);
    });

    it('keeps other statuses as the completed pill', () => {
      expect(teamStatusPill('Available').label).toBe('Available');
      expect(teamStatusPill('Available').tokens.bg).toMatch(/status-completed/);
    });

    it('defaults to ACTIVE when status is missing', () => {
      expect(teamStatusPill().label).toBe('ACTIVE');
      expect(teamStatusPill('').label).toBe('ACTIVE');
    });
  });

  describe('orgTypePillLabel', () => {
    it('trims a provided type', () => {
      expect(orgTypePillLabel('Hospital')).toBe('Hospital');
    });

    it('falls back to CLINIC', () => {
      expect(orgTypePillLabel()).toBe('CLINIC');
      expect(orgTypePillLabel('   ')).toBe('CLINIC');
    });
  });

  describe('humanize', () => {
    it('humanizes an enum value', () => {
      expect(humanize('FULL_TIME')).toBe('Full time');
      expect(humanize('VETERINARIAN')).toBe('Veterinarian');
    });

    it('returns an empty string for missing values', () => {
      expect(humanize()).toBe('');
      expect(humanize('')).toBe('');
    });

    // The catalog status pills (services / packages) render through humanize, so
    // every lifecycle status the backend can send must come out as UI copy.
    it.each([
      ['ACTIVE', 'Active'],
      ['ARCHIVED', 'Archived'],
      ['INACTIVE', 'Inactive'],
      ['DRAFT', 'Draft'],
      ['PENDING_REVIEW', 'Pending review'],
    ])('maps the %s catalog status to "%s"', (status, label) => {
      expect(humanize(status)).toBe(label);
    });
  });
});
