import React, {forwardRef} from 'react';
import InfoBottomSheet, {type InfoBottomSheetRef} from './InfoBottomSheet';

export const RescheduledInfoSheet = forwardRef<InfoBottomSheetRef, {onClose?: () => void}>(
  ({onClose}, ref) => (
    <InfoBottomSheet
      ref={ref}
      title="Appointment rescheduled"
      message="We will notify you once the organisation accepts your request."
      cta="Close"
      onCta={onClose}
    />
  ),
);

export default RescheduledInfoSheet;

