Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

Using slow regular expressions is security-sensitivetypescript:S5852
Status: To Review
This Security Hotspot needs to be reviewed to assess whether the code poses a risk.
Review priority:
Medium
Category:
Denial of Service (DoS)
Assignee:
Harshit Wandhare
Harshit Wandhare
Where is the risk?
What's the risk?
Assess the risk
How can I fix it?
Activity
src/.../features/integrations/pages/MerckManuals/index.tsx



'
Show 36 lines

- Show all lines
  const RECENT_SEARCHES_LIMIT = 8;
  const stripHtml = (value: string) =>
  value
  .replaceAll(/<[^>]\*>/g, ' ')
  Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

      .replaceAll(/\s+/g, ' ')
      .trim();

  const getRecentSearchesKey = (orgId: string, audience: MerckAudience) =>
  `yc:merck:recent:${orgId}:${audience}`;

%
Show 581 lines

- Show all lines

Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

Using slow regular expressions is security-sensitivetypescript:S5852
Status: To Review
This Security Hotspot needs to be reviewed to assess whether the code poses a risk.
Review priority:
Medium
Category:
Denial of Service (DoS)
Assignee:
Harshit Wandhare
Harshit Wandhare
Where is the risk?
What's the risk?
Assess the risk
How can I fix it?
Activity
src/app/features/integrations/services/merckService.ts



'
Show 58 lines

- Show all lines
  })),
  });
  const stripHtml = (value: string): string =>
  String(value ?? '')
  .replaceAll(/<[^>]\*>/g, ' ')
  Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

      .replaceAll(/\s+/g, ' ')
      .trim();

  const extractSummaryTextFromHtml = (html: string): string => {
  const firstParagraphMatch = String(html ?? '').match(/<p[^>]_>(._?)<\/p>/i);

%
Show 264 lines

- Show all lines

Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

Using slow regular expressions is security-sensitivetypescript:S5852
Status: To Review
This Security Hotspot needs to be reviewed to assess whether the code poses a risk.
Review priority:
Medium
Category:
Denial of Service (DoS)
Assignee:
Harshit Wandhare
Harshit Wandhare
Where is the risk?
What's the risk?
Assess the risk
How can I fix it?
Activity
src/app/features/integrations/services/merckService.ts



'
Show 112 lines

- Show all lines
  };
  const canonicalUrlKey = (value: string): string => {
  try {
  const parsed = new URL(value);
  const pathname = parsed.pathname.replaceAll(/\/+$/g, '') || '/';
  Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

      return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}?${parsed.searchParams.toString()}#${parsed.hash.replace(/^#/, '')}`;

  } catch {
  return value.trim();
  }
  };

%
Show 210 lines

Make sure that 'javascript:' code is safe as it is a form of eval().

Dynamically executing code is security-sensitivetypescript:S1523
Status: To Review
This Security Hotspot needs to be reviewed to assess whether the code poses a risk.
Review priority:
Medium
Category:
Code Injection (RCE)
Assignee:
Harshit Wandhare
Harshit Wandhare
Where is the risk?
What's the risk?
Assess the risk
How can I fix it?
Activity
src/app/ui/layout/RouteLoaderOverlay.tsx



'
Show 27 lines

- Show all lines
  const rawHref = anchor.getAttribute('href') ?? '';
  if (
  rawHref.startsWith('#') ||
  rawHref.startsWith('mailto:') ||
  rawHref.startsWith('tel:') ||
  rawHref.startsWith('javascript:')
  Make sure that 'javascript:' code is safe as it is a form of eval().

        ) {
          return;
        }
        let nextUrl: URL;

%
Show 49 lines

- Show all lines
