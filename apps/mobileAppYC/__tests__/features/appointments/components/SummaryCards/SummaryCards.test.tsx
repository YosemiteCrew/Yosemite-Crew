import React from 'react';
import {render} from '@testing-library/react-native';
import {SummaryCards} from '@/features/appointments/components/SummaryCards/SummaryCards';

const mockBookingSummaryCard = jest.fn();
jest.mock('@/features/appointments/components/BookingSummaryCard', () => {
  const {View} = require('react-native');
  return {
    BookingSummaryCard: (props: any) => {
      mockBookingSummaryCard(props);
      return <View testID="booking-summary-card" />;
    },
  };
});

describe('SummaryCards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no props are provided', () => {
    const {queryAllByTestId} = render(<SummaryCards />);
    expect(queryAllByTestId('booking-summary-card')).toHaveLength(0);
  });

  it('merges business and businessSummary, preferring businessSummary fields', () => {
    render(
      <SummaryCards
        business={
          {id: 'b1', name: 'Original Name', address: 'Orig Addr'} as any
        }
        businessSummary={{
          name: 'Overridden Name',
          address: 'New Addr',
          description: 'A desc',
          photo: 'photo.png',
        }}
      />,
    );

    expect(mockBookingSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Overridden Name',
        subtitlePrimary: 'New Addr',
        subtitleSecondary: 'A desc',
        image: 'photo.png',
      }),
    );
  });

  it('falls back to business alone when businessSummary is absent', () => {
    render(
      <SummaryCards
        business={{id: 'b1', name: 'Biz Only', address: 'Addr'} as any}
      />,
    );

    expect(mockBookingSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({title: 'Biz Only', subtitlePrimary: 'Addr'}),
    );
  });

  it('falls back to businessSummary alone when business is absent', () => {
    render(<SummaryCards businessSummary={{name: 'Summary Only'}} />);

    expect(mockBookingSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({title: 'Summary Only'}),
    );
  });

  it('renders the service card using the service object name and price', () => {
    render(
      <SummaryCards
        service={
          {
            id: 's1',
            name: 'Checkup',
            description: 'Full checkup',
            basePrice: 50,
            currency: 'EUR',
          } as any
        }
      />,
    );

    expect(mockBookingSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Checkup',
        subtitlePrimary: 'Full checkup',
        badgeText: expect.stringContaining('50'),
      }),
    );
  });

  it('falls back to USD when the service has no currency', () => {
    render(
      <SummaryCards
        service={{id: 's1', name: 'Checkup', basePrice: 50} as any}
      />,
    );

    expect(mockBookingSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({badgeText: '$50'}),
    );
  });

  it('falls back to serviceName when service object is absent', () => {
    render(<SummaryCards serviceName="Named Service" />);

    expect(mockBookingSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({title: 'Named Service'}),
    );
  });

  it('falls back to "Requested service" when neither service nor serviceName is provided but employee is', () => {
    render(<SummaryCards service={{} as any} />);

    expect(mockBookingSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({title: 'Requested service', badgeText: null}),
    );
  });

  it('renders the employee card with employeeDepartment overriding employee.title', () => {
    render(
      <SummaryCards
        employee={
          {
            id: 'e1',
            name: 'Dr. Vet',
            specialization: 'Surgery',
            title: 'Senior Vet',
            avatar: 'avatar.png',
          } as any
        }
        employeeDepartment="Custom Department"
      />,
    );

    expect(mockBookingSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Dr. Vet',
        subtitlePrimary: 'Surgery',
        subtitleSecondary: 'Custom Department',
        image: 'avatar.png',
      }),
    );
  });

  it('falls back to employee.title when employeeDepartment is absent', () => {
    render(
      <SummaryCards
        employee={{id: 'e1', name: 'Dr. Vet', title: 'Senior Vet'} as any}
      />,
    );

    expect(mockBookingSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({subtitleSecondary: 'Senior Vet'}),
    );
  });

  it('renders all three cards together and passes interactive/cardStyle through', () => {
    const cardStyle = {marginTop: 8};
    render(
      <SummaryCards
        business={{id: 'b1', name: 'Biz'} as any}
        service={{id: 's1', name: 'Svc'} as any}
        employee={{id: 'e1', name: 'Emp'} as any}
        interactive
        cardStyle={cardStyle}
      />,
    );

    expect(mockBookingSummaryCard).toHaveBeenCalledTimes(3);
    mockBookingSummaryCard.mock.calls.forEach(([props]) => {
      expect(props.interactive).toBe(true);
      expect(props.style).toBe(cardStyle);
    });
  });
});
