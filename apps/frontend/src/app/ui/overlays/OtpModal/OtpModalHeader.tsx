type OtpModalHeaderProps = {
  dialogTitleId: string;
  dialogDescriptionId: string;
  email: string;
};

const OtpModalHeader = ({
  dialogTitleId,
  dialogDescriptionId,
  email,
}: Readonly<OtpModalHeaderProps>) => (
  <div className="VerifyTexted">
    <h2 id={dialogTitleId} className="text-display-2 text-text-primary">
      Verify Email Address
    </h2>
    <div className="text-body-3-emphasis text-text-primary">
      A Verification code has been sent to <br /> <span>{email}</span>
    </div>
    <p id={dialogDescriptionId}>
      Please check your inbox and enter the verification code below to verify your email address.
      The Code will expire soon.
    </p>
  </div>
);

export default OtpModalHeader;
