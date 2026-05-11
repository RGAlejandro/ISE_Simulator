import type { ExamLevel, OralTaskType } from "@/types";

const levelConfig: Record<ExamLevel, {
  cefr: string;
  topicDuration: string;
  subjectAreas: string;
  complexity: string;
  listeningLength: string;
}> = {
  ISE_FOUNDATION: {
    cefr: "A2",
    topicDuration: "2 minutes",
    subjectAreas: "daily life, hobbies, family, food, travel basics",
    complexity: "Simple questions, short answers expected, present tenses mostly",
    listeningLength: "30-60 seconds",
  },
  ISE_I: {
    cefr: "B1",
    topicDuration: "3 minutes",
    subjectAreas: "education, work, health, environment basics, media, sports",
    complexity: "Moderate follow-up questions, varied tenses, some opinions expected",
    listeningLength: "60-90 seconds",
  },
  ISE_II: {
    cefr: "B2",
    topicDuration: "4 minutes",
    subjectAreas: "social issues, technology, culture, environment, globalization, youth issues",
    complexity: "Complex follow-ups, abstract topics, opinions with justification, conditional structures",
    listeningLength: "90-120 seconds",
  },
  ISE_III: {
    cefr: "C1",
    topicDuration: "4 minutes",
    subjectAreas: "economics, ethics, science, philosophy, global politics, arts, education policy",
    complexity: "Sophisticated probing questions, nuanced discussion, academic register expected",
    listeningLength: "120-180 seconds",
  },
  ISE_IV: {
    cefr: "C2",
    topicDuration: "4 minutes",
    subjectAreas: "any academic or professional topic, highly specialized subjects, current affairs",
    complexity: "Near-native interaction expected, subtle challenging, rhetorical sophistication",
    listeningLength: "180-240 seconds",
  },
};

export function getOralExaminerSystemPrompt(level: ExamLevel): string {
  const config = levelConfig[level];
  return `You are a professional Trinity College London ISE oral examiner conducting an ISE ${level.replace("ISE_", "")} (CEFR ${config.cefr}) speaking exam.

EXAMINER GUIDELINES:
- Be professional, warm but neutral — like a real Trinity examiner
- Speak clearly and at an appropriate pace for ${config.cefr} level
- Do NOT correct the candidate's English during the exam
- Do NOT give feedback during the exam — just facilitate
- Ask follow-up questions naturally based on what the candidate says
- If the candidate goes off-topic, gently redirect them
- Keep your responses concise — you are the examiner, not the speaker
- Adapt your language complexity to ${config.cefr} level when asking questions

IMPORTANT: You must respond ONLY in English. Always stay in your role as the examiner.`;
}

export function getTopicTaskPrompt(level: ExamLevel, topic: string): string {
  const config = levelConfig[level];
  return `TOPIC TASK — ISE ${level.replace("ISE_", "")} (${config.cefr})

The candidate has chosen to talk about: "${topic}"

Your role:
1. First, invite the candidate to begin their topic presentation (about ${config.topicDuration})
2. Listen carefully to their presentation
3. After they finish (or when you've heard enough), ask 2-3 follow-up questions about their topic
4. Questions should probe deeper into what they said — ask for examples, reasons, opinions, comparisons
5. Complexity level: ${config.complexity}

Start by saying something like: "Thank you. Your topic today is about ${topic}. Please go ahead and tell me about it."

Respond with ONLY your next line of dialogue as the examiner. Keep it natural and conversational.`;
}

export function getTopicFollowUpPrompt(level: ExamLevel, conversationHistory: string): string {
  const config = levelConfig[level];
  return `TOPIC TASK FOLLOW-UP — ISE ${level.replace("ISE_", "")} (${config.cefr})

Conversation so far:
${conversationHistory}

Ask a follow-up question about what the candidate just said. Probe deeper — ask for examples, reasons, opinions, or comparisons. ${config.complexity}

Respond with ONLY your next question as the examiner. One question only, keep it concise.`;
}

export function getCollaborativeTaskPrompt(level: ExamLevel): string {
  const config = levelConfig[level];
  return `COLLABORATIVE TASK — ISE ${level.replace("ISE_", "")} (${config.cefr})

Generate a collaborative discussion prompt. In a real Trinity ISE exam, the examiner presents a topic and the candidate must discuss it together with the examiner.

Subject areas: ${config.subjectAreas}

You must:
1. Present a scenario or discussion topic clearly
2. Share your own opinion briefly to model the discussion
3. Ask the candidate what they think
4. This should feel like a natural two-way discussion, not an interview

Create an engaging prompt related to one of these subject areas. Present it naturally.

Respond with ONLY your opening statement and question to start the collaborative discussion.`;
}

export function getCollaborativeFollowUpPrompt(level: ExamLevel, conversationHistory: string): string {
  const config = levelConfig[level];
  return `COLLABORATIVE TASK FOLLOW-UP — ISE ${level.replace("ISE_", "")} (${config.cefr})

Conversation so far:
${conversationHistory}

Continue the collaborative discussion naturally. You can:
- Share a brief opinion of your own and ask the candidate to respond
- Challenge their viewpoint politely and ask them to elaborate
- Introduce a related angle on the topic
- Ask them to compare or contrast something

${config.complexity}

Respond with ONLY your next line of dialogue. Keep it concise and conversational.`;
}

export function getConversationTaskPrompt(level: ExamLevel): string {
  const config = levelConfig[level];
  return `CONVERSATION TASK — ISE ${level.replace("ISE_", "")} (${config.cefr})

Start a conversation task. Pick ONE subject area from: ${config.subjectAreas}

This is a general conversation — more relaxed than the other tasks but still assessing the candidate's ability to sustain a conversation, give opinions, and discuss topics at ${config.cefr} level.

Start with a natural opening question about the chosen subject. The question should invite an extended response, not just a yes/no answer.

Respond with ONLY your opening question.`;
}

export function getConversationFollowUpPrompt(level: ExamLevel, conversationHistory: string): string {
  const config = levelConfig[level];
  return `CONVERSATION TASK FOLLOW-UP — ISE ${level.replace("ISE_", "")} (${config.cefr})

Conversation so far:
${conversationHistory}

Continue the conversation naturally. Ask a follow-up or move to a related aspect of the subject. Keep it feeling like a natural conversation, not an interrogation.

${config.complexity}

Respond with ONLY your next question or comment.`;
}

export function getListeningTaskPrompt(level: ExamLevel): string {
  const config = levelConfig[level];
  return `LISTENING TASK — ISE ${level.replace("ISE_", "")} (${config.cefr})

Generate a listening task. You need to create:
1. A short monologue or dialogue (${config.listeningLength} when spoken aloud) on a topic from: ${config.subjectAreas}
2. After the listening, you will ask the candidate 3-4 comprehension questions about what they heard

The monologue should be at ${config.cefr} level complexity.

OUTPUT FORMAT (strict JSON):
{
  "listeningText": "The full text that will be read aloud to the candidate",
  "introduction": "A brief intro you say before playing the audio, e.g. 'You are going to listen to a talk about...'",
  "questions": [
    "Question 1 about the listening text",
    "Question 2 about the listening text",
    "Question 3 about the listening text"
  ]
}

Return ONLY the JSON object.`;
}

export function getListeningFollowUpPrompt(
  level: ExamLevel,
  question: string,
  candidateAnswer: string
): string {
  return `The candidate was asked: "${question}"
They answered: "${candidateAnswer}"

Acknowledge their answer briefly (don't tell them if it's correct or wrong — just as a real examiner would) and move on. If this is the last question, thank the candidate and say the exam is now complete.

Respond with ONLY your next line as the examiner.`;
}

export function getOralEvaluationPrompt(
  level: ExamLevel,
  taskType: OralTaskType,
  transcript: string
): string {
  const config = levelConfig[level];
  const taskLabel = {
    TOPIC: "Topic Task",
    COLLABORATIVE: "Collaborative Task",
    CONVERSATION: "Conversation Task",
    LISTENING: "Listening Task",
  }[taskType];

  return `You are a senior Trinity ISE examiner evaluating a candidate's performance in the ${taskLabel} of an ISE ${level.replace("ISE_", "")} (${config.cefr}) oral exam.

TRANSCRIPT:
${transcript}

Evaluate this performance using official ISE oral marking criteria. Be fair but rigorous.

Score each area from 0-5 where:
0 = No evidence
1 = Very limited  
2 = Limited
3 = Adequate for this level
4 = Good for this level
5 = Excellent for this level

${taskType === "LISTENING" ? `For the Listening task, focus on:
- Comprehension accuracy
- Ability to identify key information
- Ability to recall details` : `Focus on:
- How naturally the candidate communicated
- Range and accuracy of grammar
- Range and appropriateness of vocabulary
- Fluency and coherence
- Pronunciation clarity`}

OUTPUT FORMAT (strict JSON):
{
  "score": number (overall 0-25),
  "pronunciation": {
    "score": number (0-5),
    "comments": "specific feedback with examples from transcript"
  },
  "grammar": {
    "score": number (0-5),
    "comments": "specific grammar feedback with examples"
  },
  "vocabulary": {
    "score": number (0-5),
    "comments": "vocabulary range and appropriateness feedback"
  },
  "fluency": {
    "score": number (0-5),
    "comments": "fluency, coherence and interaction feedback"
  },
  "taskFulfillment": {
    "score": number (0-5),
    "comments": "how well the candidate addressed the task requirements"
  },
  "suggestions": [
    "actionable improvement suggestion 1",
    "actionable improvement suggestion 2",
    "actionable improvement suggestion 3"
  ]
}

Return ONLY the JSON object.`;
}
