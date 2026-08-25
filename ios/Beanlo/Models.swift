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
        case note, source
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

    enum CodingKeys: String, CodingKey {
        case id, name, sex
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
