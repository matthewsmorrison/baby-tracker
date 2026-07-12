export type MemberRole = "owner" | "caregiver" | "viewer";
export type EntryType =
  | "nappy"
  | "feed"
  | "weight"
  | "sleep"
  | "pump"
  | "carer_sleep"
  | "medication"
  | "temperature"
  | "milestone";
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
export type SleepLocation =
  | "cot"
  | "arms"
  | "pram"
  | "car_seat"
  | "next_to_me"
  | "other";
export type SettleMethod = "self" | "fed" | "rocked" | "dummy" | "other";
export type PostFeedMood = "settled" | "fussy" | "crying";
export type MedSubject = "mother" | "baby";

/** What the vision model suggested for a nappy photo — stored next to what
 *  the parent actually saved, so corrections become training/eval data. */
export interface NappyAiPrefill {
  wet: boolean | null;
  dirty: boolean | null;
  stool_colour: StoolColourKey | null;
  confidence: "low" | "medium" | "high";
}
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

export type BabySex = "boy" | "girl";

export interface Professional {
  id: string;
  slug: string;
  invite_code: string;
  name: string;
  title: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  user_id: string | null;
  email: string | null;
  created_at: string;
}

export interface Baby {
  id: string;
  name: string;
  birth_at: string;
  birth_weight_g: number;
  sex: BabySex | null; // for sex-specific WHO weight centiles
  nappy_base_weight_g: number | null; // weight of a clean, dry nappy
  feed_interval_min: number | null; // expected time between feeds; gates "Next feed due"
  tracked_types: EntryType[]; // categories this family tracks
  membership_tier: "free" | "advanced"; // AI features are Advanced-only
  referred_by_pro: string | null; // professional who referred this family
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


export interface BabyNote {
  id: string;
  baby_id: string;
  kind: "question" | "note";
  body: string;
  answer: string | null;
  answered_at: string | null;
  answered_by: string | null;
  tagged_user_ids: string[];
  photo_paths: string[] | null;
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

  med_name: string | null; // medication (type = medication)
  med_dose: string | null; // e.g. "200 mg"
  med_subject: MedSubject | null; // whose medication (null = mother, legacy)
  reminder_times: string[] | null; // local "HH:MM" times to be reminded
  reminder_tz: string | null; // IANA tz the reminder times are in
  reminder_user_ids: string[] | null; // carers who get the reminder push

  sleep_location: SleepLocation | null; // where the baby slept
  settle_method: SettleMethod | null; // how the baby settled

  spit_up: boolean | null; // feed: brought some milk back up
  post_feed_mood: PostFeedMood | null; // how the feed ended

  length_mm: number | null; // measured with a weight entry
  head_circ_mm: number | null; // measured with a weight entry

  temp_c: number | null; // type = temperature
  milestone_label: string | null; // type = milestone

  ai_prefill: NappyAiPrefill | null; // vision suggestion for a nappy

  note: string | null;
  photo_path: string | null;
}

/** A stored AI handover summary (markdown) for healthcare professionals. */
export interface HandoverReport {
  id: string;
  baby_id: string;
  content: string;
  created_by: string;
  created_at: string;
}
