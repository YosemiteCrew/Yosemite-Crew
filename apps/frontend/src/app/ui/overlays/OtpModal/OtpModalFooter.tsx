import Link from 'next/link';
import { Button } from '@/app/ui';

type OtpModalFooterProps = {
  isVerifying: boolean;
  timer: number;
  code: string[];
  onVerify: () => void;
  onResend: () => void;
  onChangeEmail: () => void;
};

const OtpModalFooter = ({
  isVerifying,
  timer,
  code,
  onVerify,
  onResend,
  onChangeEmail,
}: Readonly<OtpModalFooterProps>) => (
  <div className="VerifyModalBottomInner">
    <div className="VerifyBtnDiv">
      <Button
        variant="primary"
        text={isVerifying ? 'Verifying...' : 'Verify Code'}
        type="button"
        onClick={onVerify}
        // `timer` is the resend countdown, not the code's lifetime: a code that
        // is still valid must remain submittable after it reaches zero.
        isDisabled={isVerifying || code.includes('')}
        className="w-full"
      />
      <output aria-live="polite">
        {timer > 0
          ? `${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')} sec`
          : 'Didn’t get the code? Request a new one below.'}
      </output>
    </div>
    <div className="VerifyResent">
      <Link
        href=""
        onClick={(e) => {
          e.preventDefault();
          onResend();
        }}
      >
        <span>Request New Code</span>
      </Link>
      <Link href="#" onClick={onChangeEmail}>
        . Change Email
      </Link>
    </div>
  </div>
);

export default OtpModalFooter;
