import { Message } from "./store";
import type { ScenarioCategory } from "./scenario-categories";

/** @deprecated use ScenarioCategory */
export type ScenarioTone = ScenarioCategory;

export type DefaultScenario = {
  label: string;
  category: ScenarioCategory;
  messages: Message[];
};

export const DEFAULT_SCENARIOS: DefaultScenario[] = [
  {
    label: "High intent — marathon training",
    category: "success",
    messages: [
      {
        role: "user",
        content:
          "I'm training for my first marathon and my knees have been killing me. What running shoes should I get?",
      },
      {
        role: "assistant",
        content:
          "For marathon training with knee issues, you'll want strong cushioning and stability. The Brooks Ghost or Asics Gel-Nimbus are popular picks. What's your budget?",
      },
      {
        role: "user",
        content: "Up to £150, I want something that'll last me through the full training block",
      },
    ],
  },
  {
    label: "Brand safety — controversy",
    category: "safety",
    messages: [
      {
        role: "user",
        content:
          "I was reading about the Nike sweatshop controversy and labour conditions in their factories. Is it actually true?",
      },
      {
        role: "assistant",
        content:
          "There have been documented reports about labour conditions in Nike's supply chain, particularly in Asian manufacturing facilities. Nike has introduced audit programmes since the 1990s...",
      },
      {
        role: "user",
        content: "So should I even be buying Nike products?",
      },
    ],
  },
  {
    label: "Low intent — weather",
    category: "muted",
    messages: [
      {
        role: "user",
        content: "What's the weather going to be like in London this weekend?",
      },
      {
        role: "assistant",
        content:
          "This weekend looks mostly cloudy with a chance of light rain Saturday. Sunday should be drier.",
      },
      {
        role: "user",
        content: "Ugh typical, I wanted to go to the park",
      },
    ],
  },
  {
    label: "Medium intent — gym beginner",
    category: "warning",
    messages: [
      {
        role: "user",
        content:
          "I want to start going to the gym but I don't know where to start. What should I do?",
      },
      {
        role: "assistant",
        content:
          "Starting out, 3 days a week of full-body resistance training is solid. Compound movements like squats, deadlifts, and bench press...",
      },
      {
        role: "user",
        content: "Do I need to buy special clothes or equipment?",
      },
    ],
  },
  {
    label: "Blocked topic — protest",
    category: "blocked",
    messages: [
      {
        role: "user",
        content:
          "There's a big protest happening near me against corporate sportswear brands. What's it about?",
      },
      {
        role: "assistant",
        content:
          "There have been several activist campaigns targeting major sportswear companies around pricing, environmental impact, and manufacturing ethics...",
      },
    ],
  },
];

/** @deprecated use DEFAULT_SCENARIOS */
export const scenarios = DEFAULT_SCENARIOS.map((s) => ({
  label: s.label,
  tone: s.category,
  messages: s.messages,
}));
