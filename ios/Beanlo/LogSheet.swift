import SwiftUI
import PhotosUI
import ImageIO

/// Log or edit any entry type. Presented as a sheet from the floating + or
/// from a History row.
struct LogSheet: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss

    let initialType: EntryType
    var editing: Entry?
    var startAsCourse = false

    @State private var type: EntryType = .nappy
    @State private var occurredAt = Date()
    @State private var note = ""
    @State private var busy = false
    @State private var error: String?

    // Nappy
    @State private var dirty = false
    @State private var stoolColour: StoolColour?
    @State private var nappyWeightText = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var photoData: Data?
    @State private var showCamera = false
    @State private var photoTimeBanner: String?
    @State private var colourSuggested = false
    // Feed — breast minutes live in the app-global timer (store.feedTimer)
    // for new entries so they survive closing the sheet; editing uses plain
    // local steppers.
    @State private var leftMin = 0
    @State private var rightMin = 0
    @State private var expressedMl = 0
    @State private var formulaMl = 0
    @State private var noteLeft = ""
    @State private var noteRight = ""
    @State private var noteExpressed = ""
    @State private var noteFormula = ""
    @State private var spitUp = false
    @State private var mood: String?
    @State private var finishedAt: Date?
    // Sleep
    @State private var sleepEnd = Date()
    @State private var sleepOngoing = true
    @State private var sleepLocation: String?
    @State private var settleMethod: String?
    // Measurements
    @State private var weightGText = ""
    @State private var lengthCmText = ""
    @State private var headCmText = ""
    // Pump
    @State private var pumpMl = 0
    // Temperature
    @State private var tempText = ""
    // Medication
    @State private var medName = ""
    @State private var medDose = ""
    @State private var medForMother = false
    @State private var medIsCourse = false
    @State private var reminderTimes: [Date] = []
    @State private var courseEnded = false
    @State private var courseEndDate = Date()
    // Milestone
    @State private var milestoneText = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if editing == nil {
                        typePicker
                    }
                    form
                    notesField
                    whenPicker

                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Color.alertTone)
                    }
                }
                .padding(18)
            }
            .background(Color.sand)
            .navigationTitle(editing == nil ? "Log \(type.label.lowercased())" : "Edit \(type.label.lowercased())")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if busy { ProgressView() } else { Text("Save").bold() }
                    }
                    .disabled(busy || !valid)
                }
            }
        }
        .presentationDetents([.large])
        .presentationBackground(Color.sand)
        .onAppear { hydrate() }
    }

    // MARK: - Pieces

    private var typePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(store.trackedTypes) { t in
                    Chip(label: t.label, systemImage: t.symbol, active: type == t) {
                        withAnimation(.snappy) { type = t }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var form: some View {
        switch type {
        case .nappy:
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    CardTitle("What was in it?")
                    HStack(spacing: 10) {
                        BigChoice(label: "Wet only", symbol: "drop.fill", tint: .chartBlue, active: !dirty) {
                            withAnimation(.snappy) { dirty = false }
                        }
                        BigChoice(label: "Mixed", symbol: "aqi.medium", tint: .chartBrown, active: dirty) {
                            withAnimation(.snappy) {
                                dirty = true
                                suggestColour()
                            }
                        }
                    }
                    Text("Mixed = a nappy with poo (we assume wee too).")
                        .font(.caption2).foregroundStyle(Color.faint)

                    if dirty {
                        CardTitle(colourSuggested ? "Poo colour — suggested for this day & mix, tap to change" : "Poo colour (optional)")
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], spacing: 8) {
                            ForEach(StoolColour.allCases) { colour in
                                swatchChip(colour)
                            }
                        }
                        if let stoolColour, stoolColour.warns {
                            Text("Pale/chalky stool or blood always needs same-day advice — contact your midwife or doctor.")
                                .font(.caption)
                                .foregroundStyle(Color.alertTone)
                        }
                    }

                    CardTitle("Nappy weight (optional)")
                    HStack {
                        TextField(store.baby?.nappyBaseWeightG.map { "dry nappy is \($0) g" } ?? "grams", text: $nappyWeightText)
                            .keyboardType(.numberPad)
                            .font(.system(.body, design: .rounded))
                        Text("g").font(.caption).foregroundStyle(Color.muted)
                    }
                    if let g = Int(nappyWeightText), let base = store.baby?.nappyBaseWeightG {
                        let output = max(0, g - base)
                        Text(output >= Clinical.nappyWetThresholdG
                             ? "≈ \(output) g of output vs the \(base) g dry nappy"
                             : "≈ \(output) g vs the dry nappy — too little to count as wet on its own")
                            .font(.caption2)
                            .foregroundStyle(Color.muted)
                    }

                    CardTitle("Photo (optional)")
                    HStack(spacing: 10) {
                        Button {
                            showCamera = true
                        } label: {
                            Label("Take photo", systemImage: "camera")
                                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        }
                        .buttonStyle(.glass)
                        PhotosPicker(selection: $photoItem, matching: .images) {
                            Label(photoData == nil ? "Upload" : "Replace", systemImage: "photo")
                                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        }
                        .buttonStyle(.glass)
                    }
                    if photoData != nil {
                        HStack(spacing: 8) {
                            if let data = photoData, let image = UIImage(data: data) {
                                Image(uiImage: image)
                                    .resizable().scaledToFill()
                                    .frame(width: 48, height: 48)
                                    .clipShape(.rect(cornerRadius: 10))
                            }
                            if let banner = photoTimeBanner {
                                Text(banner).font(.caption2).foregroundStyle(Color.accent)
                            }
                            Spacer()
                            Button {
                                photoData = nil
                                photoItem = nil
                                photoTimeBanner = nil
                            } label: {
                                Image(systemName: "xmark.circle.fill").foregroundStyle(Color.faint)
                            }
                        }
                    }
                    Text("Photos are kept privately with the entry for your records.")
                        .font(.caption2).foregroundStyle(Color.faint)
                }
            }
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                Task { await loadPickedPhoto(item) }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraCapture { data in
                    photoData = data
                    photoTimeBanner = nil
                }
                .ignoresSafeArea()
            }

        case .feed:
            Card {
                VStack(alignment: .leading, spacing: 16) {
                    CardTitle("Breast")
                    if editing == nil {
                        liveTimerRow(.left)
                        partNote($noteLeft, placeholder: "Note on the left (e.g. latched well)")
                        liveTimerRow(.right)
                        partNote($noteRight, placeholder: "Note on the right")
                    } else {
                        editStepperRow(label: "Left", minutes: $leftMin)
                        partNote($noteLeft, placeholder: "Note on the left")
                        editStepperRow(label: "Right", minutes: $rightMin)
                        partNote($noteRight, placeholder: "Note on the right")
                    }
                    Divider()
                    CardTitle("Bottle")
                    MlStepper(label: "Expressed milk", value: $expressedMl)
                    partNote($noteExpressed, placeholder: "Note on expressed milk")
                    MlStepper(label: "Formula", value: $formulaMl)
                    partNote($noteFormula, placeholder: "Note on formula")
                    if expressedMl + formulaMl > 0 {
                        Text("Expressed breastmilk counts as breastfeeding for their poo — it's the formula that changes colour and texture.")
                            .font(.caption2)
                            .foregroundStyle(Color.positive)
                    }
                }
            }
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    CardTitle("How it ended (optional)")
                    HStack(spacing: 8) {
                        ForEach(["settled", "fussy", "crying"], id: \.self) { m in
                            Chip(label: m.capitalized, active: mood == m) {
                                mood = mood == m ? nil : m
                            }
                        }
                        Chip(label: "Spit-up", systemImage: spitUp ? "checkmark" : nil, active: spitUp) {
                            spitUp.toggle()
                        }
                    }
                    Toggle(isOn: Binding(
                        get: { finishedAt != nil },
                        set: { finishedAt = $0 ? Date() : nil }
                    ).animation(.snappy)) {
                        Text("Set a finish time").font(.system(.body, design: .rounded, weight: .medium))
                    }
                    .tint(.accent)
                    if finishedAt != nil {
                        DatePicker("Finished", selection: Binding(
                            get: { finishedAt ?? Date() },
                            set: { finishedAt = $0 }
                        ), in: occurredAt..., displayedComponents: [.date, .hourAndMinute])
                        .font(.system(.body, design: .rounded))
                    }
                }
            }

        case .sleep, .carerSleep:
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    Toggle(isOn: $sleepOngoing.animation(.snappy)) {
                        Text(type == .carerSleep ? "Still resting" : "Still asleep")
                            .font(.system(.body, design: .rounded, weight: .medium))
                    }
                    .tint(.accent)
                    if !sleepOngoing {
                        DatePicker("Woke at", selection: $sleepEnd, displayedComponents: [.date, .hourAndMinute])
                            .font(.system(.body, design: .rounded))
                        let mins = Int(max(0, sleepEnd.timeIntervalSince(occurredAt)) / 60)
                        Text("\(mins / 60)h \(mins % 60)m asleep")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.positive)
                    }
                }
            }
            if type == .sleep {
                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        CardTitle("Where (optional)")
                        chipFlow([
                            ("cot", "Cot / crib"), ("arms", "In arms"), ("next_to_me", "Next-to-me"),
                            ("pram", "Pram"), ("car_seat", "Car seat"), ("other", "Other"),
                        ], selection: $sleepLocation)
                        CardTitle("How they settled (optional)")
                        chipFlow([
                            ("self", "Self-settled"), ("fed", "Fed to sleep"),
                            ("rocked", "Rocked"), ("dummy", "Dummy"), ("other", "Other"),
                        ], selection: $settleMethod)
                    }
                }
            }

        case .weight:
            Card {
                VStack(alignment: .leading, spacing: 14) {
                    CardTitle("Weight")
                    HStack {
                        TextField("4880", text: $weightGText)
                            .keyboardType(.decimalPad)
                            .font(.stat(34))
                        Text("g").font(.system(.title3, design: .rounded)).foregroundStyle(Color.muted)
                    }
                    if let g = parsedWeightG {
                        Text(String(format: "= %.2f kg", Double(g) / 1000))
                            .font(.caption)
                            .foregroundStyle(Color.muted)
                    }
                    Divider()
                    CardTitle("Length (optional)")
                    HStack {
                        TextField("54.5", text: $lengthCmText)
                            .keyboardType(.decimalPad)
                            .font(.stat(24))
                        Text("cm").font(.system(.body, design: .rounded)).foregroundStyle(Color.muted)
                    }
                    CardTitle("Head circumference (optional)")
                    HStack {
                        TextField("37.0", text: $headCmText)
                            .keyboardType(.decimalPad)
                            .font(.stat(24))
                        Text("cm").font(.system(.body, design: .rounded)).foregroundStyle(Color.muted)
                    }
                    Text("Weight is optional too when logging just length or head — fill in whatever was measured.")
                        .font(.caption2).foregroundStyle(Color.faint)
                }
            }

        case .pump:
            Card {
                MlStepper(label: "Total expressed", value: $pumpMl)
            }

        case .temperature:
            Card {
                VStack(alignment: .leading, spacing: 10) {
                    CardTitle("Temperature")
                    HStack {
                        TextField("37.0", text: $tempText)
                            .keyboardType(.decimalPad)
                            .font(.stat(34))
                        Text("°C").font(.system(.title3, design: .rounded)).foregroundStyle(Color.muted)
                    }
                    Text("38°C or higher in a baby under 3 months needs same-day advice.")
                        .font(.caption2).foregroundStyle(Color.watch)
                }
            }

        case .medication:
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        Chip(label: "One-off dose", active: !medIsCourse) {
                            withAnimation(.snappy) { medIsCourse = false }
                        }
                        Chip(label: "Ongoing course", active: medIsCourse) {
                            withAnimation(.snappy) { medIsCourse = true }
                        }
                    }
                    Text(medIsCourse
                         ? "A course runs until stopped — it shows on Today and can send reminder alerts."
                         : "A dose is one moment — everyone caring for the baby sees when it was last given.")
                        .font(.caption2).foregroundStyle(Color.faint)
                    TextField(medIsCourse ? "Medicine (e.g. Iron)" : "Medicine (e.g. Calpol)", text: $medName)
                        .font(.system(.body, design: .rounded))
                    TextField(medIsCourse ? "Dose (e.g. 200 mg, one tablet)" : "Dose (e.g. 2.5 ml)", text: $medDose)
                        .font(.system(.body, design: .rounded))
                    HStack(spacing: 8) {
                        Chip(label: "For baby", active: !medForMother) { medForMother = false }
                        Chip(label: "For mother", active: medForMother) { medForMother = true }
                    }
                }
            }
            if medIsCourse {
                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        CardTitle("Reminders (optional)")
                        ForEach(reminderTimes.indices, id: \.self) { i in
                            HStack {
                                DatePicker("Reminder", selection: $reminderTimes[i], displayedComponents: .hourAndMinute)
                                    .labelsHidden()
                                Spacer()
                                Button {
                                    reminderTimes.remove(at: i)
                                } label: {
                                    Image(systemName: "xmark.circle.fill").foregroundStyle(Color.faint)
                                }
                            }
                        }
                        Button {
                            Haptics.tap()
                            reminderTimes.append(Calendar.current.date(bySettingHour: 8, minute: 0, second: 0, of: .now) ?? .now)
                        } label: {
                            Label("Add a reminder time", systemImage: "plus")
                                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        }
                        Text("A phone alert is sent at these times while the course is active — each carer needs notifications on in their Settings.")
                            .font(.caption2).foregroundStyle(Color.faint)
                        Toggle(isOn: $courseEnded.animation(.snappy)) {
                            Text("Course has ended").font(.system(.body, design: .rounded, weight: .medium))
                        }
                        .tint(.accent)
                        if courseEnded {
                            DatePicker("Stopped", selection: $courseEndDate, displayedComponents: [.date, .hourAndMinute])
                        }
                    }
                }
            }

        case .milestone:
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("First smile…", text: $milestoneText)
                        .font(.system(.body, design: .rounded))
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 8)], spacing: 8) {
                        ForEach(["First smile", "First laugh", "Held head up", "Rolled over",
                                 "Slept 5h+ stretch", "First bath", "Grasped a finger", "First outing"], id: \.self) { s in
                            Chip(label: s, active: milestoneText == s) {
                                milestoneText = milestoneText == s ? "" : s
                            }
                        }
                    }
                    Text("Babies reach these in their own time — this is a memory book, not a checklist.")
                        .font(.caption2).foregroundStyle(Color.faint)
                }
            }
        }
    }

    /// New-entry row: play/pause drives the app-global timer (which also
    /// runs the lock-screen Live Activity); the stepper adjusts banked time
    /// while paused.
    private func liveTimerRow(_ side: FeedSide) -> some View {
        let running = store.feedTimer.side == side
        return HStack(spacing: 12) {
            Button {
                Haptics.tap()
                store.toggleFeedTimer(side)
            } label: {
                Image(systemName: running ? "pause.fill" : "play.fill")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(running ? Color.onInk : Color.ink)
                    .frame(width: 42, height: 42)
                    .background(running ? Color.ink : Color.surfaceAlt, in: .circle)
                    .overlay(Circle().strokeBorder(Color.line, lineWidth: running ? 0 : 1))
            }
            .buttonStyle(.plain)

            Text(side.label).font(.system(.body, design: .rounded, weight: .medium))
            Spacer()
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let secs = Int(store.feedTimer.total(side, at: context.date))
                HStack(spacing: 0) {
                    Text(String(format: "%d:%02d", secs / 60, secs % 60))
                        .font(.stat(22))
                        .monospacedDigit()
                        .foregroundStyle(running ? Color.accent : Color.ink)
                    Text(" min").font(.caption).foregroundStyle(Color.muted)
                }
            }
            Stepper("", value: Binding(
                get: { Int(store.feedTimer.total(side) / 60) },
                set: { store.setFeedTimerMinutes(side, $0) }
            ), in: 0...180)
            .labelsHidden()
            .disabled(running)
        }
    }

    /// Picked photo: compress + EXIF timestamp inference (like the web).
    private func loadPickedPhoto(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        if let source = CGImageSourceCreateWithData(data as CFData, nil),
           let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
           let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any],
           let raw = (exif[kCGImagePropertyExifDateTimeOriginal]
                      ?? exif[kCGImagePropertyExifDateTimeDigitized]) as? String {
            // "2026:07:06 15:20:00" as local wall-clock time.
            let f = DateFormatter()
            f.dateFormat = "yyyy:MM:dd HH:mm:ss"
            if let taken = f.date(from: raw), taken <= Date().addingTimeInterval(60) {
                occurredAt = taken
                photoTimeBanner = "Time set from the photo"
            }
        }
        photoData = UIImage(data: data)?.compressedJPEG()
    }

    /// Suggest a stool colour from the day of life + feeding mix in the 24 h
    /// before this entry (backdate-correct), like the web form.
    private func suggestColour() {
        guard dirty, stoolColour == nil || colourSuggested, let baby = store.baby else { return }
        let day = Clinical.dayOfLife(birthAt: baby.birthAt, at: occurredAt)
        let before = store.entries.filter {
            $0.type == .feed && $0.occurredAt <= occurredAt
            && occurredAt.timeIntervalSince($0.occurredAt) <= 86_400
        }
        let mix = Clinical.summariseFeeds(before).mix
        stoolColour = Clinical.expectedColourKey(day: day, mix: mix)
        colourSuggested = true
    }

    private func partNote(_ text: Binding<String>, placeholder: String) -> some View {
        TextField(placeholder, text: text)
            .font(.caption)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.surfaceAlt, in: .rect(cornerRadius: 10))
    }

    private func chipFlow(_ options: [(String, String)], selection: Binding<String?>) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], spacing: 8) {
            ForEach(options, id: \.0) { value, label in
                Chip(label: label, active: selection.wrappedValue == value) {
                    selection.wrappedValue = selection.wrappedValue == value ? nil : value
                }
            }
        }
    }

    private func swatchChip(_ colour: StoolColour) -> some View {
        let active = stoolColour == colour
        return Button {
            Haptics.tap()
            colourSuggested = false
            withAnimation(.snappy) { stoolColour = active ? nil : colour }
        } label: {
            HStack(spacing: 6) {
                Circle()
                    .fill(Color(light: colour.swatch, dark: colour.swatch))
                    .frame(width: 14, height: 14)
                    .overlay(Circle().strokeBorder(Color.line, lineWidth: 1))
                Text(colour.label)
                    .font(.system(.caption, design: .rounded, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(active ? Color.accentSoft : Color.surfaceAlt, in: .rect(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(active ? Color.accent : Color.line, lineWidth: active ? 1.5 : 1)
            )
            .foregroundStyle(Color.ink)
        }
        .buttonStyle(.plain)
    }

    private func editStepperRow(label: String, minutes: Binding<Int>) -> some View {
        HStack(spacing: 12) {
            Text(label).font(.system(.body, design: .rounded, weight: .medium))
            Spacer()
            HStack(spacing: 0) {
                Text("\(minutes.wrappedValue)")
                    .font(.stat(22))
                    .contentTransition(.numericText())
                Text(" min").font(.caption).foregroundStyle(Color.muted)
            }
            Stepper("", value: minutes, in: 0...180).labelsHidden()
        }
    }

    private var notesField: some View {
        Card {
            TextField("Anything worth remembering (optional)", text: $note, axis: .vertical)
                .lineLimit(2...4)
                .font(.system(.body, design: .rounded))
        }
    }

    private var whenPicker: some View {
        Card {
            DatePicker("When", selection: $occurredAt, in: ...Date().addingTimeInterval(60), displayedComponents: [.date, .hourAndMinute])
                .font(.system(.body, design: .rounded, weight: .medium))
        }
    }

    // MARK: - Save

    /// Weight is entered in grams like the web ("4880"). A value under 100
    /// can only be kilograms typed from habit ("4.88"), so convert it.
    private var parsedWeightG: Int? {
        guard let raw = Double(weightGText.replacingOccurrences(of: ",", with: ".")), raw > 0 else { return nil }
        return Int((raw < 100 ? raw * 1000 : raw).rounded())
    }

    private var valid: Bool {
        switch type {
        case .feed:
            if editing != nil { return leftMin + rightMin + expressedMl + formulaMl > 0 }
            return store.feedTimer.isActive || expressedMl + formulaMl > 0
        case .weight:
            return [weightGText, lengthCmText, headCmText]
                .contains { Double($0.replacingOccurrences(of: ",", with: ".")) != nil }
        case .pump: return pumpMl > 0
        case .temperature: return Double(tempText.replacingOccurrences(of: ",", with: ".")) != nil
        case .medication: return !medName.trimmingCharacters(in: .whitespaces).isEmpty
        case .milestone: return !milestoneText.trimmingCharacters(in: .whitespaces).isEmpty
        default: return true
        }
    }

    private func hydrate() {
        type = initialType
        if startAsCourse { medIsCourse = true }
        #if DEBUG
        if UserDefaults.standard.bool(forKey: "DevDirty") { dirty = true }
        #endif
        guard let e = editing else { return }
        occurredAt = e.occurredAt
        note = e.note ?? ""
        dirty = e.dirty ?? false
        stoolColour = e.stoolColour.flatMap(StoolColour.init(rawValue:))
        nappyWeightText = e.nappyWeightG.map(String.init) ?? ""
        if let mm = e.lengthMm { lengthCmText = String(format: "%.1f", Double(mm) / 10) }
        if let mm = e.headCircMm { headCmText = String(format: "%.1f", Double(mm) / 10) }
        leftMin = e.leftMin ?? 0
        rightMin = e.rightMin ?? 0
        expressedMl = e.expressedMl ?? 0
        formulaMl = e.formulaMl ?? 0
        if e.type == .sleep || e.type == .carerSleep {
            if let end = e.endedAt { sleepEnd = end; sleepOngoing = false }
        } else if let end = e.endedAt, e.type == .feed {
            finishedAt = end
        }
        sleepLocation = e.sleepLocation
        settleMethod = e.settleMethod
        spitUp = e.spitUp ?? false
        mood = e.postFeedMood
        noteLeft = e.feedNotes?.left ?? ""
        noteRight = e.feedNotes?.right ?? ""
        noteExpressed = e.feedNotes?.expressed ?? ""
        noteFormula = e.feedNotes?.formula ?? ""
        medIsCourse = e.type == .medication && e.medKind != "dose"
        if medIsCourse {
            let formatter = DateFormatter()
            formatter.dateFormat = "HH:mm"
            reminderTimes = (e.reminderTimes ?? []).compactMap { formatter.date(from: $0) }
            if let end = e.endedAt { courseEnded = true; courseEndDate = end }
        }
        if let g = e.weightG { weightGText = String(g) }
        pumpMl = e.expressedMl ?? 0
        if let t = e.tempC { tempText = String(format: "%.1f", t) }
        medName = e.medName ?? ""
        medDose = e.medDose ?? ""
        medForMother = e.medSubject == "mother"
        milestoneText = e.milestoneLabel ?? ""
    }

    private func save() async {
        guard let baby = store.baby, let userId = store.userId else { return }
        // Bank a running side so its seconds count.
        if type == .feed, editing == nil, let running = store.feedTimer.side {
            store.toggleFeedTimer(running)
        }
        if type == .feed, editing == nil {
            let t = store.feedTimer
            leftMin = t.accLeft > 0 ? max(1, Int((t.accLeft / 60).rounded())) : 0
            rightMin = t.accRight > 0 ? max(1, Int((t.accRight / 60).rounded())) : 0
        }
        busy = true
        error = nil

        var new = NewEntry(babyId: baby.id, type: type, occurredAt: occurredAt, createdBy: userId)
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        new.note = trimmedNote.isEmpty ? nil : trimmedNote

        switch type {
        case .nappy:
            new.wet = true
            new.dirty = dirty
            new.stoolColour = dirty ? stoolColour?.rawValue : nil
            new.nappyWeightG = Int(nappyWeightText.trimmingCharacters(in: .whitespaces))
        case .feed:
            new.leftMin = leftMin > 0 ? leftMin : nil
            new.rightMin = rightMin > 0 ? rightMin : nil
            new.expressedMl = expressedMl > 0 ? expressedMl : nil
            new.formulaMl = formulaMl > 0 ? formulaMl : nil
            let breast = leftMin + rightMin > 0
            let bottle = expressedMl + formulaMl > 0
            new.feedType = breast && bottle ? "mixed"
                : breast ? "breast"
                : expressedMl > 0 && formulaMl > 0 ? "mixed"
                : expressedMl > 0 ? "expressed" : "formula"
            new.endedAt = finishedAt
                ?? (breast ? occurredAt.addingTimeInterval(TimeInterval((leftMin + rightMin) * 60)) : nil)
            new.spitUp = spitUp ? true : nil
            new.postFeedMood = mood
            var notes = FeedNotes()
            notes.left = noteLeft.isEmpty ? nil : noteLeft
            notes.right = noteRight.isEmpty ? nil : noteRight
            notes.expressed = noteExpressed.isEmpty ? nil : noteExpressed
            notes.formula = noteFormula.isEmpty ? nil : noteFormula
            new.feedNotes = notes.isEmpty ? nil : notes
        case .sleep, .carerSleep:
            new.endedAt = sleepOngoing ? nil : sleepEnd
            if type == .sleep {
                new.sleepLocation = sleepLocation
                new.settleMethod = settleMethod
            }
        case .weight:
            if let g = parsedWeightG {
                new.weightG = g
            }
            if let cm = Double(lengthCmText.replacingOccurrences(of: ",", with: ".")) {
                new.lengthMm = Int(cm * 10)
            }
            if let cm = Double(headCmText.replacingOccurrences(of: ",", with: ".")) {
                new.headCircMm = Int(cm * 10)
            }
        case .pump:
            new.expressedMl = pumpMl
        case .temperature:
            new.tempC = Double(tempText.replacingOccurrences(of: ",", with: "."))
        case .medication:
            new.medName = medName.trimmingCharacters(in: .whitespaces)
            new.medDose = medDose.isEmpty ? nil : medDose
            new.medKind = medIsCourse ? "course" : "dose"
            new.medSubject = medForMother ? "mother" : "baby"
            if medIsCourse {
                if !reminderTimes.isEmpty {
                    let formatter = DateFormatter()
                    formatter.dateFormat = "HH:mm"
                    new.reminderTimes = reminderTimes.map(formatter.string(from:)).sorted()
                    new.reminderTz = TimeZone.current.identifier
                    if let userId = store.userId { new.reminderUserIds = [userId] }
                }
                new.endedAt = courseEnded ? courseEndDate : nil
            }
        case .milestone:
            new.milestoneLabel = milestoneText.trimmingCharacters(in: .whitespaces)
        }

        do {
            if var existing = editing {
                existing.occurredAt = new.occurredAt
                existing.note = new.note
                existing.wet = new.wet ?? existing.wet
                existing.dirty = new.dirty ?? existing.dirty
                if type == .nappy {
                    existing.stoolColour = new.stoolColour
                    existing.nappyWeightG = new.nappyWeightG
                }
                existing.lengthMm = new.lengthMm ?? existing.lengthMm
                existing.headCircMm = new.headCircMm ?? existing.headCircMm
                existing.leftMin = new.leftMin
                existing.rightMin = new.rightMin
                existing.expressedMl = new.expressedMl ?? (type == .pump ? pumpMl : nil)
                existing.formulaMl = new.formulaMl
                existing.feedType = new.feedType ?? existing.feedType
                existing.endedAt = type == .sleep || type == .carerSleep
                    ? (sleepOngoing ? nil : sleepEnd) : new.endedAt ?? existing.endedAt
                existing.weightG = new.weightG ?? existing.weightG
                existing.tempC = new.tempC ?? existing.tempC
                existing.medName = new.medName ?? existing.medName
                existing.medDose = new.medDose ?? existing.medDose
                if type == .sleep {
                    existing.sleepLocation = sleepLocation
                    existing.settleMethod = settleMethod
                }
                if type == .feed {
                    existing.spitUp = new.spitUp
                    existing.postFeedMood = new.postFeedMood
                    existing.feedNotes = new.feedNotes
                }
                if type == .medication, medIsCourse {
                    existing.reminderTimes = new.reminderTimes
                    existing.reminderTz = new.reminderTz
                    existing.reminderUserIds = new.reminderUserIds ?? existing.reminderUserIds
                    existing.endedAt = courseEnded ? courseEndDate : nil
                }
                if type == .milestone {
                    existing.milestoneLabel = milestoneText.trimmingCharacters(in: .whitespaces)
                }
                try await store.update(existing)
            } else {
                let inserted = try await store.save(new)
                if type == .feed { store.clearFeedTimer() }
                if type == .nappy, let data = photoData {
                    let path = try await store.uploadNappyPhoto(data, entryId: inserted.id)
                    await store.setPhotoPath(path, entryId: inserted.id)
                }
            }
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }
}

// MARK: - Form controls

private struct BigChoice: View {
    let label: String
    let symbol: String
    let tint: Color
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            VStack(spacing: 6) {
                Image(systemName: symbol).font(.title3)
                Text(label).font(.system(.subheadline, design: .rounded, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(active ? tint.opacity(0.16) : Color.surfaceAlt, in: .rect(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(active ? tint : Color.line, lineWidth: active ? 2 : 1)
            )
            .foregroundStyle(active ? tint : Color.muted)
        }
        .buttonStyle(.plain)
        .animation(.snappy(duration: 0.18), value: active)
    }
}

private struct MlStepper: View {
    let label: String
    @Binding var value: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(label).font(.system(.body, design: .rounded, weight: .medium))
                Spacer()
                HStack(spacing: 0) {
                    Text("\(value)").font(.stat(22)).contentTransition(.numericText())
                    Text(" ml").font(.caption).foregroundStyle(Color.muted)
                }
            }
            HStack(spacing: 8) {
                ForEach([30, 60, 90], id: \.self) { amount in
                    Chip(label: "\(amount) ml", active: false) {
                        withAnimation(.snappy) { value += amount }
                    }
                }
                if value > 0 {
                    Chip(label: "Clear", active: false) {
                        withAnimation(.snappy) { value = 0 }
                    }
                }
            }
        }
    }
}
