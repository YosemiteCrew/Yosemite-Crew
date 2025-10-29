import React, {forwardRef} from 'react';
import InfoBottomSheet, {type InfoBottomSheetRef} from './InfoBottomSheet';

export const CanceledInfoSheet = forwardRef<InfoBottomSheetRef, {onClose?: () => void}>(
  ({onClose}, ref) => (
    <InfoBottomSheet
      ref={ref}
      title="Appointment canceled"
      message="We will notify you once the organisation accepts your request."
      cta="Close"
      onCta={onClose}
    />
  ),
);

export default CanceledInfoSheet;

