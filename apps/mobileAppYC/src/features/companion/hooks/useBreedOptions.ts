// src/features/companion/hooks/useBreedOptions.ts
//
// Breed lookup for a companion category, with the three states the picker has
// to tell apart: loading, failed, and "this species genuinely has no breeds".
//
// Extracted from AddCompanionScreen because the failure here is not cosmetic.
// The lookup reads a token first and returns early when there is none, so a
// failed token read sends ZERO breed traffic - the request the user is waiting
// for is never made. Breed is a required field, so before this the picker could
// only say the lookup failed and the form could not be completed at all. A
// retry has to exist, and it has to be testable: the screen it came from is
// over 1300 lines and sits in sonar.coverage.exclusions.
//
// The category-to-species maps stay with their screens and are passed in, so
// this hook does not have an opinion about where they live.

import {useCallback, useEffect, useRef, useState} from 'react';

import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import {
  fetchBreedCodeEntries,
  type BreedCodeEntry,
} from '@/features/companion/services/codeEntriesService';
import type {Breed, CompanionCategory} from '@/features/companion/types';

export interface UseBreedOptionsParams {
  category: CompanionCategory | null;
  /** Species term the breed endpoint expects for this category. */
  speciesQueryFor: (category: CompanionCategory) => string;
  /** Human-facing species name stored on each mapped breed. */
  speciesLabelFor: (category: CompanionCategory) => string;
  /** Species code to fall back to when an entry carries none. */
  speciesCodeFor?: (category: CompanionCategory) => string | undefined;
}

export interface UseBreedOptionsResult {
  breedOptions: Breed[];
  /** The lookup failed, as opposed to returning an empty list. */
  breedLoadFailed: boolean;
  breedLoading: boolean;
  /** Re-run the lookup for the current category. */
  retryBreeds: () => void;
}

export const useBreedOptions = ({
  category,
  speciesQueryFor,
  speciesLabelFor,
  speciesCodeFor,
}: UseBreedOptionsParams): UseBreedOptionsResult => {
  const [breedOptions, setBreedOptions] = useState<Breed[]>([]);
  const [breedLoadFailed, setBreedLoadFailed] = useState(false);
  const [breedLoading, setBreedLoading] = useState(false);

  // Bumped on every lookup. A response only wins while its ticket is still the
  // current one, so switching category mid-flight cannot land the old
  // category's breeds on the new one.
  const requestTicket = useRef(0);

  // Held in a ref so changing callback identities cannot restart the effect and
  // refetch on every render.
  const resolvers = useRef({speciesQueryFor, speciesLabelFor, speciesCodeFor});
  resolvers.current = {speciesQueryFor, speciesLabelFor, speciesCodeFor};

  const load = useCallback(async (targetCategory: CompanionCategory) => {
    const ticket = ++requestTicket.current;
    const isCurrent = () => requestTicket.current === ticket;

    setBreedLoading(true);
    try {
      const tokens = await getFreshStoredTokens();
      if (!tokens?.accessToken) {
        // The zero-traffic path: no request is sent at all. It still has to be
        // reported as a retryable failure, not as an empty list.
        if (isCurrent()) {
          setBreedOptions([]);
          setBreedLoadFailed(true);
        }
        return;
      }

      const entries = await fetchBreedCodeEntries(
        resolvers.current.speciesQueryFor(targetCategory),
        tokens.accessToken,
      );
      if (!isCurrent()) {
        return;
      }

      setBreedOptions(
        entries.map((entry: BreedCodeEntry, index: number) => ({
          speciesId: index + 1,
          speciesName: resolvers.current.speciesLabelFor(targetCategory),
          breedId: index + 1,
          breedName: entry.display,
          speciesCode:
            entry.meta?.speciesCode ??
            resolvers.current.speciesCodeFor?.(targetCategory),
          breedCode: entry.code,
        })),
      );
      setBreedLoadFailed(false);
    } catch (error) {
      if (isCurrent()) {
        setBreedOptions([]);
        setBreedLoadFailed(true);
      }
      console.warn('[Companion] Unable to load breed code entries', error);
    } finally {
      if (isCurrent()) {
        setBreedLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!category) {
      // Invalidate anything in flight, so a late response cannot repopulate the
      // picker after the user cleared the category.
      requestTicket.current += 1;
      setBreedOptions([]);
      setBreedLoadFailed(false);
      setBreedLoading(false);
      return;
    }

    load(category).catch(() => undefined);
  }, [category, load]);

  const retryBreeds = useCallback(() => {
    // Guarded so an impatient second tap cannot fire a duplicate lookup.
    if (!category || breedLoading) {
      return;
    }
    load(category).catch(() => undefined);
  }, [category, breedLoading, load]);

  return {breedOptions, breedLoadFailed, breedLoading, retryBreeds};
};
