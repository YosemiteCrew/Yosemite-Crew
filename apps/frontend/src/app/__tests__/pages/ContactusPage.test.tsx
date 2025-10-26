import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ContactusPage from '../../pages/ContactusPage/ContactusPage';
import { useOldAuthStore } from '@/app/stores/oldAuthStore';
import { postData } from '@/app/services/axios';
import { toFhirSupportTicket } from '@yosemite-crew/fhir';

jest.mock('@/app/components/Footer/Footer', () => {
  return function MockFooter() {
    return <div data-testid="mock-footer">Footer</div>;
  };
});

jest.mock('@/app/pages/Sign/SignUp', () => ({
  FormInput: jest.fn(({ inlabel, value, onChange, error, inname }) => (
    <div>
      <label htmlFor={inname}>{inlabel}</label>
      <input id={inname} name={inname} value={value} onChange={onChange} />
      {error && <div data-testid="error-message">{error}</div>}
    </div>
  )),
}));

jest.mock('@/app/components/DynamicSelect/DynamicSelect', () => {
  return jest.fn(({ options, value, onChange, inname }) => (
    <select
      id={inname}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid="dynamic-select"
    >
      <option value="">Select one</option>
      {options.map((opt: { value: string; label: string }) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ));
});

jest.mock('next/link', () => {
  return ({ children }: { children: React.ReactNode }) => children;
});

jest.mock('@/app/services/axios', () => ({
  postData: jest.fn(),
}));
const mockedPostData = postData as jest.Mock;

jest.mock('@yosemite-crew/fhir');
const mockedToFhirSupportTicket = toFhirSupportTicket as jest.Mock;

jest.mock('@/app/stores/oldAuthStore');
const mockedUseOldAuthStore = useOldAuthStore as unknown as jest.Mock;


describe('ContactusPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseOldAuthStore.mockReturnValue({
      email: null,
      userType: null,
      isVerified: false,
    });
    mockedToFhirSupportTicket.mockImplementation((data) => ({ ...data, fhir: 'converted' }));
    mockedPostData.mockResolvedValue({ status: 200 });
  });

  it('should render the initial form correctly with "General Enquiry" selected', () => {
    render(<ContactusPage />);
    expect(screen.getByRole('heading', { name: /Need Help\? We’re All Ears!/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'General Enquiry' })).toBeChecked();
    expect(screen.getByPlaceholderText('Your Message')).toBeInTheDocument();
  });

  it('should pre-fill email if user is logged in', () => {
    mockedUseOldAuthStore.mockReturnValue({
      email: 'test@example.com',
      userType: 'Professional',
      isVerified: true,
    });
    render(<ContactusPage />);
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  it('should switch to and render the "Complaint" form when selected', () => {
    render(<ContactusPage />);
    fireEvent.click(screen.getByRole('radio', { name: 'Complaint' }));
    expect(screen.getByRole('radio', { name: 'Complaint' })).toBeChecked();
    expect(screen.getByText(/Please add link regarding your complaint/i)).toBeInTheDocument();
  });

  it('should switch to and render the "Data Service Access Request" form when selected', () => {
    render(<ContactusPage />);
    fireEvent.click(screen.getByRole('radio', { name: 'Data Service Access Request' }));
    expect(screen.getByText(/Under the rights of which law are you making this request/i)).toBeInTheDocument();
  });

  describe('Form Submission and Validation', () => {
    it('should show validation errors if required fields are empty on general enquiry', async () => {
      render(<ContactusPage />);
      const submitButton = screen.getAllByRole('button', { name: 'Send Message' })[0];
      fireEvent.click(submitButton);
    });

    it('should show invalid email error', async () => {
      render(<ContactusPage />);

      fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('Your Message'), { target: { value: 'A message' } });

      fireEvent.change(screen.getByLabelText('Enter Email Address'), { target: { value: 'not-an-email' } });
      fireEvent.click(screen.getAllByRole('button', { name: 'Send Message' })[0]);

      expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
      expect(mockedPostData).not.toHaveBeenCalled();
    });

    it('should enable submit button when general enquiry form is valid and submit successfully', async () => {
      render(<ContactusPage />);
      const submitButton = screen.getAllByRole('button', { name: 'Send Message' })[0];
      expect(submitButton).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByLabelText('Enter Email Address'), { target: { value: 'john.doe@example.com' } });
      fireEvent.change(screen.getByPlaceholderText('Your Message'), { target: { value: 'This is a test message.' } });

      await waitFor(() => expect(submitButton).toBeEnabled());
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockedToFhirSupportTicket).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'John Doe' }));
        expect(mockedPostData).toHaveBeenCalledWith('/fhir/v1/support/request-support', expect.any(Object));
      });
    });

    it('should submit a feature request successfully', async () => {
      render(<ContactusPage />);
      fireEvent.click(screen.getByRole('radio', { name: 'Feature Request' }));

      const submitButton = screen.getAllByRole('button', { name: 'Send Message' })[0];

      fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByLabelText('Enter Email Address'), { target: { value: 'john.doe@example.com' } });
      fireEvent.change(screen.getByPlaceholderText('Your Message'), { target: { value: 'This is a feature request.' } });

      await waitFor(() => expect(submitButton).toBeEnabled());
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockedToFhirSupportTicket).toHaveBeenCalledWith(expect.objectContaining({ category: 'Feature Request' }));
        expect(mockedPostData).toHaveBeenCalled();
      });
    });

    it('should enable submit button when complaint form is valid and submit successfully', async () => {
      render(<ContactusPage />);
      fireEvent.click(screen.getByRole('radio', { name: 'Complaint' }));

      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      expect(submitButton).toBeInTheDocument();


      fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Jane Doe' } });
      fireEvent.change(screen.getByLabelText('Enter Email Address'), { target: { value: 'jane.doe@example.com' } });
      fireEvent.change(screen.getAllByPlaceholderText('Your Message')[0], { target: { value: 'This is a complaint.' } });
      fireEvent.change(screen.getByLabelText('Paste link (optional)'), { target: { value: 'http://example.com' } });
      fireEvent.click(screen.getByLabelText('An agent authorized by the consumer to make this request on their behalf'));

      const file = new File(['hello'], 'hello.png', { type: 'image/png' });
      const imageInput = screen.getByLabelText('Upload Image');
      await userEvent.upload(imageInput, file);

      const allCheckboxes = screen.getAllByRole('checkbox');
      for (const checkbox of allCheckboxes) {
        fireEvent.click(checkbox);
      }
      await waitFor(() => expect(submitButton).toBeEnabled());

      fireEvent.click(submitButton);

      await waitFor(() => expect(mockedPostData).toHaveBeenCalled());
    });

    it('should show validation error on complaint form', async () => {
        render(<ContactusPage />);
        fireEvent.click(screen.getByRole('radio', { name: 'Complaint' }));

        const submitButton = screen.getByRole('button', { name: 'Send Message' });
        expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when DSAR form is valid and submit successfully', async () => {
        render(<ContactusPage />);
        fireEvent.click(screen.getByRole('radio', { name: 'Data Service Access Request' }));

        const submitButton = screen.getByRole('button', { name: 'Send Message' });
        expect(submitButton).toBeInTheDocument();


        fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Sam Smith' } });
        fireEvent.change(screen.getByLabelText('Enter Email Address'), { target: { value: 'sam.smith@example.com' } });
        fireEvent.change(screen.getAllByPlaceholderText('Your Message')[0], {  target: { value: 'DSAR request.' } });
        fireEvent.click(screen.getByLabelText('The person, or the parent / guardian of the person, whose name appears above'));
        fireEvent.change(screen.getByTestId('dynamic-select'), { target: { value: 'west' } });
        fireEvent.click(screen.getByLabelText('Access your personal information'));

        const checkboxes = screen.getAllByRole('checkbox');
        for (const checkbox of checkboxes) {
          fireEvent.click(checkbox);
        }

        await waitFor(() => expect(submitButton).toBeEnabled());

        fireEvent.click(submitButton);

        await waitFor(() => {
          expect(mockedPostData).toHaveBeenCalledWith(
            '/fhir/v1/support/request-support',
            expect.objectContaining({ fhir: 'converted' })
          );
        });
      });

    it('should keep submit button disabled if DSAR form is almost valid', async () => {
        render(<ContactusPage />);
        fireEvent.click(screen.getByRole('radio', { name: 'Data Service Access Request' }));

        const submitButton = screen.getByRole('button', { name: 'Send Message' });

        fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Sam Smith' } });
        fireEvent.change(screen.getByLabelText('Enter Email Address'), { target: { value: 'sam.smith@example.com' } });
        fireEvent.change(screen.getAllByPlaceholderText('Your Message')[0], { target: { value: 'DSAR request.' } });
        fireEvent.click(screen.getByLabelText('The person, or the parent / guardian of the person, whose name appears above'));
        fireEvent.change(screen.getByTestId('dynamic-select'), { target: { value: 'west' } });
        fireEvent.click(screen.getByLabelText('Access your personal information'));

        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);

        expect(submitButton).toBeDisabled();
      });

    it('should handle API submission failure gracefully', async () => {
        mockedPostData.mockRejectedValue(new Error('API Error'));

        render(<ContactusPage />);

        const submitButton = screen.getAllByRole('button', { name: 'Send Message' })[0];

        fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'John Doe' } });
        fireEvent.change(screen.getByLabelText('Enter Email Address'), { target: { value: 'john.doe@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('Your Message'), { target: { value: 'This will fail.' } });

        await waitFor(() => expect(submitButton).toBeEnabled());
        fireEvent.click(submitButton);

        expect(await screen.findByText('submitting...')).toBeInTheDocument();

        await waitFor(() => expect(mockedPostData).toHaveBeenCalled());

        expect(await screen.findByText('Send Message')).toBeInTheDocument();
      });
  });
});