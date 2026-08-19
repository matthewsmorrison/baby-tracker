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
  presence_status: PresenceStatus;
  presence_at: string | null; // heartbeat; stale ⇒ shown as offline
  public_key: string | null; // ECDH public key (JWK) for E2EE messaging
  status_text: string | null; // MSN-style status line, shown to friends
}

/** "feeding" is broadcast automatically while a feed timer runs; "online" is
 *  the manual Go-online toggle. */
export type PresenceStatus = "offline" | "online" | "feeding";

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export interface Friendship {
  id: string;
  requester: string;
  addressee: string;
  status: FriendshipStatus;
  created_at: string;
  accepted_at: string | null;
  blocked_by: string | null;
}

/** A direct message between two friends (parent-to-parent chat). The body
 *  is an E2EE envelope (see lib/e2ee.ts) — plaintext never leaves the client. */
export interface DirectMessage {
  id: string;
  sender: string;
  recipient: string;
  body: string;
  kind: "text" | "wave";
  created_at: string;
  read_at: string | null;
  receipt_suppressed: boolean; // reader had read-receipts off
}

export type BabySex = "boy" | "girl";

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

/** Whole-day observations (no timestamp): tagged on the History calendar or
 *  Today. `day` is a local calendar date, "YYYY-MM-DD". */
export type DayTagKind = "no_poo" | "teething";

export interface DayTag {
  id: string;
  baby_id: string;
  day: string;
  tag: DayTagKind;
  created_by: string;
  created_at: string;
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
  med_kind: "course" | "dose" | null; // course (default) or one-off dose given
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

  note: string | null;
  photo_path: string | null;
  /** Bulk-import provenance (e.g. "huckleberry"); null for hand-logged. */
  source: string | null;
}

/** A stored AI handover summary (markdown) for healthcare professionals. */
export interface HandoverReport {
  id: string;
  baby_id: string;
  content: string;
  created_by: string;
  created_at: string;
}
