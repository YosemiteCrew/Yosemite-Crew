import React from "react";

const MOTION_PROPS = new Set([
  "initial",
  "animate",
  "exit",
  "variants",
  "transition",
  "whileHover",
  "whileTap",
  "whileFocus",
  "whileInView",
  "viewport",
  "layout",
  "layoutId",
  "drag",
  "dragConstraints",
  "dragElastic",
  "dragMomentum",
  "onAnimationStart",
  "onAnimationComplete",
  "onUpdate",
  "onTap",
  "onTapStart",
  "onTapCancel",
  "onHoverStart",
  "onHoverEnd",
]);

jest.mock("next/link", () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt = "", src = "", ...rest }: any) => {
    const {
      priority,
      loader,
      fill,
      sizes,
      quality,
      placeholder,
      blurDataURL,
      onLoadingComplete,
      unoptimized,
      ...imgProps
    } = rest;

    return (
      <img alt={alt} src={typeof src === "string" ? src : ""} {...imgProps} />
    );
  },
}));

jest.mock("framer-motion", () => {
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

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, href = "#", onClick, ...props }: any) => (
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

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/CountryDropdown/CountryDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, value, onChange }: any) => (
    <label>
      {placeholder}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));

jest.mock(
  "@/app/components/Inputs/GoogleSearchDropDown/GoogleSearchDropDown",
  () => ({
    __esModule: true,
    default: ({ inlabel, value, onChange }: any) => (
      <label>
        {inlabel}
        <input value={value} onChange={onChange} />
      </label>
    ),
  })
);
