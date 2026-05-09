/* eslint-disable @next/next/no-img-element */
import React from 'react';

const MOTION_PROPS = new Set([
  'initial',
  'animate',
  'exit',
  'variants',
  'transition',
  'whileHover',
  'whileTap',
  'whileFocus',
  'whileInView',
  'viewport',
  'layout',
  'layoutId',
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
  'onAnimationStart',
  'onAnimationComplete',
  'onUpdate',
  'onTap',
  'onTapStart',
  'onTapCancel',
  'onHoverStart',
  'onHoverEnd',
]);

jest.mock('next/link', () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt = '', src = '', ...rest }: any) => {
    const {
      priority: _priority,
      loader: _loader,
      fill: _fill,
      sizes: _sizes,
      quality: _quality,
      placeholder: _placeholder,
      blurDataURL: _blurDataURL,
      onLoadingComplete: _onLoadingComplete,
      unoptimized: _unoptimized,
      ...imgProps
    } = rest;

    return <img alt={alt} src={typeof src === 'string' ? src : ''} {...imgProps} />;
  },
}));

jest.mock('framer-motion', () => {
  const make =
    (tag: string) =>
    ({ children, ...props }: any) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(props)) {
        if (!MOTION_PROPS.has(k)) clean[k] = v;
      }
      return React.createElement(tag, clean, children);
    };

  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => make(tag),
    }
  );

  const AnimatePresence = ({ children }: any) => <>{children}</>;

  return { motion, AnimatePresence };
});

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, href = '#', onClick, ...props }: any) => (
    <a
      data-testid="primary-btn"
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
      {...props}
    >
      {text}
    </a>
  ),
  Secondary: ({ text, onClick, ...props }: any) => (
    <button type="button" onClick={(e) => onClick?.(e)} {...props}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/Dropdown', () => ({
  __esModule: true,
  default: ({ placeholder, value, onChange }: any) => (
    <label>
      {placeholder}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} />
    </label>
  ),
}));
