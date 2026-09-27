'use client';
import React, { createContext, useContext } from 'react';

import {
  EXTENSION_POINTS,
  contributionsFor,
  type ExtensionPointId,
  type PluginContribution,
} from '@/app/features/plugins/extensionPoints';

const NO_CONTRIBUTIONS: readonly PluginContribution[] = [];

/** Supplies the contributions of the plugins the practice has installed. */
export const PluginContributionsContext =
  createContext<readonly PluginContribution[]>(NO_CONTRIBUTIONS);

type PluginSlotProps = {
  point: ExtensionPointId;
};

/**
 * Renders what installed plugins contribute at one declared extension point, and
 * nothing at all when there is none. Panels show inline; actions open the plugin
 * in a new tab.
 */
const PluginSlot = ({ point }: Readonly<PluginSlotProps>) => {
  const contributions = contributionsFor(point, useContext(PluginContributionsContext));
  if (contributions.length === 0) return null;

  if (EXTENSION_POINTS[point].kind === 'action') {
    return (
      <div className="flex flex-wrap gap-2" data-plugin-slot={point}>
        {contributions.map((c) => (
          <a
            key={`${c.pluginId}:${c.title}`}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-9 items-center rounded-full border border-(--divider) px-4 text-[12.5px] font-semibold text-(--ink-body) hover:border-(--blue) hover:text-(--blue-text)"
          >
            {c.title}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-plugin-slot={point}>
      {contributions.map((c) => (
        <section
          key={`${c.pluginId}:${c.title}`}
          aria-label={c.title}
          className="flex flex-col gap-2"
        >
          <h2 className="text-[13.5px] font-semibold text-text-primary">
            {c.title}
            <span className="ml-2 font-normal text-text-secondary">{c.pluginName}</span>
          </h2>
          <iframe
            src={c.url}
            title={c.title}
            className="h-80 w-full rounded-2xl border border-(--divider)"
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-forms"
          />
        </section>
      ))}
    </div>
  );
};

export default PluginSlot;
