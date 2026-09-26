/**
 * The no-JavaScript floor for the phone disclosure, served inside `<noscript>`
 * by `DocsSidebar`. It lives in its own module so the component file exports
 * only the component.
 *
 * Below 860px the tree is hidden by a media query keyed on `data-open`, and
 * `data-open` is React state whose server-rendered value is `false`. With
 * scripting off nothing can ever change it, and the only control that would is
 * a button with nothing behind it but an `onClick` handler - so the whole
 * documentation navigation is unreachable, anchors present in the DOM or not.
 * These two rules put it back to what it was before the disclosure existed:
 * the full tree above the article, and no dead control offered.
 *
 * It has to be `<noscript>`, not a rule in `docs.css`, because CSS cannot
 * distinguish "scripting is off" from "React has not hydrated yet". Serving
 * `data-open="true"` and collapsing it in an effect would read the same to the
 * cascade, and would flash the entire tree above the article on every phone
 * load - which is the defect the disclosure was added to remove.
 *
 * Quote-free and `&<>`-free on purpose: this is the text content of a raw-text
 * element, so an escaped `'` would ship as `&#x27;` and silently void the
 * selector it sits in. `[data-open=false]` is an unquoted attribute value,
 * which is valid CSS because `false` is a valid identifier.
 *
 * The last two rules reach a section declared `collapsed` - today the largest
 * in the tree - whose links were unreachable with scripting off until the
 * `hidden` attribute that closed it became `data-expanded`. `hidden` could not be overridden from here at any
 * specificity or importance: Tailwind's preflight declares
 * `[hidden]{display:none!important}` inside `@layer base`, and for the
 * important origin the cascade inverts - a layered important declaration beats
 * an unlayered one, so a `<style>` in the body always loses. `docs.css` closes
 * the section with an ordinary unlayered rule instead, which this outranks on
 * specificity alone. The chevron goes with it because it is a `+` drawn from
 * React state: left in place it would sit over content it says is closed.
 *
 * What stays wrong here, knowingly: the section head keeps
 * `aria-expanded="false"` over a body this reveals, because that attribute is
 * React state and no stylesheet can reach it. A wrong state hint on a control
 * that cannot work either way is a smaller defect than a whole section of
 * documented endpoints no scripting-off reader can open, and the alternative -
 * hiding the head, as this does to the phone toggle - would delete the only
 * group label those endpoints have. See issue #3515.
 */
export const DOCS_NAV_NO_JS_CSS = [
  '.DocsNav .DocsNavToggle{display:none}',
  '.DocsNav .DocsNavTree[data-open=false]{display:block}',
  '.DocsNav .DocsNavSection [data-expanded=false]{display:block}',
  '.DocsNav .DocsNavChevron{display:none}',
].join('');
