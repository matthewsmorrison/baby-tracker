import Foundation
import Supabase

/// Friendships, presence, and E2EE direct messages — same tables and RLS as
/// the web. Realtime is approximated with short polls (the web keeps a 15 s
/// poll as its own safety net).
@MainActor
final class FriendsStore: ObservableObject {
    struct Item {
        let friendship: Friendship
        let profile: Profile
        var unread: Int = 0
    }

    @Published var accepted: [Item] = []
    @Published var incoming: [Item] = []
    @Published var outgoing: [Item] = []
    @Published var blocked: [Item] = []

    private weak var store: Store?

    func configure(store: Store) {
        self.store = store
    }

    /// Publish this device's public key (per-device, last writer wins — the
    /// web behaves the same way per browser), then load everything.
    func publishKeyAndLoad() async {
        guard let store, let me = store.userId else { return }
        struct K: Encodable { let public_key: String }
        _ = try? await store.supabase
            .from("profiles")
            .update(K(public_key: E2EE.publicJWK()))
            .eq("id", value: me)
            .execute()
        await load()
    }

    func load() async {
        guard let store, let me = store.userId else { return }
        do {
            let friendships: [Friendship] = try await store.supabase
                .from("friendships")
                .select("id, requester, addressee, status, blocked_by")
                .or("requester.eq.\(me),addressee.eq.\(me)")
                .execute().value
            let otherIds = friendships.map { $0.other(me) }
            let profiles: [Profile] = otherIds.isEmpty ? [] : try await store.supabase
                .from("profiles")
                .select()
                .in("id", values: otherIds)
                .execute().value
            let byId = Dictionary(uniqueKeysWithValues: profiles.map { ($0.id, $0) })

            struct UnreadRow: Decodable { let sender: UUID }
            let unreadRows: [UnreadRow] = (try? await store.supabase
                .from("messages")
                .select("sender")
                .eq("recipient", value: me)
                .is("read_at", value: nil)
                .execute().value) ?? []
            var unreadBySender: [UUID: Int] = [:]
            for row in unreadRows { unreadBySender[row.sender, default: 0] += 1 }

            func items(_ f: [Friendship]) -> [Item] {
                f.compactMap { friendship in
                    byId[friendship.other(me)].map {
                        Item(friendship: friendship, profile: $0, unread: unreadBySender[$0.id] ?? 0)
                    }
                }
            }
            accepted = items(friendships.filter { $0.status == "accepted" })
            incoming = items(friendships.filter { $0.status == "pending" && $0.addressee == me })
            outgoing = items(friendships.filter { $0.status == "pending" && $0.requester == me })
            blocked = items(friendships.filter { $0.status == "blocked" && $0.blockedBy == me })
        } catch {
            // transient — pull-to-refresh retries
        }
    }

    func setStatus(_ text: String) async {
        guard let store, let me = store.userId else { return }
        struct S: Encodable { let status_text: String? }
        let trimmed = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
        _ = try? await store.supabase
            .from("profiles")
            .update(S(status_text: trimmed.isEmpty ? nil : trimmed))
            .eq("id", value: me)
            .execute()
        Haptics.success()
    }

    /// Returns an error message, or nil on success.
    func sendRequest(email: String) async -> String? {
        guard let store else { return "Not signed in" }
        do {
            let request = try await store.apiRequest("/api/friends/request", body: ["email": email])
            let (data, response) = try await URLSession.shared.data(for: request)
            if (response as? HTTPURLResponse)?.statusCode == 200 { return nil }
            struct E: Decodable { let error: String? }
            return (try? JSONDecoder().decode(E.self, from: data))?.error ?? "Couldn't send the request."
        } catch {
            return "No connection — try again."
        }
    }

    func accept(_ friendship: Friendship) async {
        guard let store else { return }
        struct A: Encodable {
            let status: String
            let accepted_at: String
        }
        _ = try? await store.supabase
            .from("friendships")
            .update(A(status: "accepted", accepted_at: Date().ISO8601Format()))
            .eq("id", value: friendship.id)
            .execute()
        Haptics.success()
        await load()
    }

    func remove(_ friendship: Friendship) async {
        guard let store else { return }
        try? await store.supabase.from("friendships").delete().eq("id", value: friendship.id).execute()
        await load()
    }

    func block(_ profile: Profile) async {
        guard let store, let me = store.userId,
              let friendship = accepted.first(where: { $0.profile.id == profile.id })?.friendship
        else { return }
        struct B: Encodable {
            let status: String
            let blocked_by: UUID
        }
        _ = try? await store.supabase
            .from("friendships")
            .update(B(status: "blocked", blocked_by: me))
            .eq("id", value: friendship.id)
            .execute()
        await load()
    }

    func messages(with friend: Profile) async -> [DirectMessage] {
        guard let store, let me = store.userId else { return [] }
        return (try? await store.supabase
            .from("messages")
            .select("id, sender, recipient, body, created_at, read_at, receipt_suppressed")
            .or("and(sender.eq.\(me),recipient.eq.\(friend.id)),and(sender.eq.\(friend.id),recipient.eq.\(me))")
            .order("created_at", ascending: true)
            .limit(200)
            .execute().value) ?? []
    }

    func markRead(from friend: Profile) async {
        guard let store, let me = store.userId else { return }
        struct R: Encodable {
            let read_at: String
            let receipt_suppressed: Bool
        }
        _ = try? await store.supabase
            .from("messages")
            .update(R(
                read_at: Date().ISO8601Format(),
                receipt_suppressed: store.mySettings.readReceipts == false
            ))
            .eq("recipient", value: me)
            .eq("sender", value: friend.id)
            .is("read_at", value: nil)
            .execute()
    }

    func send(text: String, to friend: Profile, isWave: Bool) async -> Bool {
        guard let store, let me = store.userId, let jwk = friend.publicKey,
              let key = try? E2EE.sharedKey(theirPublicJWK: jwk),
              let body = try? E2EE.encrypt(text, key: key)
        else { return false }
        struct M: Encodable {
            let sender: UUID
            let recipient: UUID
            let body: String
            let kind: String
        }
        do {
            _ = try await store.supabase
                .from("messages")
                .insert(M(sender: me, recipient: friend.id, body: body, kind: isWave ? "wave" : "text"))
                .execute()
            // Announce via push (contents stay encrypted).
            if let request = try? await store.apiRequest("/api/friends/notify", body: [
                "recipientId": friend.id.uuidString.lowercased(),
                "kind": isWave ? "wave" : "message",
            ]) {
                _ = try? await URLSession.shared.data(for: request)
            }
            return true
        } catch {
            return false
        }
    }
}
