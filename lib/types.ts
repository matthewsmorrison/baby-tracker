export type MemberRole = "owner" | "caregiver" | "viewer";
export type EntryType = "nappy" | "feed" | "weight";
export type InviteStatus = "pending" | "accepted" | "revoked";
export type FeedType = "breast" | "formula" | "expressed" | "mixed";

/** Per-component notes on a combined feed. */
export interface FeedNotes {
  left?: string;
  right?: string;
  expressed?: string;
  formula?: string;
}
export type FeedMix = "breast" | "mixed" | "formula" | "unknown";
export type StoolColourKey =
  | "meconium"
  | "transitional"
  | "yellow"
  | "tan"
  | "brown"
  | "green"
  | "pale"
  | "blood";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
}

export interface Baby {
  id: string;
  name: string;
  birth_at: string;
  birth_weight_g: number;
  nappy_base_weight_g: number | null; // weight of a clean, dry nappy
  feed_interval_min: number | null; // expected time between feeds; gates "Next feed due"
  membership_tier: "free" | "advanced"; // AI features are Advanced-only
  created_by: string;
  created_at: string;
}

export interface BabyMember {
  id: string;
  baby_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  profile?: Profile;
}

export interface BabyInvite {
  id: string;
  baby_id: string;
  email: string;
  role: MemberRole;
  token: string;
  invited_by: string;
  status: InviteStatus;
  created_at: string;
  accepted_at: string | null;
}

export type AnalysisAction =
  | "log_and_continue"
  | "mention_at_next_check"
  | "contact_midwife_today"
  | "seek_urgent_advice";

export interface AiAnalysis {
  // The AI is a labeller only: colour, texture and amounts. Every label can
  // be overwritten by a parent, and none of them is advice.
  visibleContents: "poo" | "wee" | "both" | "unclear";
  colour: string;
  /** AI's classification into the app's stool colour keys. */
  colourKey?: StoolColourKey | "unclear";
  consistency: string;
  /** How much stool is visible in the photo. */
  stoolAmount?: "none" | "smear" | "small" | "medium" | "large";
  /** Weighed output minus the estimated stool mass, in ml (1 g ≈ 1 ml). */
  estimatedUrineMl?: number | null;
  analysedAt?: string;
  model?: string;
  // Legacy fields from when the AI produced verdicts — no longer generated
  // or displayed; present on older analyses.
  feedTypeLikely?: string;
  matchesExpected?: string;
  assessment?: string;
  redFlags?: string[];
  action?: AnalysisAction;
  note?: string;
}

export interface BabyNote {
  id: string;
  baby_id: string;
  body: string;
  answer: string | null;
  answered_at: string | null;
  answered_by: string | null;
  tagged_user_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  baby_id: string;
  type: EntryType;
  occurred_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;

  wet: boolean | null;
  dirty: boolean | null;
  stool_colour: StoolColourKey | null;
  nappy_weight_g: number | null; // weight of the used nappy

  feed_type: FeedType | null;
  left_min: number | null;
  right_min: number | null;
  volume_ml: number | null; // legacy single-bottle amount (pre combined feeds)
  expressed_ml: number | null;
  formula_ml: number | null;
  ended_at: string | null; // feed end; occurred_at is the start
  feed_notes: FeedNotes | null;

  weight_g: number | null;

  note: string | null;
  photo_path: string | null;
  ai: AiAnalysis | null;
}
