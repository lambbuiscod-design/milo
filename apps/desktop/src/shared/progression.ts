export const PROGRESSION_REWARDS = Object.freeze([
  { id: "fur-charcoal", level: 1, label: "Charcoal fur" },
  { id: "eyes-classic", level: 1, label: "Classic eyes" },
  { id: "animation-calm", level: 1, label: "Calm animation" },
  { id: "room-plant", level: 1, label: "Room plant" },
  { id: "fur-slate", level: 2, label: "Slate fur" },
  { id: "animation-energetic", level: 2, label: "Energetic animation" },
  { id: "room-rug", level: 2, label: "Room rug" },
  { id: "fur-mauve", level: 3, label: "Mauve fur" },
  { id: "eyes-curious", level: 3, label: "Curious eyes" },
  { id: "room-lamp", level: 3, label: "Room lamp" },
  { id: "fur-caramel", level: 4, label: "Caramel fur" },
  { id: "animation-chaotic", level: 4, label: "Chaotic animation" },
  { id: "accessory-coral-bow", level: 5, label: "Coral bow" },
  { id: "animation-sleepy", level: 6, label: "Sleepy animation" },
] as const);

export type ProgressionRewardId = (typeof PROGRESSION_REWARDS)[number]["id"];

export function rewardsUnlockedThroughLevel(level: number): readonly ProgressionRewardId[] {
  return PROGRESSION_REWARDS.filter((reward) => reward.level <= level).map((reward) => reward.id);
}

export function requiredLevelForReward(id: string): number | null {
  return PROGRESSION_REWARDS.find((reward) => reward.id === id)?.level ?? null;
}
