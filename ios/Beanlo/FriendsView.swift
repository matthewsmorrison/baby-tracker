import SwiftUI
import CryptoKit

/// Friends: presence, MSN-style status lines, requests and E2EE messaging —
/// the same tables and rules as the web.
struct FriendsView: View {
    @EnvironmentObject private var store: Store
    @StateObject private var friends = FriendsStore()
    @State private var statusText = ""
    @State private var statusSaved = false
    @State private var addEmail = ""
    @State private var addMessage: String?
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Friends can see when you're online — and when you're up feeding at 3am, so can whoever else is.")
                    .font(.footnote)
                    .foregroundStyle(Color.muted)

                statusCard

                if !friends.incoming.isEmpty {
                    requestsCard
                }

                friendsCard

                addCard

                if !friends.outgoing.isEmpty {
                    sentCard
                }
                if !friends.blocked.isEmpty {
                    blockedCard
                }
                Spacer(minLength: 90)
            }
            .padding(16)
        }
        .background(Color.sand)
        .navigationTitle("Friends")
        .refreshable { await friends.load() }
        .task {
            friends.configure(store: store)
            await friends.publishKeyAndLoad()
        }
        .navigationDestination(for: Profile.self) { profile in
            FriendThreadView(friend: profile)
                .environmentObject(friends)
        }
    }

    private var statusCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                CardTitle("Your status")
                HStack(spacing: 8) {
                    TextField("e.g. running on 3 hours of sleep", text: $statusText)
                        .font(.system(.subheadline, design: .rounded))
                        .onAppear { statusText = store.myProfile?.statusText ?? "" }
                    Button {
                        Task {
                            await friends.setStatus(statusText)
                            statusSaved = true
                            try? await Task.sleep(for: .seconds(2))
                            statusSaved = false
                        }
                    } label: {
                        Image(systemName: statusSaved ? "checkmark" : "arrow.up.circle.fill")
                            .foregroundStyle(statusSaved ? Color.positive : Color.accent)
                            .font(.title3)
                    }
                }
            }
        }
    }

    private var requestsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                CardTitle("Friend requests")
                ForEach(friends.incoming, id: \.friendship.id) { item in
                    HStack {
                        AvatarView(profile: item.profile)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(item.profile.displayName)
                                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                            if let email = item.profile.email {
                                Text(email).font(.caption2).foregroundStyle(Color.muted)
                            }
                        }
                        Spacer()
                        Button("Accept") {
                            Task { await friends.accept(item.friendship) }
                        }
                        .buttonStyle(.glassProminent)
                        .font(.caption.weight(.semibold))
                        Button("Decline") {
                            Task { await friends.remove(item.friendship) }
                        }
                        .font(.caption)
                        .foregroundStyle(Color.muted)
                    }
                }
            }
        }
    }

    private var friendsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                CardTitle("Your friends")
                if friends.accepted.isEmpty {
                    Text("No friends yet — add someone below.")
                        .font(.footnote)
                        .foregroundStyle(Color.muted)
                }
                ForEach(friends.accepted, id: \.friendship.id) { item in
                    NavigationLink(value: item.profile) {
                        HStack(spacing: 10) {
                            AvatarView(profile: item.profile)
                            VStack(alignment: .leading, spacing: 1) {
                                HStack(spacing: 6) {
                                    Text(item.profile.displayName)
                                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                                        .foregroundStyle(Color.ink)
                                    PresenceDot(status: item.profile.livePresence)
                                }
                                Text(item.profile.statusText ?? presenceLabel(item.profile.livePresence))
                                    .font(.caption2)
                                    .foregroundStyle(Color.muted)
                                    .lineLimit(1)
                            }
                            Spacer()
                            if item.unread > 0 {
                                Text(item.unread > 9 ? "9+" : "\(item.unread)")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(.white)
                                    .padding(6)
                                    .background(Color.accent, in: .circle)
                            }
                            Image(systemName: "message")
                                .font(.subheadline)
                                .foregroundStyle(Color.faint)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var addCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                CardTitle("Add a friend")
                HStack(spacing: 8) {
                    TextField("their@email.com", text: $addEmail)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.system(.subheadline, design: .rounded))
                    Button("Add") {
                        Task {
                            busy = true
                            addMessage = await friends.sendRequest(email: addEmail)
                            if addMessage == nil {
                                addMessage = "Request sent."
                                addEmail = ""
                            }
                            busy = false
                        }
                    }
                    .buttonStyle(.glassProminent)
                    .font(.caption.weight(.semibold))
                    .disabled(busy || !addEmail.contains("@"))
                }
                Text(addMessage ?? "They need a beanlo account — they'll get a request to accept here.")
                    .font(.caption2)
                    .foregroundStyle(addMessage == "Request sent." ? Color.positive : Color.muted)
            }
        }
    }

    private var sentCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                CardTitle("Sent requests")
                ForEach(friends.outgoing, id: \.friendship.id) { item in
                    HStack {
                        Text(item.profile.displayName)
                            .font(.system(.subheadline, design: .rounded))
                        Spacer()
                        Button("Cancel") {
                            Task { await friends.remove(item.friendship) }
                        }
                        .font(.caption)
                        .foregroundStyle(Color.muted)
                    }
                }
            }
        }
    }

    private var blockedCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                CardTitle("Blocked")
                ForEach(friends.blocked, id: \.friendship.id) { item in
                    HStack {
                        Text(item.profile.displayName)
                            .font(.system(.subheadline, design: .rounded))
                        Spacer()
                        Button("Unblock") {
                            Task { await friends.remove(item.friendship) }
                        }
                        .font(.caption)
                        .foregroundStyle(Color.muted)
                    }
                }
                Text("They can't message you, re-request, or see your presence — and they weren't told.")
                    .font(.caption2)
                    .foregroundStyle(Color.faint)
            }
        }
    }

    private func presenceLabel(_ status: String) -> String {
        status == "feeding" ? "feeding now" : status
    }
}

struct PresenceDot: View {
    let status: String

    var body: some View {
        Circle()
            .fill(status == "offline" ? Color.faint : status == "feeding" ? Color.accent : Color.positiveBar)
            .frame(width: 8, height: 8)
    }
}

struct AvatarView: View {
    let profile: Profile

    var body: some View {
        Group {
            if let urlString = profile.avatarUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    initials
                }
            } else {
                initials
            }
        }
        .frame(width: 36, height: 36)
        .clipShape(.circle)
    }

    private var initials: some View {
        Text(String(profile.displayName.prefix(1)).uppercased())
            .font(.system(.subheadline, design: .rounded, weight: .bold))
            .foregroundStyle(Color.accent)
            .frame(width: 36, height: 36)
            .background(Color.accentSoft, in: .circle)
    }
}

// MARK: - Thread

struct FriendThreadView: View {
    @EnvironmentObject private var store: Store
    @EnvironmentObject private var friends: FriendsStore
    @Environment(\.dismiss) private var dismiss
    let friend: Profile

    @State private var messages: [(id: UUID, mine: Bool, text: String?, at: Date, readAt: Date?)] = []
    @State private var input = ""
    @State private var sendError: String?
    @State private var confirmBlock = false
    @State private var poll: Task<Void, Never>?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 8) {
                        if messages.isEmpty {
                            Text("Say hi — especially if you're both up at 3am.")
                                .font(.footnote)
                                .foregroundStyle(Color.faint)
                                .padding(.top, 30)
                        }
                        ForEach(messages, id: \.id) { message in
                            bubble(message)
                        }
                        if let last = messages.last, last.mine, last.readAt != nil,
                           store.mySettings.readReceipts != false {
                            Text("Seen")
                                .font(.caption2)
                                .foregroundStyle(Color.faint)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                        }
                        if let sendError {
                            Text(sendError).font(.caption).foregroundStyle(Color.alertTone)
                        }
                        Color.clear.frame(height: 4).id("bottom")
                    }
                    .padding(14)
                }
                .onChange(of: messages.count) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }

            HStack(spacing: 8) {
                Button {
                    Task { await send(text: "👋", isWave: true) }
                } label: {
                    Text("👋").font(.title3)
                }
                TextField("Message…", text: $input, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .glassEffect(.regular, in: .capsule)
                Button {
                    let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !text.isEmpty else { return }
                    input = ""
                    Task { await send(text: text, isWave: false) }
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.body.weight(.bold))
                        .foregroundStyle(Color.onInk)
                        .frame(width: 38, height: 38)
                        .background(input.trimmingCharacters(in: .whitespaces).isEmpty ? Color.faint : Color.ink, in: .circle)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .background(Color.sand)
        .navigationTitle(friend.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(role: .destructive) {
                        Task {
                            await friends.block(friend)
                            dismiss()
                        }
                    } label: {
                        Label("Block", systemImage: "hand.raised")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
            ToolbarItem(placement: .principal) {
                VStack(spacing: 0) {
                    Text(friend.displayName)
                        .font(.system(.subheadline, design: .rounded, weight: .bold))
                    HStack(spacing: 4) {
                        PresenceDot(status: friend.livePresence)
                        Text(friend.livePresence == "feeding" ? "feeding now" : friend.livePresence)
                            .font(.caption2)
                            .foregroundStyle(Color.muted)
                    }
                }
            }
        }
        .task {
            store.chatThreadOpen = true
            await loadMessages()
            poll = Task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(5))
                    await loadMessages()
                }
            }
        }
        .onDisappear {
            poll?.cancel()
            store.chatThreadOpen = false
        }
    }

    @ViewBuilder
    private func bubble(_ message: (id: UUID, mine: Bool, text: String?, at: Date, readAt: Date?)) -> some View {
        HStack {
            if message.mine { Spacer(minLength: 44) }
            Text(message.text ?? "🔒 Only readable on the device it was sent to")
                .font(message.text == "👋" ? .largeTitle : .system(.subheadline, design: .rounded))
                .italic(message.text == nil)
                .foregroundStyle(message.mine ? Color.onInk : message.text == nil ? Color.faint : Color.ink)
                .padding(.horizontal, 13)
                .padding(.vertical, 9)
                .background(message.mine ? Color.ink : Color.surface, in: .rect(cornerRadius: 17))
            if !message.mine { Spacer(minLength: 44) }
        }
    }

    private func loadMessages() async {
        guard let me = store.userId else { return }
        let rows = await friends.messages(with: friend)
        var key: SymmetricKey?
        if let jwk = friend.publicKey {
            key = try? E2EE.sharedKey(theirPublicJWK: jwk)
        }
        messages = rows.map { row in
            (
                id: row.id,
                mine: row.sender == me,
                text: key.flatMap { E2EE.decrypt(row.body, key: $0) },
                at: row.createdAt,
                readAt: row.readAt
            )
        }
        await friends.markRead(from: friend)
    }

    private func send(text: String, isWave: Bool) async {
        sendError = nil
        guard friend.publicKey != nil else {
            sendError = "You'll be able to message \(friend.displayName) once they've opened beanlo."
            return
        }
        Haptics.tap()
        let ok = await friends.send(text: text, to: friend, isWave: isWave)
        if ok {
            await loadMessages()
        } else {
            sendError = "Couldn't send — check your connection and try again."
            if !isWave { input = text }
        }
    }
}
