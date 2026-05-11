import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, PenTool, Mic, Target, Lightbulb, Clock } from "lucide-react";

const tips = [
  {
    icon: PenTool,
    title: "Reading Tasks",
    level: "All Levels",
    tips: [
      "Skim the text first to understand the main idea before answering questions",
      "For True/False/Not Given questions, look for exact evidence in the text — don't assume",
      "In matching tasks, underline key phrases that distinguish Text A from Text B",
      "Don't spend too long on one question. Mark uncertain answers and come back",
      "Time management: aim for 20-25 minutes on reading tasks",
    ],
  },
  {
    icon: BookOpen,
    title: "Reading into Writing",
    level: "All Levels",
    tips: [
      "You MUST reference information from both reading texts",
      "Use paraphrasing — don't copy directly from the texts",
      "Structure your response clearly: introduction, body paragraphs, conclusion",
      "Use linking words to show you're synthesizing information (similarly, in contrast, furthermore)",
      "Stay within the word limit — examiners check this carefully",
    ],
  },
  {
    icon: Target,
    title: "Extended Writing",
    level: "All Levels",
    tips: [
      "Plan before you write. Spend 3-5 minutes outlining your structure",
      "Match the register to the task type (formal for reports/essays, semi-formal for articles)",
      "Include a clear thesis/position and support it with examples",
      "Use a range of vocabulary — avoid repeating the same words",
      "Leave 2-3 minutes to proofread at the end",
    ],
  },
  {
    icon: Mic,
    title: "Topic Task (Oral)",
    level: "All Levels",
    tips: [
      "Prepare your topic thoroughly — you should be able to speak for 4 minutes",
      "Structure your topic: introduction, 2-3 main points, conclusion",
      "Anticipate follow-up questions the examiner might ask",
      "Use a range of tenses and complex structures naturally",
      "Don't memorize a script — prepare ideas and key vocabulary instead",
    ],
  },
  {
    icon: Lightbulb,
    title: "Collaborative & Conversation Tasks",
    level: "All Levels",
    tips: [
      "Listen carefully to the examiner and respond to what they actually say",
      "Express and justify opinions — don't just agree or disagree",
      "Use discourse markers (well, actually, to be honest, on the other hand)",
      "Ask the examiner questions too — it shows natural conversation skills",
      "For C1/C2: speculate, hypothesize, and discuss abstract concepts",
    ],
  },
  {
    icon: Clock,
    title: "General Exam Strategy",
    level: "All Levels",
    tips: [
      "Practice regularly — consistency beats cramming",
      "Familiarize yourself with the exam format so there are no surprises",
      "For written exams, always plan your time for each task",
      "Track your weak areas and focus practice there",
      "Read broadly in English (news, articles, books) to build vocabulary naturally",
    ],
  },
];

export default function TipsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Tips & Study Guides
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Expert strategies to help you maximize your ISE exam score.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {tips.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                  <section.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <Badge variant="outline" className="mt-1">{section.level}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {section.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="mt-0.5 text-blue-600 shrink-0">✓</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
