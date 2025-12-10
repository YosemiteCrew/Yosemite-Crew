import React, {createContext, useContext, useMemo, useState} from 'react';
import type {
  AdverseEventProductInfo,
  AdverseEventReportDraft,
  ReporterType,
} from '@/features/adverseEventReporting/types';

const createInitialDraft = (): AdverseEventReportDraft => ({
  companionId: null,
  reporterType: 'parent',
  agreeToTerms: false,
  linkedBusinessId: null,
  productInfo: null,
  consentToContact: false,
});

interface AdverseEventReportContextValue {
  draft: AdverseEventReportDraft;
  updateDraft: (patch: Partial<AdverseEventReportDraft>) => void;
  setProductInfo: (info: AdverseEventProductInfo | null) => void;
  setConsentToContact: (value: boolean) => void;
  setReporterType: (type: ReporterType) => void;
  resetDraft: () => void;
}

const AdverseEventReportContext = createContext<
  AdverseEventReportContextValue | undefined
>(undefined);

export const AdverseEventReportProvider: React.FC<{
  children: React.ReactNode;
}> = ({children}) => {
  const [draft, setDraft] = useState<AdverseEventReportDraft>(() =>
    createInitialDraft(),
  );

  const value = useMemo<AdverseEventReportContextValue>(
    () => ({
      draft,
      updateDraft: patch =>
        setDraft(prev => ({
          ...prev,
          ...patch,
        })),
      setProductInfo: info =>
        setDraft(prev => ({
          ...prev,
          productInfo: info,
        })),
      setConsentToContact: consent =>
        setDraft(prev => ({
          ...prev,
          consentToContact: consent,
        })),
      setReporterType: type =>
        setDraft(prev => ({
          ...prev,
          reporterType: type,
        })),
      resetDraft: () => setDraft(createInitialDraft()),
    }),
    [draft],
  );

  return (
    <AdverseEventReportContext.Provider value={value}>
      {children}
    </AdverseEventReportContext.Provider>
  );
};

export const useAdverseEventReport = (): AdverseEventReportContextValue => {
  const ctx = useContext(AdverseEventReportContext);
  if (!ctx) {
    throw new Error(
      'useAdverseEventReport must be used within an AdverseEventReportProvider',
    );
  }
  return ctx;
};
