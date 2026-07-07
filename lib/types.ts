export type MemberRole = "owner" | "caregiver" | "viewer";
export type EntryType = "nappy" | "feed" | "weight";
export type InviteStatus = "pending" | "accepted" | "revoked";
export type FeedType = "breast" | "formula" | "expressed";
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
  visibleContents: "poo" | "wee" | "both" | "unclear";
  colour: string;
  consistency: string;
  feedTypeLikely:
    | "more breastfed-type"
    | "more formula-type"
    | "mixed"
    | "unclear";
  matchesExpected: "yes" | "partly" | "no" | "unclear";
  assessment: string;
  redFlags: string[];
  action: AnalysisAction;
  note: string;
  analysedAt?: string;
  model?: string;
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

  feed_type: FeedType | null;
  left_min: number | null;
  right_min: number | null;
  volume_ml: number | null;

  weight_g: number | null;

  note: string | null;
  photo_path: string | null;
  ai: AiAnalysis | null;
}
