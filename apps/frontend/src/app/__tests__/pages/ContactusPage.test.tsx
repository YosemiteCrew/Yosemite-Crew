import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ContactusPage from '@/app/features/marketing/pages/ContactusPage/ContactusPage';
import { postData } from '@/app/services/axios';

jest.mock('@/app/features/marketing/site', () => ({
  useMagnet: () => ({ current: null }),
  DISCORD_INVITE_URL: 'https://discord.gg/yosemitecrew',
}));

jest.mock('@/app/services/axios', () => ({
  postData: jest.fn(),
}));
const mockedPostData = postData as jest.Mock;

describe('ContactusPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPostData.mockResolvedValue({ data: { id: 'contact-id' } });
  });

  it('should render the hero heading and channels with "General Enquiry" selected', () => {
    render(<ContactusPage />);
    expect(screen.getByRole('heading', { level: 1, name: /Talk to a/i })).toBeInTheDocument();
    expect(screen.getByText('support@yosemitecrew.com')).toBeInTheDocument();
    expect(screen.getByText('+49 152 277 63275')).toBeInTheDocument();
    expect(screen.getByText('Join the Discord')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'General Enquiry' })).toBeChecked();
    expect(screen.getByPlaceholderText('Your Message')).toBeInTheDocument();
  });

  it('should render the Discord channel as an external link', () => {
    render(<ContactusPage />);
    const discord = screen.getByText('Join the Discord').closest('a');
    expect(discord).toHaveAttribute('target', '_blank');
    expect(discord).toHaveAttribute('rel', 'noopener');
    expect(discord).toHaveAttribute('href', 'https://discord.gg/yosemitecrew');
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
    expect(
      screen.getByText(/Under the rights of which law are you making this request/i)
    ).toBeInTheDocument();
  });

  describe('Form Submission and Validation', () => {
    it('should not submit and should surface an email error when fields are empty', () => {
      render(<ContactusPage />);
      const submitButton = screen.getAllByRole('button', {
        name: 'Send message',
      })[0];
      fireEvent.click(submitButton);
      expect(mockedPostData).not.toHaveBeenCalled();
    });

    it('should show invalid email error', async () => {
      render(<ContactusPage />);

      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'John Doe' },
      });
      fireEvent.change(screen.getByPlaceholderText('Your Message'), {
        target: { value: 'A message' },
      });

      fireEvent.change(screen.getByLabelText('Enter Email Address'), {
        target: { value: 'not-an-email' },
      });
      fireEvent.click(screen.getAllByRole('button', { name: 'Send message' })[0]);

      expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
      expect(mockedPostData).not.toHaveBeenCalled();
    });

    it('should enable submit button when general enquiry form is valid and submit successfully', async () => {
      render(<ContactusPage />);
      const submitButton = screen.getAllByRole('button', {
        name: 'Send message',
      })[0];
      expect(submitButton).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'John Doe' },
      });
      fireEvent.change(screen.getByLabelText('Enter Email Address'), {
        target: { value: 'john.doe@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Your Message'), {
        target: { value: 'This is a test message.' },
      });

      await waitFor(() => expect(submitButton).toBeEnabled());
      fireEvent.click(submitButton);
      await waitFor(() => expect(mockedPostData).toHaveBeenCalledTimes(1));
      expect(mockedPostData).toHaveBeenCalledWith('/v1/contact-us/contact-web', {
        type: 'GENERAL_ENQUIRY',
        message: 'This is a test message.',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        source: 'PMS_WEB',
      });
    });

    it('should include the phone number in the payload when provided', async () => {
      render(<ContactusPage />);
      const submitButton = screen.getAllByRole('button', { name: 'Send message' })[0];

      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'John Doe' },
      });
      fireEvent.change(screen.getByLabelText('Enter Email Address'), {
        target: { value: 'john.doe@example.com' },
      });
      fireEvent.change(screen.getByLabelText('Phone number (optional)'), {
        target: { value: '+49 152 000 000' },
      });
      fireEvent.change(screen.getByPlaceholderText('Your Message'), {
        target: { value: 'With a phone number.' },
      });

      await waitFor(() => expect(submitButton).toBeEnabled());
      fireEvent.click(submitButton);
      await waitFor(() => expect(mockedPostData).toHaveBeenCalledTimes(1));
      expect(mockedPostData).toHaveBeenCalledWith('/v1/contact-us/contact-web', {
        type: 'GENERAL_ENQUIRY',
        message: 'With a phone number.',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        source: 'PMS_WEB',
        phone: '+49 152 000 000',
      });
    });

    it('should submit a feature request successfully', async () => {
      render(<ContactusPage />);
      fireEvent.click(screen.getByRole('radio', { name: 'Feature Request' }));

      const submitButton = screen.getAllByRole('button', {
        name: 'Send message',
      })[0];

      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'John Doe' },
      });
      fireEvent.change(screen.getByLabelText('Enter Email Address'), {
        target: { value: 'john.doe@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Your Message'), {
        target: { value: 'This is a feature request.' },
      });

      await waitFor(() => expect(submitButton).toBeEnabled());
      fireEvent.click(submitButton);
      await waitFor(() => expect(mockedPostData).toHaveBeenCalledTimes(1));
      expect(mockedPostData).toHaveBeenCalledWith('/v1/contact-us/contact-web', {
        type: 'FEATURE_REQUEST',
        message: 'This is a feature request.',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        source: 'PMS_WEB',
      });
    });

    it('should enable submit button when complaint form is valid and submit successfully', async () => {
      render(<ContactusPage />);
      fireEvent.click(screen.getByRole('radio', { name: 'Complaint' }));

      const submitButton = screen.getByRole('button', { name: 'Send message' });
      expect(submitButton).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'Jane Doe' },
      });
      fireEvent.change(screen.getByLabelText('Enter Email Address'), {
        target: { value: 'jane.doe@example.com' },
      });
      fireEvent.change(screen.getAllByPlaceholderText('Your Message')[0], {
        target: { value: 'This is a complaint.' },
      });
      fireEvent.change(screen.getByLabelText('Paste link (optional)'), {
        target: { value: 'http://example.com' },
      });
      fireEvent.click(
        screen.getByLabelText(
          'Submit complaint as An agent authorized by the consumer to make this request on their behalf'
        )
      );

      const file = new File(['hello'], 'hello.png', { type: 'image/png' });
      const imageInput = screen.getByLabelText('Upload Image');
      await userEvent.upload(imageInput, file);

      const allCheckboxes = screen.getAllByRole('checkbox');
      for (const checkbox of allCheckboxes) {
        fireEvent.click(checkbox);
      }
      await waitFor(() => expect(submitButton).toBeEnabled());

      fireEvent.click(submitButton);

      await waitFor(() => expect(mockedPostData).toHaveBeenCalledTimes(1));
      expect(mockedPostData).toHaveBeenCalledWith('/v1/contact-us/contact-web', {
        type: 'COMPLAINT',
        message: 'This is a complaint.',
        fullName: 'Jane Doe',
        email: 'jane.doe@example.com',
        source: 'PMS_WEB',
      });
      expect(screen.getByLabelText('Full Name')).toHaveValue('');
      expect(screen.getByLabelText('Enter Email Address')).toHaveValue('');
    });

    it('should show the uploaded image name on the complaint form', async () => {
      render(<ContactusPage />);
      fireEvent.click(screen.getByRole('radio', { name: 'Complaint' }));

      const file = new File(['hello'], 'proof.png', { type: 'image/png' });
      await userEvent.upload(screen.getByLabelText('Upload Image'), file);

      expect(screen.getByText('proof.png')).toBeInTheDocument();
    });

    it('should keep the complaint submit button disabled until required fields are filled', () => {
      render(<ContactusPage />);
      fireEvent.click(screen.getByRole('radio', { name: 'Complaint' }));

      const submitButton = screen.getByRole('button', { name: 'Send message' });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when DSAR form is valid and submit successfully', async () => {
      render(<ContactusPage />);
      fireEvent.click(screen.getByRole('radio', { name: 'Data Service Access Request' }));

      const submitButton = screen.getByRole('button', { name: 'Send message' });
      expect(submitButton).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'Sam Smith' },
      });
      fireEvent.change(screen.getByLabelText('Enter Email Address'), {
        target: { value: 'sam.smith@example.com' },
      });
      fireEvent.change(screen.getAllByPlaceholderText('Your Message')[0], {
        target: { value: 'DSAR request.' },
      });
      fireEvent.click(
        screen.getByLabelText(
          'Submit data service access request as The person whose name appears above'
        )
      );
      fireEvent.change(screen.getByTestId('dynamic-select'), {
        target: { value: 'UK_GDPR' },
      });
      fireEvent.click(
        screen.getByLabelText(
          'Submit data service access request to Access your personal information'
        )
      );

      const checkboxes = screen.getAllByRole('checkbox');
      for (const checkbox of checkboxes) {
        fireEvent.click(checkbox);
      }

      await waitFor(() => expect(submitButton).toBeEnabled());

      fireEvent.click(submitButton);
      await waitFor(() => expect(mockedPostData).toHaveBeenCalledTimes(1));
      expect(mockedPostData).toHaveBeenCalledWith('/v1/contact-us/contact-web', {
        type: 'DSAR',
        message: 'DSAR request.',
        fullName: 'Sam Smith',
        email: 'sam.smith@example.com',
        source: 'PMS_WEB',
        dsarDetails: {
          requesterType: 'SELF',
          lawBasis: 'UK_GDPR',
          rightsRequested: ['ACCESS_PERSONAL_INFORMATION'],
          declarationAccepted: true,
        },
      });
      expect(screen.getByLabelText('Full Name')).toHaveValue('');
      expect(screen.getByLabelText('Enter Email Address')).toHaveValue('');
      expect(screen.getByRole('radio', { name: 'General Enquiry' })).toBeChecked();
    });

    it('should keep submit button disabled if DSAR form is almost valid', () => {
      render(<ContactusPage />);
      fireEvent.click(screen.getByRole('radio', { name: 'Data Service Access Request' }));

      const submitButton = screen.getByRole('button', { name: 'Send message' });

      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'Sam Smith' },
      });
      fireEvent.change(screen.getByLabelText('Enter Email Address'), {
        target: { value: 'sam.smith@example.com' },
      });
      fireEvent.change(screen.getAllByPlaceholderText('Your Message')[0], {
        target: { value: 'DSAR request.' },
      });
      fireEvent.click(
        screen.getByLabelText(
          'Submit data service access request as The person whose name appears above'
        )
      );
      // Leaving the law selection empty keeps the form invalid.
      fireEvent.click(
        screen.getByLabelText(
          'Submit data service access request to Access your personal information'
        )
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      expect(submitButton).toBeDisabled();
    });

    it('should handle API submission failure gracefully', async () => {
      mockedPostData.mockRejectedValue(new Error('API Error'));

      render(<ContactusPage />);

      const submitButton = screen.getAllByRole('button', {
        name: 'Send message',
      })[0];

      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'John Doe' },
      });
      fireEvent.change(screen.getByLabelText('Enter Email Address'), {
        target: { value: 'john.doe@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Your Message'), {
        target: { value: 'This will fail.' },
      });

      await waitFor(() => expect(submitButton).toBeEnabled());
      fireEvent.click(submitButton);

      await waitFor(() => expect(mockedPostData).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('submitting...')).not.toBeInTheDocument();
      expect(screen.getByText('Send message')).toBeInTheDocument();
    });
  });
});
