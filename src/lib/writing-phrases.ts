/**
 * Writing Lab "learning mode" phrase bank — curated functional language per
 * Trinity genre. Static on purpose: instant, free and always correct.
 */

export type GenreFamily =
  | "descriptive-essay" | "discursive-essay" | "argumentative-essay" | "article"
  | "formal-letter" | "informal-letter" | "review" | "report" | "proposal" | "critique";

export interface PhraseSection {
  title: string;
  phrases: string[];
}

export interface GenreGuide {
  structure: string[];
  register: string;
  sections: PhraseSection[];
}

/**
 * Text to drop into the editor for a bank phrase: first alternative only
 * ("A / B", "x · y"), no grammar hints like "(+ base form)", and a space
 * before a placeholder ("is to…" → "is to …") so typing over the selected
 * "…" doesn't glue words together.
 */
export function phraseForInsert(phrase: string): string {
  return phrase
    .split(/\s+[/·]\s+/)[0]
    .replace(/\s*\(\+[^)]*\)/g, "")
    .replace(/(\S)…/g, "$1 …")
    .trim();
}

/** Map a Trinity genre label ("formal email or letter", "essay", …) to its guide. */
export function genreFamily(genre: string): GenreFamily {
  const g = genre.toLowerCase();
  if (g.includes("descriptive")) return "descriptive-essay";
  if (g.includes("argumentative")) return "argumentative-essay";
  if (g.includes("discursive") || g === "essay") return "discursive-essay";
  if (g.includes("article")) return "article";
  if (g.includes("informal")) return "informal-letter";
  if (g.includes("formal") || g.includes("letter") || g.includes("email")) return "formal-letter";
  if (g.includes("review")) return "review";
  if (g.includes("proposal")) return "proposal";
  if (g.includes("critique")) return "critique";
  return "report";
}

const RANGE_BOOSTERS: PhraseSection = {
  title: "Range boosters (C1 grammar)",
  phrases: [
    "Not only does it…, but it also…",
    "Rarely do we stop to consider…",
    "What concerns me most is…",
    "It is precisely this … that…",
    "Having considered both sides, …",
    "Were this to happen, …",
    "Had … been introduced earlier, …",
  ],
};

const LINKING: PhraseSection = {
  title: "Linking & cohesion",
  phrases: [
    "Having said that, …",
    "This, in turn, leads to…",
    "In the same vein, …",
    "Owing to the fact that…",
    "Consequently, … / As a result, …",
    "Whereas … , …",
    "Notwithstanding …, …",
  ],
};

export const GENRE_GUIDES: Record<GenreFamily, GenreGuide> = {
  "discursive-essay": {
    structure: [
      "Introduction: present the issue and why it matters (paraphrase the question).",
      "Body 1: arguments for — topic sentence + example.",
      "Body 2: arguments against — topic sentence + example.",
      "Conclusion: balanced summary + your own view.",
    ],
    register: "Formal and impersonal: no contractions; prefer impersonal structures to “I think”.",
    sections: [
      {
        title: "Introducing the topic",
        phrases: [
          "In recent years, there has been growing concern over…",
          "… has become a subject of considerable debate.",
          "It is widely acknowledged that…",
          "This essay will examine both sides of the argument.",
        ],
      },
      {
        title: "Presenting arguments",
        phrases: [
          "Proponents of … argue that…",
          "One compelling argument in favour of … is that…",
          "There is a strong case for…",
          "It could be argued that…",
        ],
      },
      {
        title: "The other side",
        phrases: [
          "Conversely, critics contend that…",
          "Nevertheless, it would be naïve to ignore…",
          "Opponents are quick to point out that…",
          "That is not to say, however, that…",
        ],
      },
      {
        title: "Examples & hedging",
        phrases: [
          "A case in point is…",
          "This is particularly true of…",
          "… tends to / is likely to…",
          "To a certain extent, …",
          "Arguably, …",
        ],
      },
      {
        title: "Concluding",
        phrases: [
          "All things considered, …",
          "On balance, it would seem that…",
          "Weighing up both sides, I would argue that…",
          "In the final analysis, …",
        ],
      },
      LINKING,
      RANGE_BOOSTERS,
    ],
  },
  "argumentative-essay": {
    structure: [
      "Introduction: state your position clearly (thesis).",
      "Body 1–2: one argument per paragraph, each with evidence or an example.",
      "Body 3: acknowledge the opposing view and refute it.",
      "Conclusion: restate your thesis in new words and end strongly.",
    ],
    register: "Formal and assertive, but measured: strong claims backed by reasons.",
    sections: [
      {
        title: "Stating your position",
        phrases: [
          "I firmly believe that…",
          "There can be little doubt that…",
          "It is my contention that…",
          "This essay will argue that…",
        ],
      },
      {
        title: "Supporting arguments",
        phrases: [
          "The most convincing argument is that…",
          "Compelling evidence suggests that…",
          "This is borne out by…",
          "Equally important is the fact that…",
        ],
      },
      {
        title: "Refuting the opposition",
        phrases: [
          "While some may claim that…, this view fails to take into account…",
          "This argument does not hold up because…",
          "Admittedly, …; however, …",
          "Such a view overlooks…",
        ],
      },
      {
        title: "Concluding",
        phrases: [
          "It is for these reasons that…",
          "Ultimately, …",
          "It is high time that we (+ past simple)…",
          "The evidence clearly points to…",
        ],
      },
      LINKING,
      RANGE_BOOSTERS,
    ],
  },
  "descriptive-essay": {
    structure: [
      "Introduction: what you are describing and why it matters.",
      "Body: one aspect per paragraph (place / people / atmosphere / significance).",
      "Conclusion: your overall impression and why it stays with you.",
    ],
    register: "Neutral to formal, rich in precise vocabulary; vivid but controlled.",
    sections: [
      {
        title: "Setting the scene",
        phrases: [
          "What strikes one first about … is…",
          "… is renowned for…",
          "Steeped in history, …",
          "At the heart of … lies…",
        ],
      },
      {
        title: "Describing precisely",
        phrases: [
          "… exudes an atmosphere of…",
          "What makes … truly unique is…",
          "bustling · picturesque · understated · run-down · breathtaking",
          "a far cry from…",
        ],
      },
      {
        title: "Significance & conclusion",
        phrases: [
          "It is hardly surprising that…",
          "… left a lasting impression on me.",
          "Above all, … represents…",
          "It is this … that makes it so special.",
        ],
      },
      LINKING,
      RANGE_BOOSTERS,
    ],
  },
  article: {
    structure: [
      "Catchy title.",
      "Hook: a question, a striking fact or a short anecdote.",
      "Body: clear topic sentences (optional subheadings), speak to the reader.",
      "Ending: a memorable final thought, call to action or question.",
    ],
    register: "Engaging and semi-formal: direct address (you), rhetorical questions, some idioms.",
    sections: [
      {
        title: "Hooking the reader",
        phrases: [
          "Have you ever wondered why…?",
          "Picture the scene: …",
          "Believe it or not, …",
          "Let's face it: …",
        ],
      },
      {
        title: "Developing ideas",
        phrases: [
          "The truth is that…",
          "Here's the thing: …",
          "Take … , for instance.",
          "It's no secret that…",
        ],
      },
      {
        title: "Ending",
        phrases: [
          "So, what can be done?",
          "Next time you…, think about…",
          "It's certainly food for thought.",
          "The ball is in our court.",
        ],
      },
      LINKING,
      RANGE_BOOSTERS,
    ],
  },
  "formal-letter": {
    structure: [
      "Greeting: Dear Mr/Ms … / Dear Sir or Madam.",
      "Paragraph 1: the reason for writing.",
      "Body: one point per paragraph, with details.",
      "Final paragraph: what you expect / request.",
      "Sign-off: Yours sincerely (name known) / Yours faithfully (Sir or Madam).",
    ],
    register: "Formal and polite: no contractions, indirect requests.",
    sections: [
      {
        title: "Reason for writing",
        phrases: [
          "I am writing with regard to…",
          "I am writing to express my concern about…",
          "I would like to draw your attention to…",
          "Further to your advertisement in…, …",
        ],
      },
      {
        title: "Making your point",
        phrases: [
          "I should point out that…",
          "Furthermore, I wish to complain about…",
          "I was particularly disappointed to find that…",
          "It would be highly beneficial if…",
        ],
      },
      {
        title: "Requests & closing",
        phrases: [
          "I would be grateful if you could…",
          "I trust that you will give this matter your urgent attention.",
          "Please do not hesitate to contact me should you require…",
          "I look forward to hearing from you.",
        ],
      },
      LINKING,
    ],
  },
  "informal-letter": {
    structure: [
      "Greeting: Hi / Dear + first name.",
      "Opening: react to their news or message.",
      "Body: cover each point they asked about.",
      "Closing remarks + sign-off (Take care / Best wishes).",
    ],
    register: "Friendly: contractions, phrasal verbs and idioms — but still organised in paragraphs.",
    sections: [
      {
        title: "Opening",
        phrases: [
          "Thanks so much for your email — it was great to hear from you!",
          "Sorry I haven't been in touch for ages.",
          "Guess what?",
          "Anyway, the reason I'm writing is…",
        ],
      },
      {
        title: "Advice & news",
        phrases: [
          "If I were you, I'd…",
          "Why don't you…?",
          "You'll never believe…",
          "By the way, …",
        ],
      },
      {
        title: "Closing",
        phrases: [
          "Anyway, I'd better get going.",
          "Can't wait to see you!",
          "Give my love to…",
          "Write back soon! / Take care / Best wishes",
        ],
      },
    ],
  },
  review: {
    structure: [
      "Title + intro: what you are reviewing and the context.",
      "Description: plot / features — no spoilers.",
      "Evaluation: strengths and weaknesses with examples.",
      "Recommendation: who it is for, final verdict.",
    ],
    register: "Neutral to semi-formal; evaluative adjectives and a clear opinion.",
    sections: [
      {
        title: "Describing",
        phrases: [
          "… is set in…",
          "The plot revolves around…",
          "Directed by…, the film…",
          "At its core, … is a story about…",
        ],
      },
      {
        title: "Evaluating",
        phrases: [
          "What makes it stand out is…",
          "The performances are nothing short of outstanding.",
          "Where it falls short is…",
          "It is let down by…",
          "Despite a slow start, …",
        ],
      },
      {
        title: "Recommending",
        phrases: [
          "Overall, … is well worth…",
          "I would wholeheartedly recommend it to anyone who…",
          "If you're into…, this is a must-see.",
          "It may not appeal to everyone, but…",
        ],
      },
      LINKING,
    ],
  },
  report: {
    structure: [
      "Title (To / From / Subject if appropriate).",
      "Introduction: purpose of the report and how information was gathered.",
      "Headed sections: findings, one area per section.",
      "Conclusion & recommendations.",
    ],
    register: "Formal and impersonal: headings, passive forms, bullet points are fine.",
    sections: [
      {
        title: "Purpose",
        phrases: [
          "The aim of this report is to…",
          "This report sets out to examine…",
          "The information was gathered from…",
        ],
      },
      {
        title: "Findings",
        phrases: [
          "It was found that…",
          "According to the survey, the majority of…",
          "A significant proportion of respondents…",
          "Only a small minority…",
          "… was cited as the main reason for…",
        ],
      },
      {
        title: "Recommendations",
        phrases: [
          "In light of these findings, …",
          "It is therefore recommended that … (+ base form)",
          "It would be advisable to…",
          "To sum up, …",
        ],
      },
      LINKING,
    ],
  },
  proposal: {
    structure: [
      "Title + introduction: what you propose and why.",
      "Current situation / problem.",
      "Proposal: details, benefits, how to implement it.",
      "Conclusion: why it should be approved.",
    ],
    register: "Formal and persuasive, forward-looking.",
    sections: [
      {
        title: "Proposing",
        phrases: [
          "The purpose of this proposal is to put forward…",
          "I would propose that…",
          "One possible solution would be to…",
        ],
      },
      {
        title: "Benefits & implementation",
        phrases: [
          "This would not only… but also…",
          "The main benefit would be…",
          "In order to implement this, …",
          "The initial outlay would be offset by…",
        ],
      },
      {
        title: "Concluding",
        phrases: [
          "I am confident that … would…",
          "Given the advantages outlined above, …",
        ],
      },
      LINKING,
      RANGE_BOOSTERS,
    ],
  },
  critique: {
    structure: [
      "Introduction: the work and its central claim.",
      "Summary of the main argument.",
      "Evaluation: strengths, then weaknesses, with evidence.",
      "Conclusion: overall judgement.",
    ],
    register: "Formal, analytical and balanced.",
    sections: [
      {
        title: "Presenting the work",
        phrases: [
          "The author contends that…",
          "The central premise is that…",
          "The piece sets out to…",
        ],
      },
      {
        title: "Evaluating",
        phrases: [
          "While the argument is persuasive in…, it overlooks…",
          "On closer inspection, …",
          "A notable weakness is…",
          "The evidence presented is largely anecdotal.",
        ],
      },
      {
        title: "Concluding",
        phrases: [
          "In sum, the piece succeeds in… but…",
          "Ultimately, the argument would be strengthened by…",
        ],
      },
      LINKING,
      RANGE_BOOSTERS,
    ],
  },
};

/** Extra section for Task 3 (Reading into Writing): referring to and combining the source texts. */
export const READING_INTO_WRITING_SECTION: PhraseSection = {
  title: "Using the texts (Task 3)",
  phrases: [
    "According to the blog post, …",
    "The article highlights…",
    "As the infographic shows, …",
    "Both the forum post and the article suggest that…",
    "In contrast to text B, text C…",
    "The figures in text D reveal that…",
    "Paraphrase — never copy whole sentences from the texts.",
  ],
};
