import {
  findSessionByStoredId,
  formatClosedTime,
  formatRowTime,
  getChannelDisplayInfo,
  getSessionIdFromChannel,
  isCounterpartOnline,
  matchesChannelId,
  matchesDirectSession,
  matchesGroupSession,
  normalizeName,
  resolveChannelScope,
} from '@/app/features/chat/components/chatContainerUtils';
import { formatDisplayDate } from '@/app/lib/date';
import type { Channel as StreamChannel } from 'stream-chat';

jest.mock('@/app/lib/date', () => ({
  formatDisplayDate: jest.fn(() => 'Formatted date'),
}));

type ChannelOverride = {
  id?: string;
  cid?: string;
  data?: Record<string, unknown>;
  state?: { members?: Record<string, unknown> };
};

const channel = (overrides: ChannelOverride = {}): StreamChannel =>
  ({
    id: 'channel-1',
    cid: 'messaging:channel-1',
    data: {},
    state: { members: {} },
    ...overrides,
  }) as unknown as StreamChannel;

describe('chatContainerUtils', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T12:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('normalizes names and finds session ids', () => {
    expect(normalizeName("Buddy{' '}Owner")).toBe('Buddy Owner');
    expect(normalizeName(undefined)).toBe('');
    expect(getSessionIdFromChannel(channel({ data: { groupId: 'group-1' } }))).toBe('group-1');
    expect(getSessionIdFromChannel(channel({ data: { directId: 'direct-1' } }))).toBe('direct-1');
    expect(findSessionByStoredId([{ _id: '1' }, { _id: '2' }], '2')).toEqual({ _id: '2' });
    expect(findSessionByStoredId([{ _id: '1' }], undefined)).toBeUndefined();
  });

  it('matches direct/group sessions and channel ids', () => {
    expect(matchesDirectSession({ type: 'ORG_DIRECT', members: ['a', 'b'] }, ['a', 'b'])).toBe(
      true
    );
    expect(matchesDirectSession({ type: 'ORG_DIRECT', members: ['a', 'b', 'c'] }, ['a', 'b'])).toBe(
      false
    );
    // Same size, different people: membership is checked against the channel's
    // ids, so a session that merely has the right count must not match.
    expect(matchesDirectSession({ type: 'ORG_DIRECT', members: ['a', 'x'] }, ['a', 'b'])).toBe(
      false
    );
    // Only two-party ORG_DIRECT sessions are direct-session candidates.
    expect(matchesDirectSession({ type: 'ORG_GROUP', members: ['a', 'b'] }, ['a', 'b'])).toBe(
      false
    );
    expect(
      matchesDirectSession({ type: 'ORG_DIRECT', members: ['a', 'b', 'c'] }, ['a', 'b', 'c'])
    ).toBe(false);

    expect(
      matchesGroupSession(
        { type: 'ORG_GROUP', members: ['a', 'b', 'c'], title: 'Team' },
        ['a', 'b', 'c'],
        'Team'
      )
    ).toBe(true);
    expect(
      matchesGroupSession({ type: 'ORG_GROUP', members: ['a', 'b', 'c'] }, ['a', 'b'], 'Team')
    ).toBe(false);
    // One member differs and no title to fall back on: not the same group.
    expect(
      matchesGroupSession({ type: 'ORG_GROUP', members: ['a', 'b', 'x'] }, ['a', 'b', 'c'])
    ).toBe(false);
    // Disjoint membership fails the overlap floor outright.
    expect(
      matchesGroupSession({ type: 'ORG_GROUP', members: ['x', 'y', 'z'] }, ['a', 'b', 'c'], 'Team')
    ).toBe(false);
    // Every session member is in the channel, but the channel has one more:
    // a subset is not the same group.
    expect(matchesGroupSession({ type: 'ORG_GROUP', members: ['a', 'b'] }, ['a', 'b', 'c'])).toBe(
      false
    );
    expect(matchesChannelId({ channelId: 'channel-1' }, channel())).toBe(true);
    expect(matchesChannelId({ channelId: 'messaging:channel-1' }, channel())).toBe(true);
    expect(matchesChannelId({ channelId: 'prefix-channel-1' }, channel())).toBe(true);
    expect(matchesChannelId({ channelId: 'missing' }, channel())).toBe(false);
  });

  it('builds display info from explicit titles, patient metadata, and members', () => {
    expect(getChannelDisplayInfo(null)).toEqual({ title: 'Chat' });

    expect(
      getChannelDisplayInfo(
        channel({
          data: { title: "Buddy{' '}Chat", image: 'explicit.png' },
          state: {
            members: {
              me: { user: { id: 'me', name: 'Me' } },
              other: { user: { id: 'other', name: 'Pat Owner', image: 'other.png' } },
            },
          },
        }),
        'me'
      )
    ).toEqual({ title: 'Buddy Chat', image: 'explicit.png' });

    expect(
      getChannelDisplayInfo(
        channel({
          id: 'fallback-id',
          data: { petName: 'Buddy', petOwnerName: 'Sam' },
        }),
        'me'
      )
    ).toEqual({ title: 'Buddy (Sam)', image: undefined });
  });

  it('resolves channel scopes from metadata and member counts', () => {
    expect(resolveChannelScope(channel({ data: { chatCategory: 'client' } }))).toBe('clients');
    expect(resolveChannelScope(channel({ data: { category: 'team' } }))).toBe('colleagues');
    expect(resolveChannelScope(channel({ data: { channelType: 'broadcast' } }))).toBe('groups');
    expect(
      resolveChannelScope(channel({ data: { appointmentId: 'appt-1' }, state: { members: {} } }))
    ).toBe('clients');
    expect(
      resolveChannelScope(
        channel({
          data: { member_count: 3 },
          state: { members: { a: {}, b: {}, c: {} } },
        })
      )
    ).toBe('groups');
    expect(resolveChannelScope(channel())).toBe('colleagues');
  });

  it('formats row/closed times and detects counterpart presence', () => {
    expect(formatRowTime()).toBe('');
    expect(formatRowTime('2026-07-07T11:59:45.000Z')).toBe('now');
    expect(formatRowTime('2026-07-07T11:30:00.000Z')).toBe('30m');
    expect(formatRowTime('2026-07-07T09:00:00.000Z')).toBe('3h');
    expect(formatRowTime('2026-07-06T12:00:00.000Z')).toBe('Yesterday');
    expect(formatRowTime('2026-06-29T12:00:00.000Z')).toBe('Jun 29');

    expect(formatClosedTime(undefined)).toBe('');
    expect(formatClosedTime('2026-07-07T11:59:30.000Z')).toBe('just now');
    expect(formatClosedTime('2026-07-07T11:30:00.000Z')).toBe('30 minutes ago');
    expect(formatClosedTime('2026-07-07T10:00:00.000Z')).toBe('2 hours ago');
    expect(formatClosedTime('2026-07-05T12:00:00.000Z')).toBe('2 days ago');
    expect(formatClosedTime('2026-06-20T12:00:00.000Z')).toBe('Formatted date');
    expect(formatDisplayDate).toHaveBeenCalled();

    expect(
      isCounterpartOnline(
        channel({
          state: {
            members: {
              me: { user: { id: 'me', online: false } },
              other: { user: { id: 'other', online: true } },
            },
          },
        }),
        'me'
      )
    ).toBe(true);
    expect(isCounterpartOnline(channel(), 'me')).toBe(false);
  });
});
