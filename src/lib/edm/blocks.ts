/**
 * EDM (email marketing) block model + HTML renderer.
 *
 * Campaigns are stored as an ordered list of blocks (WYSIWYG mode) or as raw
 * HTML. On save the client renders blocks to `html_body`, so the sending edge
 * function only ever has to deal with finished HTML.
 */

export type EdmBlockType =
  | "heading"
  | "text"
  | "image"
  | "imageText"
  | "button"
  | "tourCard"
  | "twoColumn"
  | "quote"
  | "divider"
  | "spacer";

export interface EdmBlock {
  id: string;
  type: EdmBlockType;
  /** heading / button / tourCard title */
  text?: string;
  /** rich text (HTML) body */
  html?: string;
  imageUrl?: string;
  imageAlt?: string;
  linkUrl?: string;
  align?: "left" | "center" | "right";
  size?: "sm" | "md" | "lg";
  /** spacer height in px */
  height?: number;
  /** tourCard extras */
  subtitle?: string;
  meta?: string;
}

export interface EdmBrand {
  name: string;
  emailHeaderImageUrl?: string | null;
  colorPrimary?: string | null;
  colorBorder?: string | null;
  colorButton?: string | null;
  colorButtonText?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyWebsite?: string | null;
  footerText?: string | null;
}

export const newBlock = (type: EdmBlockType): EdmBlock => {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading":
      return { id, type, text: "Your headline here", align: "left", size: "lg" };
    case "text":
      return { id, type, html: "<p>Write your message here.</p>" };
    case "image":
      return { id, type, imageUrl: "", imageAlt: "", align: "center" };
    case "imageText":
      return {
        id,
        type,
        imageUrl: "",
        imageAlt: "",
        html: "<p>Describe this tour or offer.</p>",
      };
    case "button":
      return { id, type, text: "Register your interest", linkUrl: "", align: "center" };
    case "tourCard":
      return {
        id,
        type,
        text: "Tour name",
        subtitle: "A short teaser about the tour.",
        meta: "Dates · Location",
        imageUrl: "",
        linkUrl: "",
      };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, height: 24 };
  }
};

export const blockLabel: Record<EdmBlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  imageText: "Image + text",
  button: "Button",
  tourCard: "Tour card",
  divider: "Divider",
  spacer: "Spacer",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const headingSize = (size?: string) =>
  size === "sm" ? "20px" : size === "md" ? "26px" : "32px";

const renderBlock = (b: EdmBlock, brand: EdmBrand): string => {
  const primary = brand.colorPrimary || "#0f172a";
  const button = brand.colorButton || primary;
  const buttonText = brand.colorButtonText || "#ffffff";
  const border = brand.colorBorder || "#e2e8f0";
  const align = b.align || "left";

  switch (b.type) {
    case "heading":
      return `<tr><td style="padding:8px 32px 12px;font-family:Arial,Helvetica,sans-serif;font-size:${headingSize(
        b.size
      )};line-height:1.25;font-weight:700;color:${primary};text-align:${align};">${esc(
        b.text || ""
      )}</td></tr>`;
    case "text":
      return `<tr><td style="padding:8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333333;">${
        b.html || ""
      }</td></tr>`;
    case "image":
      if (!b.imageUrl) return "";
      return `<tr><td style="padding:12px 32px;text-align:${align};"><img src="${esc(
        b.imageUrl
      )}" alt="${esc(b.imageAlt || "")}" width="736" style="display:block;width:100%;max-width:736px;height:auto;border:0;border-radius:6px;margin:0 auto;" /></td></tr>`;
    case "imageText":
      return `<tr><td style="padding:12px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    ${
      b.imageUrl
        ? `<td width="45%" valign="top" style="padding-right:16px;"><img src="${esc(
            b.imageUrl
          )}" alt="${esc(
            b.imageAlt || ""
          )}" style="display:block;width:100%;height:auto;border:0;border-radius:6px;" /></td>`
        : ""
    }
    <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333333;">${
      b.html || ""
    }</td>
  </tr></table></td></tr>`;
    case "button":
      return `<tr><td style="padding:16px 32px;text-align:${b.align || "center"};">
  <a href="${esc(b.linkUrl || "#")}" style="display:inline-block;background:${button};color:${buttonText};font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:6px;">${esc(
        b.text || "Click here"
      )}</a></td></tr>`;
    case "tourCard":
      return `<tr><td style="padding:12px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${border};border-radius:8px;overflow:hidden;">
    ${
      b.imageUrl
        ? `<tr><td><img src="${esc(b.imageUrl)}" alt="${esc(
            b.text || ""
          )}" style="display:block;width:100%;height:auto;border:0;" /></td></tr>`
        : ""
    }
    <tr><td style="padding:20px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:20px;font-weight:700;color:${primary};">${esc(b.text || "")}</div>
      ${
        b.meta
          ? `<div style="font-size:13px;color:#667085;margin-top:4px;">${esc(b.meta)}</div>`
          : ""
      }
      ${
        b.subtitle
          ? `<div style="font-size:15px;line-height:1.6;color:#333333;margin-top:10px;">${esc(
              b.subtitle
            )}</div>`
          : ""
      }
      ${
        b.linkUrl
          ? `<div style="margin-top:16px;"><a href="${esc(
              b.linkUrl
            )}" style="display:inline-block;background:${button};color:${buttonText};font-size:15px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:6px;">Find out more</a></div>`
          : ""
      }
    </td></tr>
  </table></td></tr>`;
    case "divider":
      return `<tr><td style="padding:16px 32px;"><div style="height:1px;background:${border};"></div></td></tr>`;
    case "spacer":
      return `<tr><td style="height:${b.height || 24}px;line-height:${
        b.height || 24
      }px;font-size:0;">&nbsp;</td></tr>`;
    default:
      return "";
  }
};

/**
 * Wrap campaign content in the branded, fluid 800px shell used across ART
 * emails, including the Spam Act sender block and unsubscribe links.
 */
export const renderEdmHtml = (
  blocks: EdmBlock[],
  brand: EdmBrand,
  opts: { subject?: string; preheader?: string } = {}
): string => {
  const border = brand.colorBorder || "#e2e8f0";
  const body = blocks.map((b) => renderBlock(b, brand)).join("\n");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(opts.subject || brand.name)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;">
${
  opts.preheader
    ? `<div style="display:none;font-size:1px;color:#f4f5f7;max-height:0;overflow:hidden;">${esc(
        opts.preheader
      )}</div>`
    : ""
}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:800px;background:#ffffff;border:1px solid ${border};border-radius:10px;overflow:hidden;">
    ${
      brand.emailHeaderImageUrl
        ? `<tr><td><img src="${esc(brand.emailHeaderImageUrl)}" alt="${esc(
            brand.name
          )}" style="display:block;width:100%;height:auto;border:0;" /></td></tr>`
        : ""
    }
    <tr><td style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>
    ${body}
    <tr><td style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:20px 32px;border-top:1px solid ${border};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#667085;">
      <div style="font-weight:700;color:#475467;">${esc(brand.name)}</div>
      ${brand.companyAddress ? `<div>${esc(brand.companyAddress)}</div>` : ""}
      ${brand.companyPhone ? `<div>${esc(brand.companyPhone)}</div>` : ""}
      ${
        brand.companyWebsite
          ? `<div><a href="${esc(brand.companyWebsite)}" style="color:#667085;">${esc(
              brand.companyWebsite
            )}</a></div>`
          : ""
      }
      ${brand.footerText ? `<div style="margin-top:8px;">${brand.footerText}</div>` : ""}
      <div style="margin-top:12px;">
        You are receiving this because you enquired about or travelled with ${esc(brand.name)}.
        <a href="{{preferences_url}}" style="color:#667085;text-decoration:underline;">Email preferences</a> ·
        <a href="{{unsubscribe_url}}" style="color:#667085;text-decoration:underline;">Unsubscribe</a>
      </div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
};
