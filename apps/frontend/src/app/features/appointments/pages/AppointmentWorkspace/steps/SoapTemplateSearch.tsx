import type { RefObject } from 'react';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import WorkspaceSearchResultRow from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceSearchResultRow';
import Search from '@/app/ui/inputs/Search';
import type { SoapTemplate } from '@/app/features/appointments/types/workspace';

type SoapTemplateSearchProps = {
  templateSearchRef: RefObject<HTMLDivElement | null>;
  templateQuery: string;
  setTemplateQuery: (value: string) => void;
  templateMatches: SoapTemplate[];
  onSelectTemplate: (templateId: string) => void;
};

const SoapTemplateSearch = ({
  templateSearchRef,
  templateQuery,
  setTemplateQuery,
  templateMatches,
  onSelectTemplate,
}: SoapTemplateSearchProps) => (
  <div className="relative flex justify-end">
    <div ref={templateSearchRef} className="relative w-full sm:max-w-90">
      <Search
        value={templateQuery}
        setSearch={setTemplateQuery}
        placeholder="Search for SOAP template"
        label="Search for SOAP template"
        className="w-full!"
      />
      <SearchResultsDropdown
        anchorRef={templateSearchRef}
        open={templateMatches.length > 0}
        onClose={() => setTemplateQuery('')}
      >
        <ul>
          {templateMatches.map((tpl) => (
            <WorkspaceSearchResultRow
              key={tpl.id}
              name={tpl.name}
              leadingIcon={null}
              onSelect={() => {
                onSelectTemplate(tpl.id);
              }}
            />
          ))}
        </ul>
      </SearchResultsDropdown>
    </div>
  </div>
);

export default SoapTemplateSearch;
