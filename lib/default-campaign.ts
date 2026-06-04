import type { CampaignInput } from "@/lib/campaigns-db";

export const DEFAULT_NIKE_CAMPAIGN: CampaignInput = {
  name: "Nike UK — Running Q3",
  advertiser: "Nike",
  goal: "Reach users with high purchase intent for running shoes and athletic gear",
  maxCPM: 8,
  brandKeywords: ["running", "fitness", "training", "sport", "marathon", "gym"],
  blockedTopics: ["controversy", "lawsuit", "sweatshop", "labour", "protest"],
};
