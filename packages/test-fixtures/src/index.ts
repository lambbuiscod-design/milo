/**
 * Phase-specific synthetic fixtures are added here. Real conversations and
 * production-derived content are forbidden by the security invariants.
 */
export const fixtureDataPolicy = "synthetic-only" as const;

export {
  SYNTHETIC_CHAT_EXPECTED_SUBSTRINGS,
  SYNTHETIC_CHAT_IMAGE_BASE64,
  SYNTHETIC_CHAT_SVG,
  getSyntheticChatImageBuffer,
} from "./synthetic-chat-fixture";

