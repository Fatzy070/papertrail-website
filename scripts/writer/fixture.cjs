const text =
  "The Papertrail team is preparing a practical guide for small businesses that manage important documents every day. Clear writing makes responsibilities easier to understand, reduces unnecessary follow-up, and gives each reader a reliable record of the next step. We review the draft together, check the details carefully, and keep the final document simple enough to use in a busy working day. ";
const paragraph = (value = text) => ({
  type: "paragraph",
  content: [{ type: "text", text: value }],
});
const heading = (value, level) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text: value }],
});
const fixture = {
  type: "doc",
  content: [
    heading("A clearer way to work", 1),
    paragraph(),
    paragraph(),
    heading("A shared approach", 2),
    paragraph(text.repeat(7)),
    {
      type: "bulletList",
      content: [
        "Confirm the purpose",
        "Review the evidence",
        "Agree on the next step",
      ].map((s) => ({ type: "listItem", content: [paragraph(s)] })),
    },
    {
      type: "orderedList",
      attrs: { start: 1 },
      content: [
        "Prepare a draft",
        "Check the details",
        "Publish the final copy",
      ].map((s) => ({ type: "listItem", content: [paragraph(s)] })),
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Be clear. ", marks: [{ type: "bold" }] },
        { type: "text", text: "Be thoughtful. ", marks: [{ type: "italic" }] },
        {
          type: "text",
          text: "Keep a record. ",
          marks: [{ type: "underline" }],
        },
        {
          type: "text",
          text: "Reference guide",
          marks: [
            { type: "link", attrs: { href: "https://example.com/guide" } },
          ],
        },
      ],
    },
    { type: "pageBreak" },
    heading("The next chapter", 2),
    ...Array.from({ length: 12 }, () => paragraph()),
  ],
};
module.exports = { fixture, paragraph, text };
