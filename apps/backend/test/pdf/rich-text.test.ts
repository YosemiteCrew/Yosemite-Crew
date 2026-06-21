import { renderRichText } from "../../../../packages/lib/src/pdf/sections/RichText.js";
import { renderBulletList } from "../../../../packages/lib/src/pdf/sections/BulletList.js";
import { renderParagraph } from "../../../../packages/lib/src/pdf/sections/Text.js";
import type { PdfContext } from "../../../../packages/lib/src/pdf/PdfContext.js";

jest.mock("../../../../packages/lib/src/pdf/sections/BulletList.js", () => ({
  renderBulletList: jest.fn(),
}));

jest.mock("../../../../packages/lib/src/pdf/sections/Text.js", () => ({
  renderParagraph: jest.fn(),
}));

describe("renderRichText", () => {
  const ctx = {
    theme: {
      fontSizes: {
        body: 12,
      },
    },
  } as PdfContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("preserves escaped html-like text without double-unescaping it", () => {
    renderRichText(
      ctx,
      "<p>Fish &amp; chips &amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;</p>",
    );

    expect(renderParagraph).toHaveBeenCalledWith(
      ctx,
      "Fish & chips &lt;script&gt;alert(1)&lt;/script&gt;",
      {
        fontSize: 12,
      },
    );
    expect(renderBulletList).not.toHaveBeenCalled();
  });

  it("strips real html tags while preserving plain text comparisons", () => {
    renderRichText(ctx, "<p>Hello</p> 2 < 3");

    expect(renderParagraph).toHaveBeenCalledWith(ctx, "Hello\n 2 < 3", {
      fontSize: 12,
    });
    expect(renderBulletList).not.toHaveBeenCalled();
  });
});
