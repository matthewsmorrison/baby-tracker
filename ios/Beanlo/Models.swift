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
    var nappyWeightG: Int?
    var feedType: String?
    var leftMin: Int?
    var rightMin: Int?
    var expressedMl: Int?
    var formulaMl: Int?
    var volumeMl: Int?
    var weightG: Int?
    var tempC: Double?
    var medName: String?
    var medDose: String?
    var medKind: String?
    var medSubject: String?
    var milestoneLabel: String?
    var note: String?
    var source: String?

    enum CodingKeys: String, CodingKey {
        case id
        case babyId = "baby_id"
        case type
        case occurredAt = "occurred_at"
        case endedAt = "ended_at"
        case wet, dirty
        case nappyWeightG = "nappy_weight_g"
        case feedType = "feed_type"
        case leftMin = "left_min"
        case rightMin = "right_min"
        case expressedMl = "expressed_ml"
        case formulaMl = "formula_ml"
        case volumeMl = "volume_ml"
        case weightG = "weight_g"
        case tempC = "temp_c"
        case medName = "med_name"
        case medDose = "med_dose"
        case medKind = "med_kind"
        case medSubject = "med_subject"
        case milestoneLabel = "milestone_label"
        case note, source
    }
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
    var nappyWeightG: Int?
    var feedType: String?
    var leftMin: Int?
    var rightMin: Int?
    var expressedMl: Int?
    var formulaMl: Int?
    var weightG: Int?
    var tempC: Double?
    var medName: String?
    var medDose: String?
    var medKind: String?
    var medSubject: String?
    var note: String?
    var source: String?

    enum CodingKeys: String, CodingKey {
        case babyId = "baby_id"
        case type
        case occurredAt = "occurred_at"
        case createdBy = "created_by"
        case endedAt = "ended_at"
        case wet, dirty
        case nappyWeightG = "nappy_weight_g"
        case feedType = "feed_type"
        case leftMin = "left_min"
        case rightMin = "right_min"
        case expressedMl = "expressed_ml"
        case formulaMl = "formula_ml"
        case weightG = "weight_g"
        case tempC = "temp_c"
        case medName = "med_name"
        case medDose = "med_dose"
        case medKind = "med_kind"
        case medSubject = "med_subject"
        case note, source
    }
}

struct Baby: Codable, Identifiable, Hashable {
    let id: UUID
    var name: String
    var birthAt: Date
    var birthWeightG: Int
    var trackedTypes: [String]?
    var feedIntervalMin: Int?
    var nappyBaseWeightG: Int?

    enum CodingKeys: String, CodingKey {
        case id, name
        case birthAt = "birth_at"
        case birthWeightG = "birth_weight_g"
        case trackedTypes = "tracked_types"
        case feedIntervalMin = "feed_interval_min"
        case nappyBaseWeightG = "nappy_base_weight_g"
    }
}

struct Membership: Codable {
    var role: String
    var baby: Baby
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
