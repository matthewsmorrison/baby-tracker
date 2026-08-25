import Foundation

// Mirrors the web app's `entries` schema (lib/types.ts). Optionals are
// omitted from inserts when nil (synthesised Codable uses encodeIfPresent),
// which matters for columns with not-null defaults like med_kind.

enum EntryType: String, Codable, CaseIterable, Identifiable {
    case nappy, feed, sleep, weight, pump
    case carerSleep = "carer_sleep"
    case temperature, milestone, medication
    var id: String { rawValue }

    var label: String {
        switch self {
        case .nappy: "Nappy"
        case .feed: "Feed"
        case .sleep: "Sleep"
        case .weight: "Measure"
        case .pump: "Pump"
        case .carerSleep: "My sleep"
        case .temperature: "Temp"
        case .milestone: "Milestone"
        case .medication: "Meds"
        }
    }

    var symbol: String {
        switch self {
        case .nappy: "drop.fill"
        case .feed: "waterbottle.fill"
        case .sleep: "moon.zzz.fill"
        case .weight: "scalemass.fill"
        case .pump: "drop.circle.fill"
        case .carerSleep: "bed.double.fill"
        case .temperature: "medical.thermometer.fill"
        case .milestone: "star.fill"
        case .medication: "pills.fill"
        }
    }
}

struct Entry: Codable, Identifiable, Hashable {
    let id: UUID
    var babyId: UUID
    var type: EntryType
    var occurredAt: Date
    var endedAt: Date?
    var wet: Bool?
    var dirty: Bool?
    var stoolColour: String?
    var nappyWeightG: Int?
    var feedType: String?
    var leftMin: Int?
    var rightMin: Int?
    var expressedMl: Int?
    var formulaMl: Int?
    var volumeMl: Int?
    var weightG: Int?
    var lengthMm: Int?
    var headCircMm: Int?
    var tempC: Double?
    var medName: String?
    var medDose: String?
    var medKind: String?
    var medSubject: String?
    var reminderTimes: [String]?
    var reminderTz: String?
    var reminderUserIds: [UUID]?
    var milestoneLabel: String?
    var sleepLocation: String?
    var settleMethod: String?
    var spitUp: Bool?
    var postFeedMood: String?
    var feedNotes: FeedNotes?
    var photoPath: String?
    var note: String?
    var source: String?
    var createdBy: UUID?

    enum CodingKeys: String, CodingKey {
        case id
        case babyId = "baby_id"
        case type
        case occurredAt = "occurred_at"
        case endedAt = "ended_at"
        case wet, dirty
        case stoolColour = "stool_colour"
        case nappyWeightG = "nappy_weight_g"
        case feedType = "feed_type"
        case leftMin = "left_min"
        case rightMin = "right_min"
        case expressedMl = "expressed_ml"
        case formulaMl = "formula_ml"
        case volumeMl = "volume_ml"
        case weightG = "weight_g"
        case lengthMm = "length_mm"
        case headCircMm = "head_circ_mm"
        case tempC = "temp_c"
        case medName = "med_name"
        case medDose = "med_dose"
        case medKind = "med_kind"
        case medSubject = "med_subject"
        case reminderTimes = "reminder_times"
        case reminderTz = "reminder_tz"
        case reminderUserIds = "reminder_user_ids"
        case milestoneLabel = "milestone_label"
        case sleepLocation = "sleep_location"
        case settleMethod = "settle_method"
        case spitUp = "spit_up"
        case postFeedMood = "post_feed_mood"
        case feedNotes = "feed_notes"
        case photoPath = "photo_path"
        case note, source
        case createdBy = "created_by"
    }
}

/// Per-part feed notes (jsonb column), same shape as the web.
struct FeedNotes: Codable, Hashable {
    var left: String?
    var right: String?
    var expressed: String?
    var formula: String?
    var isEmpty: Bool { left == nil && right == nil && expressed == nil && formula == nil }
}

/// Insert payload — no id (DB generates), created_by filled by the store.
struct NewEntry: Codable {
    var babyId: UUID
    var type: EntryType
    var occurredAt: Date
    var createdBy: UUID
    var endedAt: Date?
    var wet: Bool?
    var dirty: Bool?
    var stoolColour: String?
    var nappyWeightG: Int?
    var feedType: String?
    var leftMin: Int?
    var rightMin: Int?
    var expressedMl: Int?
    var formulaMl: Int?
    var weightG: Int?
    var lengthMm: Int?
    var headCircMm: Int?
    var tempC: Double?
    var medName: String?
    var medDose: String?
    var medKind: String?
    var medSubject: String?
    var reminderTimes: [String]?
    var reminderTz: String?
    var reminderUserIds: [UUID]?
    var sleepLocation: String?
    var settleMethod: String?
    var spitUp: Bool?
    var postFeedMood: String?
    var feedNotes: FeedNotes?
    var milestoneLabel: String?
    var note: String?
    var source: String?

    enum CodingKeys: String, CodingKey {
        case babyId = "baby_id"
        case type
        case occurredAt = "occurred_at"
        case createdBy = "created_by"
        case endedAt = "ended_at"
        case wet, dirty
        case stoolColour = "stool_colour"
        case nappyWeightG = "nappy_weight_g"
        case feedType = "feed_type"
        case leftMin = "left_min"
        case rightMin = "right_min"
        case expressedMl = "expressed_ml"
        case formulaMl = "formula_ml"
        case weightG = "weight_g"
        case lengthMm = "length_mm"
        case headCircMm = "head_circ_mm"
        case tempC = "temp_c"
        case medName = "med_name"
        case medDose = "med_dose"
        case medKind = "med_kind"
        case medSubject = "med_subject"
        case reminderTimes = "reminder_times"
        case reminderTz = "reminder_tz"
        case reminderUserIds = "reminder_user_ids"
        case sleepLocation = "sleep_location"
        case settleMethod = "settle_method"
        case spitUp = "spit_up"
        case postFeedMood = "post_feed_mood"
        case feedNotes = "feed_notes"
        case milestoneLabel = "milestone_label"
        case note, source
    }
}

// MARK: - Social / notes / chat models

struct Profile: Codable, Identifiable, Hashable {
    let id: UUID
    var fullName: String?
    var email: String?
    var avatarUrl: String?
    var presenceStatus: String?
    var presenceAt: Date?
    var statusText: String?
    var publicKey: String?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case email
        case avatarUrl = "avatar_url"
        case presenceStatus = "presence_status"
        case presenceAt = "presence_at"
        case statusText = "status_text"
        case publicKey = "public_key"
    }

    var displayName: String { fullName ?? email ?? "Friend" }

    /// Presence with the web's stale-heartbeat TTL applied (2 minutes).
    var livePresence: String {
        guard let presenceAt, Date().timeIntervalSince(presenceAt) < 150 else { return "offline" }
        return presenceStatus ?? "offline"
    }
}

struct Friendship: Codable, Identifiable {
    let id: UUID
    var requester: UUID
    var addressee: UUID
    var status: String
    var blockedBy: UUID?

    enum CodingKeys: String, CodingKey {
        case id, requester, addressee, status
        case blockedBy = "blocked_by"
    }

    func other(_ me: UUID) -> UUID { requester == me ? addressee : requester }
}

struct DirectMessage: Codable, Identifiable, Hashable {
    let id: UUID
    var sender: UUID
    var recipient: UUID
    var body: String
    var createdAt: Date
    var readAt: Date?
    var receiptSuppressed: Bool?

    enum CodingKeys: String, CodingKey {
        case id, sender, recipient, body
        case createdAt = "created_at"
        case readAt = "read_at"
        case receiptSuppressed = "receipt_suppressed"
    }
}

struct BabyNote: Codable, Identifiable, Hashable {
    let id: UUID
    var babyId: UUID
    var kind: String
    var body: String
    var answer: String?
    var answeredAt: Date?
    var taggedUserIds: [UUID]
    var photoPaths: [String]?
    var createdBy: UUID
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, kind, body, answer
        case babyId = "baby_id"
        case answeredAt = "answered_at"
        case taggedUserIds = "tagged_user_ids"
        case photoPaths = "photo_paths"
        case createdBy = "created_by"
        case createdAt = "created_at"
    }
}

struct ChatConversation: Codable, Identifiable, Hashable {
    let id: UUID
    var title: String?
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, title
        case createdAt = "created_at"
    }
}

struct ChatMessage: Codable, Identifiable, Hashable {
    var id: UUID?
    var role: String
    var content: String
    var feedback: String?
}

struct BabyInvite: Codable, Identifiable {
    let id: UUID
    var email: String
    var role: String
    var token: UUID
    var status: String
}

struct UserSettings: Codable {
    var appearOffline: Bool?
    var readReceipts: Bool?

    enum CodingKeys: String, CodingKey {
        case appearOffline = "appear_offline"
        case readReceipts = "read_receipts"
    }
}

/// The red book's stool colour chart, mirrored from the web (lib/clinical.ts).
enum StoolColour: String, CaseIterable, Identifiable {
    case meconium, transitional, yellow, tan, brown, green, pale, blood
    var id: String { rawValue }

    var label: String {
        switch self {
        case .meconium: "Meconium"
        case .transitional: "Transitional"
        case .yellow: "Yellow"
        case .tan: "Tan"
        case .brown: "Brown"
        case .green: "Green"
        case .pale: "Pale ⚠"
        case .blood: "Blood ⚠"
        }
    }

    var warns: Bool { self == .pale || self == .blood }

    var swatch: UInt32 {
        switch self {
        case .meconium: 0x2E2E28
        case .transitional: 0x6E5A34
        case .yellow: 0xE3B44A
        case .tan: 0xBFA173
        case .brown: 0x7A5A3A
        case .green: 0x5C7A3A
        case .pale: 0xECE7D6
        case .blood: 0x9E3B32
        }
    }
}

struct Baby: Codable, Identifiable, Hashable {
    let id: UUID
    var name: String
    var birthAt: Date
    var birthWeightG: Int
    var sex: String?
    var trackedTypes: [String]?
    var feedIntervalMin: Int?
    var nappyBaseWeightG: Int?
    var membershipTier: String?

    enum CodingKeys: String, CodingKey {
        case id, name, sex
        case birthAt = "birth_at"
        case birthWeightG = "birth_weight_g"
        case trackedTypes = "tracked_types"
        case feedIntervalMin = "feed_interval_min"
        case nappyBaseWeightG = "nappy_base_weight_g"
        case membershipTier = "membership_tier"
    }
}

struct Membership: Codable {
    var role: String
    var baby: Baby
}

/// Owner-editable baby settings (nil = leave unchanged; synthesised Codable
/// omits nil keys from the PATCH).
struct BabyUpdate: Codable {
    var name: String?
    var birthAt: Date?
    var birthWeightG: Int?
    var sex: String?
    var feedIntervalMin: Int?
    var nappyBaseWeightG: Int?
    var trackedTypes: [String]?

    enum CodingKeys: String, CodingKey {
        case name, sex
        case birthAt = "birth_at"
        case birthWeightG = "birth_weight_g"
        case feedIntervalMin = "feed_interval_min"
        case nappyBaseWeightG = "nappy_base_weight_g"
        case trackedTypes = "tracked_types"
    }
}

/// A carer with access to the baby (Settings → Carers).
struct Carer: Codable, Identifiable {
    let id: UUID
    var role: String
    var name: String?
    var email: String?
}

struct DayTag: Codable, Identifiable {
    let id: UUID
    var babyId: UUID
    var day: String
    var tag: String

    enum CodingKeys: String, CodingKey {
        case id
        case babyId = "baby_id"
        case day, tag
    }
}

struct NewDayTag: Codable {
    var babyId: UUID
    var day: String
    var tag: String
    var createdBy: UUID

    enum CodingKeys: String, CodingKey {
        case babyId = "baby_id"
        case day, tag
        case createdBy = "created_by"
    }
}

enum BeanloDates {
    /// Supabase returns timestamptz with or without fractional seconds and
    /// `date` columns as plain YYYY-MM-DD — handle all three.
    static let decoder: JSONDecoder = {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoPlain = ISO8601DateFormatter()
        isoPlain.formatOptions = [.withInternetDateTime]
        let dayOnly = DateFormatter()
        dayOnly.dateFormat = "yyyy-MM-dd"
        dayOnly.timeZone = TimeZone(identifier: "UTC")

        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let s = try decoder.singleValueContainer().decode(String.self)
            if let date = iso.date(from: s) ?? isoPlain.date(from: s) ?? dayOnly.date(from: s) {
                return date
            }
            throw DecodingError.dataCorrupted(.init(
                codingPath: decoder.codingPath,
                debugDescription: "Unparseable date: \(s)"
            ))
        }
        return d
    }()

    static let encoder: JSONEncoder = {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let e = JSONEncoder()
        e.dateEncodingStrategy = .custom { date, encoder in
            var c = encoder.singleValueContainer()
            try c.encode(iso.string(from: date))
        }
        return e
    }()
}
