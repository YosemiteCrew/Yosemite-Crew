'use client';

import { useState } from 'react';
import { IoCheckmark, IoChevronDown } from 'react-icons/io5';

import FilterChip from '@/app/ui/filters/FilterChip';
import Search from '@/app/ui/inputs/Search';
import BottomSheet from '@/app/ui/layout/PhoneShell/BottomSheet';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';

export type GuideFiltersProps = {
  personas: string[];
  activePersona: string;
  setActivePersona: (persona: string) => void;
  categories: string[];
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  search: string;
  setSearch: (value: string) => void;
};

type Group = {
  key: 'persona' | 'category';
  legend: string;
  options: string[];
  active: string;
  onPick: (value: string) => void;
};

/* One row of the phone sheet. `yc-menu-row` is the same row the account menu
   uses, so the list reads like the rest of the product. */
const SheetRow = ({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    role="menuitemradio"
    aria-checked={selected}
    className="yc-menu-row w-full justify-between text-left"
    style={{
      color: selected ? 'var(--ink)' : 'var(--ink-muted)',
      fontWeight: selected ? 700 : 500,
    }}
  >
    {label}
    {selected && <IoCheckmark size={16} aria-hidden />}
  </button>
);

const PhoneTrigger = ({ group, onOpen }: { group: Group; onOpen: () => void }) => (
  <button
    type="button"
    onClick={onOpen}
    className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-full border px-[15px] py-[9px] text-[12.5px] font-semibold"
    style={{ borderColor: 'var(--hairline)', color: 'var(--ink)' }}
  >
    <span className="truncate">
      <span className="font-normal" style={{ color: 'var(--ink-faint)' }}>
        {group.legend}{' '}
      </span>
      {group.active}
    </span>
    <IoChevronDown size={14} aria-hidden style={{ color: 'var(--ink-faint)' }} />
  </button>
);

/**
 * The Guides filters, which are two different controls at two widths.
 *
 * Desktop keeps the chip rows. On a 375px phone those same chips wrapped to
 * NINE rows - seven personas over three, thirteen categories over six - which
 * is around half the screen of filter chrome before the first video card, so
 * the page opened on a wall of options with nothing to watch. The phone gets
 * two compact triggers on one row instead, each opening the product's own
 * bottom sheet with the options as a list.
 */
const GuideFilters = ({
  personas,
  activePersona,
  setActivePersona,
  categories,
  activeCategory,
  setActiveCategory,
  search,
  setSearch,
}: GuideFiltersProps) => {
  const isPhone = useIsPhone();
  const [openGroup, setOpenGroup] = useState<Group['key'] | null>(null);

  const groups: Group[] = [
    {
      key: 'persona',
      legend: 'For',
      options: personas,
      active: activePersona,
      onPick: setActivePersona,
    },
    {
      key: 'category',
      legend: 'Topic',
      options: categories,
      active: activeCategory,
      onPick: setActiveCategory,
    },
  ];

  if (isPhone) {
    const open = groups.find((group) => group.key === openGroup);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {groups
            .filter((group) => group.options.length > 1)
            .map((group) => (
              <PhoneTrigger key={group.key} group={group} onOpen={() => setOpenGroup(group.key)} />
            ))}
        </div>
        <Search
          value={search}
          setSearch={setSearch}
          className="!w-full"
          placeholder="Search guides"
        />
        <BottomSheet
          open={open !== undefined}
          title={open?.key === 'persona' ? 'Show guides for' : 'Show guides about'}
          onClose={() => setOpenGroup(null)}
        >
          <div role="menu" className="flex flex-col">
            {open?.options.map((option) => (
              <SheetRow
                key={option}
                label={option}
                selected={option === open.active}
                onClick={() => {
                  open.onPick(option);
                  setOpenGroup(null);
                }}
              />
            ))}
          </div>
        </BottomSheet>
      </div>
    );
  }

  return (
    <>
      {/* Two rows, because they answer different questions: who are you, then
          what are you trying to do. Personas lead, since a viewer picks their
          own track once and then browses within it. */}
      {personas.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
            For
          </span>
          {personas.map((persona) => (
            <FilterChip
              key={persona}
              label={persona}
              active={persona === activePersona}
              onClick={() => setActivePersona(persona)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((category) => {
            const isActive = category === activeCategory;
            return (
              <button
                type="button"
                key={category}
                onClick={() => setActiveCategory(category)}
                className="rounded-full border px-[15px] py-[7px] text-[12.5px] transition-colors"
                style={
                  isActive
                    ? {
                        backgroundColor: 'var(--inset)',
                        borderColor: 'var(--divider)',
                        color: 'var(--ink)',
                        fontWeight: 700,
                      }
                    : {
                        borderColor: 'var(--hairline)',
                        color: 'var(--ink-muted)',
                        fontWeight: 600,
                      }
                }
              >
                {category}
              </button>
            );
          })}
        </div>
        <Search
          value={search}
          setSearch={setSearch}
          className="!w-full sm:!w-[240px]"
          placeholder="Search guides"
        />
      </div>
    </>
  );
};

export default GuideFilters;
