export const DEFAULT_PROMPTS = [
  {
    name: "Casual builder",
    isDefault: true,
    instructions: `Casual and direct, like texting a friend who also codes. Lowercase is fine.
Lead with the interesting part, not the setup. One concrete detail beats three vague claims.
No buzzwords ("excited to announce", "game-changer", "leverage"). At most 1 emoji, often none.
End with a link when there is one.`,
  },
  {
    name: "Thoughtful professional",
    isDefault: false,
    instructions: `Clear, warm and confident. Short paragraphs of 1-2 sentences.
Open with a specific observation or result, explain why it matters, and end with a takeaway or a question.
No hype, no humblebrags, no "I'm thrilled". Hashtags only at the end, 3 at most.`,
  },
  {
    name: "Punchy one-liners",
    isDefault: false,
    instructions: `As short as possible. One sharp idea per post.
Strong verbs, no filler words, no hashtags, no emoji.
If it can lose a word without losing meaning, cut it.`,
  },
];
