import Foundation

/// Huckleberry CSV import — a Swift port of the web's lib/huckleberry.ts.
/// Parses the app's "Export tracking data as CSV" file into entry drafts;
/// anything unrecognised is skipped and reported, never guessed. Timestamps
/// are zone-less local times, read in this device's timezone.
enum Huckleberry {
    struct Plan {
        var drafts: [NewEntry] = []
        var skipped: [String: Int] = [:]
        var problems: [String] = []
        var totalRows = 0
    }

    /// Minimal RFC 4180 parser: quoted fields, escaped quotes, embedded newlines.
    static func parseCSV(_ text: String) -> [[String]] {
        var rows: [[String]] = []
        var row: [String] = []
        var cell = ""
        var inQuotes = false
        var i = text.startIndex
        while i < text.endIndex {
            let c = text[i]
            if inQuotes {
                if c == "\"" {
                    let next = text.index(after: i)
                    if next < text.endIndex && text[next] == "\"" {
                        cell.append("\"")
                        i = next
                    } else {
                        inQuotes = false
                    }
                } else {
                    cell.append(c)
                }
            } else if c == "\"" {
                inQuotes = true
            } else if c == "," {
                row.append(cell)
                cell = ""
            } else if c == "\n" || c == "\r" {
                if c == "\r" {
                    let next = text.index(after: i)
                    if next < text.endIndex && text[next] == "\n" { i = next }
                }
                row.append(cell)
                cell = ""
                if row.count > 1 || row[0] != "" { rows.append(row) }
                row = []
            } else {
                cell.append(c)
            }
            i = text.index(after: i)
        }
        row.append(cell)
        if row.count > 1 || row[0] != "" { rows.append(row) }
        return rows
    }

    private static func parseLocalDateTime(_ s: String?) -> Date? {
        guard let s = s?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
        let f = DateFormatter()
        for format in ["yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd'T'HH:mm"] {
            f.dateFormat = format
            if let d = f.date(from: s) { return d }
        }
        return nil
    }

    /// "H:MM[:SS]", "12m" → minutes; ambiguous two-part values above maxMin
    /// are read as MM:SS.
    private static func parseDurationMin(_ s: String?, maxMin: Double = .infinity) -> Int? {
        guard let t = s?.trimmingCharacters(in: .whitespaces), !t.isEmpty else { return nil }
        let parts = t.split(separator: ":").map(String.init)
        if parts.count == 3, let h = Int(parts[0]), let m = Int(parts[1]) {
            return h * 60 + m
        }
        if parts.count == 2, let a = Int(parts[0]), let b = Int(parts[1]) {
            let asHoursMin = a * 60 + b
            if Double(asHoursMin) <= maxMin { return asHoursMin }
            return a + Int((Double(b) / 60).rounded())
        }
        if let m = t.range(of: #"^(\d+(?:\.\d+)?)\s*m(in(ute)?s?)?$"#, options: [.regularExpression, .caseInsensitive]) {
            let num = t[m].prefix { $0.isNumber || $0 == "." }
            return Double(num).map { Int($0.rounded()) }
        }
        return nil
    }

    private static func parseVolumeMl(_ s: String?) -> Int? {
        guard let t = s?.trimmingCharacters(in: .whitespaces), !t.isEmpty else { return nil }
        guard let match = t.range(of: #"^(\d+(?:\.\d+)?)\s*(ml|oz)?\s*$"#, options: [.regularExpression, .caseInsensitive]) else { return nil }
        let str = String(t[match])
        let num = Double(str.prefix { $0.isNumber || $0 == "." }) ?? 0
        let isOz = str.lowercased().contains("oz")
        return Int((isOz ? num * 29.5735 : num).rounded())
    }

    private static func parseWeightG(_ texts: [String?]) -> Int? {
        for t in texts.compactMap({ $0 }) {
            guard let range = t.range(of: #"(\d+(?:[.,]\d+)?)\s*(kg|lbs?|g)\b"#, options: [.regularExpression, .caseInsensitive]) else { continue }
            let match = String(t[range]).lowercased()
            let num = Double(match.prefix { $0.isNumber || $0 == "." || $0 == "," }.replacingOccurrences(of: ",", with: ".")) ?? 0
            if match.contains("kg") { return Int((num * 1000).rounded()) }
            if match.contains("lb") { return Int((num * 453.592).rounded()) }
            return Int(num.rounded())
        }
        return nil
    }

    private static func parseTempC(_ texts: [String?]) -> Double? {
        for t in texts.compactMap({ $0 }) {
            guard let range = t.range(of: #"\d{2,3}(?:\.\d+)?"#, options: .regularExpression),
                  let n = Double(t[range]) else { continue }
            if n >= 30 && n <= 45 { return n }
            if n >= 86 && n <= 113 { return ((n - 32) / 1.8 * 10).rounded() / 10 }
        }
        return nil
    }

    static func plan(csv: String, babyId: UUID, userId: UUID) -> Plan {
        var plan = Plan()
        let rows = parseCSV(csv)
        plan.totalRows = max(0, rows.count - 1)
        guard rows.count >= 2 else { return plan }

        let header = rows[0].map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
        func col(_ name: String) -> Int? {
            header.firstIndex(of: name.lowercased())
        }
        guard let iType = col("Type"), let iStart = col("Start") else {
            plan.problems.append("This doesn't look like a Huckleberry export — no Type/Start columns.")
            return plan
        }
        let iEnd = col("End")
        let iDuration = col("Duration")
        let iLocation = col("Start Location")
        let iStartCond = col("Start Condition")
        let iEndCond = col("End Condition")
        let iNotes = col("Notes")

        func cell(_ row: [String], _ i: Int?) -> String? {
            guard let i, i < row.count else { return nil }
            let t = row[i].trimmingCharacters(in: .whitespaces)
            return t.isEmpty ? nil : t
        }
        func problem(_ msg: String) {
            if plan.problems.count < 20 { plan.problems.append(msg) }
            else if plan.problems.count == 20 { plan.problems.append("…and more — these rows were skipped, not guessed.") }
        }

        for r in 1..<rows.count {
            let row = rows[r]
            guard let type = cell(row, iType) else { continue }
            guard let start = parseLocalDateTime(cell(row, iStart)) else {
                problem("Row \(r + 1) (\(type)): unreadable start time.")
                continue
            }
            let end = parseLocalDateTime(cell(row, iEnd))
            let durationMin = parseDurationMin(cell(row, iDuration))
            let location = cell(row, iLocation)
            let startCond = cell(row, iStartCond)
            let endCond = cell(row, iEndCond)
            let note = cell(row, iNotes)

            var new = NewEntry(babyId: babyId, type: .nappy, occurredAt: start, createdBy: userId)
            new.note = note
            new.source = "huckleberry"

            switch type.lowercased() {
            case "sleep":
                guard let end else { problem("Row \(r + 1) (Sleep): no end time."); continue }
                new.type = .sleep
                new.endedAt = end
                plan.drafts.append(new)
            case "feed":
                if location?.lowercased() == "bottle" {
                    guard let ml = parseVolumeMl(endCond) else {
                        problem("Row \(r + 1) (Bottle feed): unreadable amount.")
                        continue
                    }
                    let isBreastMilk = startCond?.lowercased().contains("breast") == true
                    new.type = .feed
                    new.endedAt = end
                    new.feedType = isBreastMilk ? "expressed" : "formula"
                    if isBreastMilk { new.expressedMl = ml } else { new.formulaMl = ml }
                    plan.drafts.append(new)
                } else {
                    var left = parseDurationMin(startCond, maxMin: 180)
                    var right = parseDurationMin(endCond, maxMin: 180)
                    if left == nil, right == nil, let total = durationMin {
                        let loc = location?.lowercased() ?? ""
                        if loc.contains("left") { left = total } else if loc.contains("right") { right = total }
                    }
                    new.type = .feed
                    new.endedAt = end
                    new.feedType = "breast"
                    new.leftMin = left
                    new.rightMin = right
                    plan.drafts.append(new)
                }
            case "diaper":
                let info = "\(startCond ?? "") \(endCond ?? "")".lowercased()
                let wet = info.contains("pee") || info.contains("wet") || info.contains("urine")
                let dirty = info.contains("poo") || info.contains("dirty") || info.contains("stool") || info.contains(" bm")
                let dry = info.contains("dry")
                guard wet || dirty || dry else {
                    problem("Row \(r + 1) (Diaper): contents unreadable.")
                    continue
                }
                new.type = .nappy
                new.wet = wet
                new.dirty = dirty
                plan.drafts.append(new)
            case "pump":
                let total = (parseVolumeMl(startCond) ?? 0) + (parseVolumeMl(endCond) ?? 0)
                guard total > 0 else { problem("Row \(r + 1) (Pump): no readable amount."); continue }
                new.type = .pump
                new.expressedMl = total
                plan.drafts.append(new)
            case "growth":
                guard let g = parseWeightG([startCond, endCond, note]) else {
                    problem("Row \(r + 1) (Growth): no readable weight.")
                    continue
                }
                new.type = .weight
                new.weightG = g
                plan.drafts.append(new)
            case "temperature":
                guard let t = parseTempC([startCond, endCond, note]) else {
                    problem("Row \(r + 1) (Temperature): no readable value.")
                    continue
                }
                new.type = .temperature
                new.tempC = t
                plan.drafts.append(new)
            case "meds":
                new.type = .medication
                new.medKind = "dose"
                new.medSubject = "baby"
                new.medName = startCond ?? "Medicine"
                new.medDose = endCond
                plan.drafts.append(new)
            default:
                plan.skipped[type, default: 0] += 1
            }
        }
        return plan
    }
}
