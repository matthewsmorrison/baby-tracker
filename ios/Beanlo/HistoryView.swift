import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var store: Store
    @Binding var editing: Entry?
    @State private var view: Mode = .calendar
    @State private var lightboxURL: URL?
    @State private var loadingOlder = false

    enum Mode { case calendar, timeline }

    private var feedEntries: [Entry] {
        store.entries.filter { $0.type != .medication || $0.medKind == "dose" }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Picker("View", selection: $view) {
                    Text("Calendar").tag(Mode.calendar)
                    Text("Timeline").tag(Mode.timeline)
                }
                .pickerStyle(.segmented)

                if feedEntries.isEmpty && !store.loading {
                    ContentUnavailableView(
                        "Nothing logged yet",
                        systemImage: "moon.stars",
                        description: Text("Tap + to log a feed, nappy or weight — including past days you backdate.")
                    )
                } else if view == .calendar {
                    CalendarSection(entries: feedEntries, editing: $editing, lightboxURL: $lightboxURL, loadOlder: loadOlder)
                } else {
                    timeline
                }

                Text(Clinical.disclaimer)
                    .font(.caption2)
                    .foregroundStyle(Color.faint)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 90)
            }
            .padding(.horizontal, 16)
        }
        .background(Color.sand)
        .navigationTitle("History")
        .refreshable { await store.refresh() }
        .fullScreenCover(item: Binding(
            get: { lightboxURL.map { LightboxItem(url: $0) } },
            set: { lightboxURL = $0?.url }
        )) { item in
            Lightbox(url: item.url) { lightboxURL = nil }
        }
    }

    private func loadOlder() {
        guard !loadingOlder else { return }
        loadingOlder = true
        Task {
            await store.loadOlderEntries()
            loadingOlder = false
        }
    }

    // MARK: - Timeline

    private var timeline: some View {
        let groups = Dictionary(grouping: feedEntries) { $0.occurredAt.dayKey }
            .map { (key: $0.key, entries: $0.value) }
            .sorted { $0.key > $1.key }

        return VStack(spacing: 16) {
            ForEach(groups, id: \.key) { group in
                VStack(alignment: .leading, spacing: 8) {
                    DayHeader(date: group.entries[0].occurredAt, entries: group.entries, dayKey: group.key)
                    Card(padding: 6) {
                        VStack(spacing: 0) {
                            ForEach(group.entries) { entry in
                                ExpandableEntryRow(entry: entry, editing: $editing, lightboxURL: $lightboxURL)
                                if entry.id != group.entries.last?.id {
                                    Divider().padding(.leading, 56)
                                }
                            }
                        }
                    }
                }
            }
            if store.hasMoreHistory {
                Button {
                    loadOlder()
                } label: {
                    Text(loadingOlder ? "Loading…" : "Load older entries")
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.glass)
                .disabled(loadingOlder)
            }
        }
    }
}

private struct LightboxItem: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

// MARK: - Day header (shared)

struct DayHeader: View {
    @EnvironmentObject private var store: Store
    let date: Date
    let entries: [Entry]
    let dayKey: String

    var body: some View {
        let dol = store.baby.map { Clinical.dayOfLife(birthAt: $0.birthAt, at: date) }
        let nappies = entries.filter { $0.type == .nappy }
        let wet = nappies.filter { $0.dirty != true }.count
        let dirty = nappies.count - wet
        let feeds = entries.filter { $0.type == .feed }.count
        let tags = store.dayTags.filter { $0.day == dayKey }

        HStack(spacing: 6) {
            Text("\(dol.map { "Day \($0) · " } ?? "")\(date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)))")
                .font(.system(.footnote, design: .rounded, weight: .bold))
            ForEach(tags) { tag in
                Text(tag.tag == "no_poo" ? "no poo" : "teething")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background((tag.tag == "no_poo" ? Color.muted : Color.watch).opacity(0.15), in: .capsule)
                    .foregroundStyle(tag.tag == "no_poo" ? Color.muted : Color.watch)
            }
            Spacer()
            Text("\(wet) wet · \(dirty) dirty · \(feeds) feeds")
                .font(.caption2)
                .foregroundStyle(Color.muted)
        }
        .padding(.horizontal, 4)
    }
}

// MARK: - Calendar

private struct CalendarSection: View {
    @EnvironmentObject private var store: Store
    let entries: [Entry]
    @Binding var editing: Entry?
    @Binding var lightboxURL: URL?
    let loadOlder: () -> Void

    @State private var month: Date = Calendar.current.dateInterval(of: .month, for: .now)!.start
    @State private var selectedKey: String = Date().dayKey

    var body: some View {
        let cal = Calendar.current
        let byDay = Dictionary(grouping: entries) { $0.occurredAt.dayKey }
        let todayKey = Date().dayKey

        VStack(spacing: 14) {
            Card {
                VStack(spacing: 10) {
                    HStack {
                        Button {
                            month = cal.date(byAdding: .month, value: -1, to: month)!
                            loadOlder()
                        } label: {
                            Image(systemName: "chevron.left").foregroundStyle(Color.muted)
                        }
                        Spacer()
                        Text(month.formatted(.dateTime.month(.wide).year()))
                            .font(.system(.subheadline, design: .rounded, weight: .bold))
                        Spacer()
                        Button {
                            month = cal.date(byAdding: .month, value: 1, to: month)!
                        } label: {
                            Image(systemName: "chevron.right").foregroundStyle(Color.muted)
                        }
                    }

                    // A non-lazy Grid: LazyVGrid re-measures rows on the way
                    // back up a scroll, letting busy cells paint over the
                    // legend below. A month is ~42 cells — laziness buys nothing.
                    let monthCells = cells(cal: cal)
                    let weekdays = ["M", "T", "W", "T", "F", "S", "S"]
                    Grid(horizontalSpacing: 4, verticalSpacing: 4) {
                        GridRow {
                            ForEach(weekdays.indices, id: \.self) { i in
                                Text(weekdays[i])
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Color.faint)
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        ForEach(Array(stride(from: 0, to: monthCells.count, by: 7)), id: \.self) { start in
                            GridRow {
                                ForEach(monthCells[start..<min(start + 7, monthCells.count)], id: \.self) { cell in
                                    if let date = cell.date {
                                        dayCell(date: date, entries: byDay[date.dayKey] ?? [], todayKey: todayKey)
                                    } else {
                                        Color.clear.frame(height: 52)
                                    }
                                }
                            }
                        }
                    }

                    HStack(spacing: 12) {
                        Label("feeds", systemImage: "waterbottle.fill")
                        Label("nappies", systemImage: "drop.fill")
                        Label { Text("weight") } icon: {
                            Image(systemName: "scalemass.fill").foregroundStyle(Color.positive)
                        }
                        HStack(spacing: 3) {
                            Circle().fill(Color.muted).frame(width: 6, height: 6)
                            Text("no poo")
                        }
                        HStack(spacing: 3) {
                            Circle().fill(Color.watch).frame(width: 6, height: 6)
                            Text("teething")
                        }
                    }
                    .font(.caption2)
                    .foregroundStyle(Color.muted)
                }
            }

            // Selected day
            let dayEntries = (byDay[selectedKey] ?? []).sorted { $0.occurredAt < $1.occurredAt }
            if let date = dayEntries.first?.occurredAt ?? keyDate(selectedKey) {
                VStack(alignment: .leading, spacing: 8) {
                    DayHeader(date: date, entries: dayEntries, dayKey: selectedKey)
                    if store.canEdit, selectedKey <= todayKey,
                       let birth = store.baby?.birthAt, selectedKey >= birth.dayKey {
                        HStack(spacing: 8) {
                            dayTagChip("no_poo", label: "No poo")
                            dayTagChip("teething", label: "Teething")
                        }
                        .padding(.horizontal, 4)
                    }
                    if dayEntries.isEmpty {
                        Card {
                            Text("Nothing logged this day. Past days can be added in Log with a backdated time.")
                                .font(.footnote)
                                .foregroundStyle(Color.muted)
                        }
                    } else {
                        Card(padding: 6) {
                            VStack(spacing: 0) {
                                ForEach(dayEntries) { entry in
                                    ExpandableEntryRow(entry: entry, editing: $editing, lightboxURL: $lightboxURL)
                                    if entry.id != dayEntries.last?.id {
                                        Divider().padding(.leading, 56)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func dayTagChip(_ tag: String, label: String) -> some View {
        let active = store.dayTags.contains { $0.day == selectedKey && $0.tag == tag }
        return Chip(label: label, active: active) {
            Task { await store.toggleDayTag(tag, day: selectedKey) }
        }
    }

    private struct Cell: Hashable {
        let date: Date?
        let index: Int
    }

    private func cells(cal: Calendar) -> [Cell] {
        guard let range = cal.range(of: .day, in: .month, for: month) else { return [] }
        let firstWeekday = (cal.component(.weekday, from: month) + 5) % 7 // Monday = 0
        var out: [Cell] = (0..<firstWeekday).map { Cell(date: nil, index: -$0 - 1) }
        for day in range {
            out.append(Cell(date: cal.date(byAdding: .day, value: day - 1, to: month), index: day))
        }
        return out
    }

    private func keyDate(_ key: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: key)
    }

    @ViewBuilder
    private func dayCell(date: Date, entries: [Entry], todayKey: String) -> some View {
        let key = date.dayKey
        let feeds = entries.filter { $0.type == .feed }.count
        let nappies = entries.filter { $0.type == .nappy }.count
        let dirtyCount = entries.filter { $0.type == .nappy && $0.dirty == true }.count
        let hasWeight = entries.contains { $0.type == .weight }
        let tags = store.dayTags.filter { $0.day == key }.map(\.tag)
        let derivedNoPoo = key < todayKey && nappies > 0 && dirtyCount == 0
        let selected = selectedKey == key
        let beforeBirth = store.baby.map { date < Calendar.current.startOfDay(for: $0.birthAt) } ?? false

        Button {
            Haptics.tap()
            selectedKey = key
        } label: {
            VStack(spacing: 1) {
                Text("\(Calendar.current.component(.day, from: date))")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(selected ? Color.onInk : entries.isEmpty ? Color.faint : Color.ink)
                    .padding(.horizontal, 5)
                    .background(key == todayKey && !selected ? Color.accentSoft : .clear, in: .capsule)
                if feeds > 0 {
                    Text("🍼\(feeds)").font(.system(size: 8))
                }
                if nappies > 0 {
                    Text("💧\(nappies)").font(.system(size: 8))
                }
                HStack(spacing: 2) {
                    if hasWeight {
                        Image(systemName: "scalemass.fill")
                            .font(.system(size: 6))
                            .foregroundStyle(selected ? Color.onInk : Color.positive)
                    }
                    if tags.contains("no_poo") || derivedNoPoo {
                        Circle().fill(selected ? Color.onInk : Color.muted).frame(width: 4, height: 4)
                    }
                    if tags.contains("teething") {
                        Circle().fill(selected ? Color.onInk : Color.watch).frame(width: 4, height: 4)
                    }
                }
            }
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .top)
            .padding(.vertical, 3)
            .background(selected ? Color.ink : entries.isEmpty ? .clear : Color.surfaceAlt, in: .rect(cornerRadius: 10))
            .opacity(beforeBirth ? 0.35 : 1)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Expandable entry row

struct ExpandableEntryRow: View {
    @EnvironmentObject private var store: Store
    let entry: Entry
    @Binding var editing: Entry?
    @Binding var lightboxURL: URL?

    @State private var expanded = false
    @State private var confirmDelete = false

    private var expandable: Bool {
        entry.type == .feed || (entry.type == .nappy && (entry.stoolColour != nil || entry.nappyWeightG != nil || entry.photoPath != nil))
            || (entry.type == .weight && entry.weightG != nil)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                if let path = entry.photoPath {
                    PhotoThumb(path: path) { url in lightboxURL = url }
                }
                EntryRowContent(entry: entry, hasPhoto: entry.photoPath != nil)
                Spacer(minLength: 4)
                if expandable {
                    Image(systemName: "chevron.right")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.faint)
                        .rotationEffect(.degrees(expanded ? 90 : 0))
                }
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 10)
            .contentShape(.rect)
            .onTapGesture {
                if expandable {
                    Haptics.tap()
                    withAnimation(.snappy) { expanded.toggle() }
                }
            }
            .contextMenu {
                if store.canEdit {
                    Button {
                        editing = entry
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }
                    Button(role: .destructive) {
                        Task { try? await store.delete(entry) }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }

            if expanded {
                detail
                    .padding(.horizontal, 12)
                    .padding(.bottom, 12)
                    .transition(.opacity)
            }
        }
    }

    @ViewBuilder
    private var detail: some View {
        VStack(alignment: .leading, spacing: 8) {
            switch entry.type {
            case .feed:
                if let n = entry.feedNotes {
                    ForEach([("Left", n.left), ("Right", n.right), ("Expressed", n.expressed), ("Formula", n.formula)], id: \.0) { label, note in
                        if let note {
                            Text("\(label): “\(note)”").font(.caption).foregroundStyle(Color.muted)
                        }
                    }
                }
                HStack(spacing: 10) {
                    if entry.spitUp == true {
                        Label("Spit-up", systemImage: "aqi.low").font(.caption).foregroundStyle(Color.watch)
                    }
                    if let mood = entry.postFeedMood {
                        Text("Ended \(mood)").font(.caption).foregroundStyle(Color.muted)
                    }
                }
            case .nappy:
                if let colour = entry.stoolColour.flatMap(StoolColour.init(rawValue:)) {
                    HStack(spacing: 6) {
                        Circle().fill(Color(light: colour.swatch, dark: colour.swatch))
                            .frame(width: 12, height: 12)
                            .overlay(Circle().strokeBorder(Color.line, lineWidth: 1))
                        Text(colour.label).font(.caption).foregroundStyle(Color.muted)
                    }
                }
                if let out = Clinical.nappyOutputG(nappyWeightG: entry.nappyWeightG, baseWeightG: store.baby?.nappyBaseWeightG) {
                    Text("≈ \(out) g of output vs the \(store.baby?.nappyBaseWeightG ?? 0) g dry nappy")
                        .font(.caption).foregroundStyle(Color.muted)
                }
            case .weight:
                if let g = entry.weightG, let birth = store.baby?.birthWeightG {
                    let ws = Clinical.weightStatus(weightG: g, birthWeightG: birth)
                    Text(String(format: "%+.1f%% vs birth — %@", ws.pct, ws.message))
                        .font(.caption).foregroundStyle(Color.muted)
                }
            default:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Row label/time content, shared by timeline and calendar rows.
struct EntryRowContent: View {
    let entry: Entry
    var hasPhoto = false

    var body: some View {
        HStack(spacing: 12) {
            if !hasPhoto {
                Image(systemName: entry.type.symbol)
                    .font(.subheadline)
                    .foregroundStyle(EntryDisplay.tint(entry))
                    .frame(width: 36, height: 36)
                    .background(EntryDisplay.tint(entry).opacity(0.12), in: .rect(cornerRadius: 11))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(EntryDisplay.title(entry))
                    .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    .foregroundStyle(Color.ink)
                if let note = entry.note, !note.isEmpty {
                    Text("“\(note)”").font(.caption).foregroundStyle(Color.muted).lineLimit(2)
                }
            }
            Spacer()
            Text(EntryDisplay.time(entry))
                .font(.caption.monospacedDigit())
                .foregroundStyle(Color.muted)
        }
    }
}

/// 40pt photo thumbnail with a signed URL (private bucket).
struct PhotoThumb: View {
    @EnvironmentObject private var store: Store
    let path: String
    let onTap: (URL) -> Void
    @State private var url: URL?

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.surfaceAlt
                }
                .frame(width: 40, height: 40)
                .clipShape(.rect(cornerRadius: 10))
                .onTapGesture { onTap(url) }
            } else {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.surfaceAlt)
                    .frame(width: 40, height: 40)
                    .overlay(Image(systemName: "photo").font(.caption).foregroundStyle(Color.faint))
            }
        }
        .task { url = await store.signedPhotoURL(path) }
    }
}

struct Lightbox: View {
    let url: URL
    let dismiss: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            AsyncImage(url: url) { image in
                image.resizable().scaledToFit()
            } placeholder: {
                ProgressView().tint(.white)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(12)
                    .background(.white.opacity(0.15), in: .circle)
            }
            .padding(20)
        }
        .onTapGesture { dismiss() }
    }
}

/// Entry display helpers — the iOS twin of the web's entryLabel logic.
enum EntryDisplay {
    static func tint(_ entry: Entry) -> Color {
        switch entry.type {
        case .nappy: entry.dirty == true ? .chartBrown : .chartBlue
        case .feed: .accent
        case .sleep, .carerSleep: Color(light: 0x4A3AA7, dark: 0x9C8FE0)
        case .weight: .positive
        case .pump: Color(light: 0x0F8A8A, dark: 0x4FB3B3)
        case .temperature: .alertTone
        case .milestone: .accent
        case .medication: Color(light: 0x8A4A7A, dark: 0xC08AB0)
        }
    }

    static func title(_ entry: Entry) -> String {
        switch entry.type {
        case .nappy:
            return entry.dirty == true ? "Mixed nappy" : "Wet nappy"
        case .feed:
            var parts: [String] = []
            if let l = entry.leftMin, l > 0 { parts.append("L \(l)m") }
            if let r = entry.rightMin, r > 0 { parts.append("R \(r)m") }
            if let e = entry.expressedMl, e > 0 { parts.append("EBM \(e) ml") }
            if let f = entry.formulaMl, f > 0 { parts.append("Formula \(f) ml") }
            if let v = entry.volumeMl, v > 0, parts.isEmpty { parts.append("\(v) ml") }
            return "Feed · " + (parts.isEmpty ? "logged" : parts.joined(separator: " + "))
        case .sleep:
            if let end = entry.endedAt {
                let mins = Int(end.timeIntervalSince(entry.occurredAt) / 60)
                return "Slept \(mins / 60)h \(mins % 60)m"
            }
            return "Sleeping…"
        case .carerSleep:
            if let end = entry.endedAt {
                let mins = Int(end.timeIntervalSince(entry.occurredAt) / 60)
                return "Carer slept \(mins / 60)h \(mins % 60)m"
            }
            return "Resting…"
        case .weight:
            var parts: [String] = []
            if let g = entry.weightG { parts.append(String(format: "%.2f kg", Double(g) / 1000)) }
            if let mm = entry.lengthMm { parts.append(String(format: "%.1f cm", Double(mm) / 10)) }
            if let mm = entry.headCircMm { parts.append(String(format: "head %.1f cm", Double(mm) / 10)) }
            return parts.isEmpty ? "Measurement" : parts.joined(separator: " · ")
        case .pump:
            return "Pumped \(entry.expressedMl ?? 0) ml"
        case .temperature:
            return entry.tempC.map { String(format: "Temp · %.1f °C", $0) } ?? "Temperature"
        case .milestone:
            return entry.milestoneLabel ?? "Milestone"
        case .medication:
            let dose = entry.medDose.map { " \($0)" } ?? ""
            let subject = entry.medSubject == "mother" ? " (mother)" : ""
            return "\(entry.medName ?? "Medicine")\(subject)\(dose) · given"
        }
    }

    static func time(_ entry: Entry) -> String {
        if let end = entry.endedAt, entry.type == .sleep || entry.type == .feed || entry.type == .carerSleep {
            return "\(entry.occurredAt.timeLabel) – \(end.timeLabel)"
        }
        return entry.occurredAt.timeLabel
    }
}
