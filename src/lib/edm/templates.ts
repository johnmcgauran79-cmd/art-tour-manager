import type { EdmBlock, EdmBlockType } from "./blocks";

/**
 * Ready-made EDM layouts so staff can start from a designed email instead of a
 * blank canvas (the way Keap/Mailchimp template galleries work).
 */
export interface EdmStarterTemplate {
  key: string;
  name: string;
  description: string;
  subject: string;
  preheader: string;
  build: () => EdmBlock[];
}

const b = (type: EdmBlockType, extra: Partial<EdmBlock> = {}): EdmBlock => ({
  id: crypto.randomUUID(),
  type,
  ...extra,
});

export const edmStarterTemplates: EdmStarterTemplate[] = [
  {
    key: "tour-launch",
    name: "Tour launch",
    description: "Hero image, headline, tour card and a strong call to action.",
    subject: "Just released: {{tour_name}}",
    preheader: "Limited places — register your interest today.",
    build: () => [
      b("image", { imageUrl: "", imageAlt: "Tour hero image", align: "center" }),
      b("heading", { text: "Our newest racing tour is here", size: "lg", align: "left" }),
      b("text", {
        html: "<p>Hi {{first_name}},</p><p>We have just opened places on our newest tour and wanted you to hear about it first.</p>",
      }),
      b("tourCard", {
        text: "Tour name",
        meta: "Dates · Location",
        subtitle: "A short teaser about what makes this tour special.",
        linkUrl: "",
      }),
      b("button", { text: "Register your interest", align: "center", linkUrl: "" }),
      b("divider"),
      b("text", {
        html: "<p>Any questions? Just reply to this email and our team will help.</p>",
      }),
    ],
  },
  {
    key: "newsletter",
    name: "Newsletter",
    description: "Two-column update with a testimonial — great for regular news.",
    subject: "The latest from the racing calendar",
    preheader: "Tour news, results and what's coming up.",
    build: () => [
      b("heading", { text: "This month at the races", size: "md" }),
      b("text", { html: "<p>Hi {{first_name}},</p><p>Here's what we've been up to.</p>" }),
      b("twoColumn", {
        html: "<p><strong>Recent tour</strong></p><p>A quick wrap of how the last tour went.</p>",
        html2: "<p><strong>Coming up</strong></p><p>What's next on the calendar.</p>",
      }),
      b("quote", {
        html: "<p>The best trip we have ever done — every detail was taken care of.</p>",
        text: "Past guest",
      }),
      b("button", { text: "See all upcoming tours", align: "center", linkUrl: "" }),
    ],
  },
  {
    key: "invite",
    name: "Invitation",
    description: "Simple, elegant invitation with image + text and one button.",
    subject: "You're invited: {{tour_name}}",
    preheader: "An exclusive invitation for our travellers.",
    build: () => [
      b("heading", { text: "An invitation just for you", size: "lg", align: "center" }),
      b("imageText", {
        imageUrl: "",
        imageAlt: "Tour image",
        html: "<p>Hi {{first_name}},</p><p>We would love to have you join us. Places are strictly limited.</p>",
      }),
      b("button", { text: "Reserve my place", align: "center", linkUrl: "" }),
      b("spacer", { height: 16 }),
      b("text", { html: "<p style='text-align:center'>Warm regards,<br/>The ART team</p>" }),
    ],
  },
  {
    key: "plain",
    name: "Simple letter",
    description: "Clean text-only email — highest deliverability, personal feel.",
    subject: "A quick note from Australian Racing Tours",
    preheader: "A short personal update.",
    build: () => [
      b("text", {
        html: "<p>Hi {{first_name}},</p><p>Write your message here.</p><p>Kind regards,<br/>Australian Racing Tours</p>",
      }),
    ],
  },
];

/** Merge fields offered in the EDM builder's insert menu. */
export const edmMergeFields: { token: string; label: string }[] = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{last_name}}", label: "Last name" },
  { token: "{{email}}", label: "Email address" },
  { token: "{{state}}", label: "State" },
  { token: "{{latest_tour_name}}", label: "Latest tour travelled" },
  { token: "{{unsubscribe_url}}", label: "Unsubscribe link" },
  { token: "{{preferences_url}}", label: "Email preferences link" },
];
