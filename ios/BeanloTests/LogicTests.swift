import XCTest
import CryptoKit
@testable import Beanlo

// The app's decision-making logic, tested exactly as shipped. No network,
// no fixtures to keep in sync — every case is derived from the guidance the
// code claims to implement.

// MARK: - Feed timer

final class FeedTimerTests: XCTestCase {
    func testStartSwitchPauseBanksTime() {
        var t = FeedTimerState()
        let t0 = Date(timeIntervalSince1970: 1_700_000_000)

        t.toggle(.left, at: t0)
        XCTAssertTrue(t.isRunning)
        XCTAssertEqual(t.side, .left)
        XCTAssertEqual(t.total(.left, at: t0.addingTimeInterval(300)), 300, accuracy: 0.01)

        // Switching sides banks the left time and starts the right.
        t.toggle(.right, at: t0.addingTimeInterval(300))
        XCTAssertEqual(t.side, .right)
        XCTAssertEqual(t.accLeft, 300, accuracy: 0.01)

        // Tapping the running side pauses.
        t.toggle(.right, at: t0.addingTimeInterval(500))
        XCTAssertFalse(t.isRunning)
        XCTAssertTrue(t.isActive)
        XCTAssertEqual(t.grandTotal, 500, accuracy: 0.01)
    }

    func testSharedRoundTrip() {
        var t = FeedTimerState()
        t.toggle(.left, at: Date(timeIntervalSince1970: 1_700_000_000))
        t.saveShared()
        XCTAssertEqual(FeedTimerState.loadShared(), t)
        FeedTimerState().saveShared() // reset for other tests
    }
}

// MARK: - Clinical guidance

final class ClinicalTests: XCTestCase {
    func testDayOfLife() {
        let birth = Date(timeIntervalSince1970: 1_700_000_000)
        XCTAssertEqual(Clinical.dayOfLife(birthAt: birth, at: birth), 1)
        XCTAssertEqual(Clinical.dayOfLife(birthAt: birth, at: birth.addingTimeInterval(3600)), 1)
        XCTAssertEqual(Clinical.dayOfLife(birthAt: birth, at: birth.addingTimeInterval(86_400)), 2)
        XCTAssertEqual(Clinical.dayOfLife(birthAt: birth, at: birth.addingTimeInterval(13.5 * 86_400)), 14)
    }

    func testNappyQuotaFollowsNHSBands() {
        // Rising quota through the establishment weeks…
        var lastTotal = 0
        for day in 1...41 {
            let q = Clinical.expectedNappies(day: day)
            XCTAssertGreaterThanOrEqual(q.total, lastTotal, "day \(day)")
            XCTAssertLessThanOrEqual(q.minDirty, q.total, "day \(day)")
            XCTAssertGreaterThan(q.minDirty, 0, "day \(day)")
            lastTotal = q.total
        }
        XCTAssertEqual(Clinical.expectedNappies(day: 1).total, 3)
        XCTAssertEqual(Clinical.expectedNappies(day: 6).total, 7)
        XCTAssertEqual(Clinical.expectedNappies(day: 7).total, 8)
        // …then from 6 weeks the NHS guide is 6+ heavy wet nappies, and
        // breastfed babies can go days between poos — no dirty minimum.
        let sixWeeks = Clinical.expectedNappies(day: 42)
        XCTAssertEqual(sixWeeks.total, 6)
        XCTAssertEqual(sixWeeks.minDirty, 0)
        XCTAssertEqual(Clinical.expectedNappies(day: 60).total, 6, "2 months should follow NHS 6+, not 8")
    }

    func testExpectedStoolColourGrid() {
        XCTAssertEqual(Clinical.expectedColourKey(day: 1, mix: .breast), .meconium)
        XCTAssertEqual(Clinical.expectedColourKey(day: 3, mix: .breast), .transitional)
        XCTAssertEqual(Clinical.expectedColourKey(day: 10, mix: .breast), .yellow)
        XCTAssertEqual(Clinical.expectedColourKey(day: 10, mix: .formula), .brown)
        XCTAssertEqual(Clinical.expectedColourKey(day: 10, mix: .mixed), .tan)
    }

    func testWeightBandDipsThenRegains() {
        let birthG = 3500
        // The band dips over the first week (physiological loss)...
        let day4 = Clinical.expectedWeightBand(day: 4, birthWeightG: birthG)
        XCTAssertLessThan(day4.mid, birthG)
        XCTAssertLessThan(day4.low, day4.mid)
        XCTAssertLessThan(day4.mid, day4.high)
        // ...is back to birth weight by day 21...
        let day21 = Clinical.expectedWeightBand(day: 21, birthWeightG: birthG)
        XCTAssertEqual(day21.mid, birthG)
        // ...then gains ~175 g/week.
        let day28 = Clinical.expectedWeightBand(day: 28, birthWeightG: birthG)
        XCTAssertEqual(day28.mid, birthG + 175)
    }

    func testNextDoseCopyNamesTheRightPerson() {
        let baby = Clinical.nextDoseCopy(medName: "Calpol", subject: "baby", babyName: "Sunny")
        XCTAssertEqual(baby.title, "Sunny — next Calpol dose OK now")
        let mum = Clinical.nextDoseCopy(medName: "Ibuprofen", subject: "mother", babyName: "Sunny")
        XCTAssertEqual(mum.title, "Mum — next Ibuprofen dose OK now")
        // Copy must stay permissive, never directive: a ceiling, not an order.
        XCTAssertTrue(baby.body.contains("Only give it if it's needed"))
        let unnamed = Clinical.nextDoseCopy(medName: nil, subject: nil, babyName: "Sunny")
        XCTAssertEqual(unnamed.title, "Sunny — next medicine dose OK now")
    }

    func testNappyOutputSubtractsDryWeight() {
        XCTAssertEqual(Clinical.nappyOutputG(nappyWeightG: 60, baseWeightG: 22), 38)
        XCTAssertNil(Clinical.nappyOutputG(nappyWeightG: nil, baseWeightG: 22))
    }
}

// MARK: - WHO tables (generated from the reference implementation)

final class WHOTests: XCTestCase {
    func testWeightTablesMatchReferenceValues() {
        XCTAssertTrue(WHOWeight.verify())
    }

    func testGrowthTablesMatchReferenceValues() {
        XCTAssertTrue(WHOGrowth.verify())
    }

    func testCentileIsInverseOfWeightAtZ() {
        // A weight generated at the median must read back as the 50th centile.
        for ageDays in [7.0, 30.0, 90.0, 365.0] {
            let median = WHOWeight.weightAtZ(isBoy: true, ageDays: ageDays, z: 0)
            let centile = WHOWeight.centile(isBoy: true, ageDays: ageDays, weightG: median)
            XCTAssertEqual(centile, 50, accuracy: 1.0, "age \(ageDays)d")
        }
    }

    func testCentilesAreMonotonicInWeight() {
        let light = WHOWeight.centile(isBoy: false, ageDays: 30, weightG: 3200)
        let heavy = WHOWeight.centile(isBoy: false, ageDays: 30, weightG: 4800)
        XCTAssertLessThan(light, heavy)
    }
}

// MARK: - Predictions

final class PredictTests: XCTestCase {
    private let base = Date(timeIntervalSince1970: 1_755_000_000)

    func testTooFewFeedsReturnsNil() {
        let feeds = (0..<3).map { base.addingTimeInterval(Double($0) * 3 * 3600) }
        XCTAssertNil(Predict.nextFeed(feedStarts: feeds))
    }

    func testRegularFeederPredictsTheRhythm() {
        // Every 3 hours like clockwork → next feed 3h after the last.
        let feeds = (0..<12).map { base.addingTimeInterval(Double($0) * 3 * 3600) }
        let p = Predict.nextFeed(feedStarts: feeds)
        XCTAssertNotNil(p)
        XCTAssertEqual(p!.typicalGap, 3 * 3600, accuracy: 60)
        XCTAssertEqual(p!.nextAt.timeIntervalSince(feeds.last!), 3 * 3600, accuracy: 60)
        // A perfectly regular baby backtests perfectly.
        XCTAssertNotNil(p!.accuracy)
        XCTAssertEqual(p!.accuracy!.hits, p!.accuracy!.n)
    }

    func testOutlierGapsAreIgnored() {
        // A 14-hour gap (beyond the 8h cap) must not drag the median.
        var feeds = (0..<8).map { base.addingTimeInterval(Double($0) * 3 * 3600) }
        feeds.append(feeds.last!.addingTimeInterval(14 * 3600))
        let p = Predict.nextFeed(feedStarts: feeds)
        XCTAssertNotNil(p)
        XCTAssertEqual(p!.typicalGap, 3 * 3600, accuracy: 15 * 60)
    }

    func testNapNilWhileAsleep() {
        let spans = [Predict.SleepSpan(start: base.addingTimeInterval(-1800), end: nil)]
        XCTAssertNil(Predict.nextNap(spans: spans, birthAt: base.addingTimeInterval(-10 * 86_400), now: base))
    }

    func testNapWindowFollowsObservedWakeStretch() {
        // Consistent ~2h wake windows between naps.
        var spans: [Predict.SleepSpan] = []
        var cursor = base
        for _ in 0..<8 {
            spans.append(.init(start: cursor, end: cursor.addingTimeInterval(3600)))
            cursor = cursor.addingTimeInterval(3600 + 2 * 3600) // 1h nap + 2h awake
        }
        let now = spans.last!.end!.addingTimeInterval(1800)
        let p = Predict.nextNap(spans: spans, birthAt: base.addingTimeInterval(-20 * 86_400), now: now)
        XCTAssertNotNil(p)
        XCTAssertTrue(p!.basisIsObserved)
        XCTAssertEqual(p!.typicalWake, 2 * 3600, accuracy: 10 * 60)
        // The window is centred on lastWoke + typicalWake.
        let centre = p!.lastWoke.addingTimeInterval(p!.typicalWake)
        XCTAssertLessThanOrEqual(p!.windowStart, centre)
        XCTAssertGreaterThanOrEqual(p!.windowEnd, centre)
    }

    func testNapFallsBackToAgeDefaults() {
        // One nap only — nothing observed, so the age table decides.
        let spans = [Predict.SleepSpan(start: base, end: base.addingTimeInterval(1800))]
        let p = Predict.nextNap(spans: spans, birthAt: base.addingTimeInterval(-5 * 86_400), now: base.addingTimeInterval(2400))
        XCTAssertNotNil(p)
        XCTAssertFalse(p!.basisIsObserved)
    }
}

// MARK: - E2EE (must stay interoperable with the web's WebCrypto format)

final class E2EETests: XCTestCase {
    func testEncryptDecryptRoundTrip() throws {
        let key = SymmetricKey(size: .bits256)
        let sealed = try E2EE.encrypt("up feeding, send coffee ☕️", key: key)
        XCTAssertEqual(E2EE.decrypt(sealed, key: key), "up feeding, send coffee ☕️")
    }

    func testTamperedCiphertextFailsClosed() throws {
        let key = SymmetricKey(size: .bits256)
        let sealed = try E2EE.encrypt("secret", key: key)
        var env = try JSONSerialization.jsonObject(with: Data(sealed.utf8)) as! [String: Any]
        var ct = Data(base64Encoded: env["ct"] as! String)!
        ct[0] ^= 0xFF
        env["ct"] = ct.base64EncodedString()
        let tampered = String(data: try JSONSerialization.data(withJSONObject: env), encoding: .utf8)!
        XCTAssertNil(E2EE.decrypt(tampered, key: key))
        XCTAssertNil(E2EE.decrypt("not json", key: key))
    }

    func testECDHAgreementBothDirections() throws {
        // A fresh "friend" device agrees on the same key from our public JWK.
        let friend = P256.KeyAgreement.PrivateKey()
        let friendJWK = Self.jwk(for: friend.publicKey)
        let ourKey = try E2EE.sharedKey(theirPublicJWK: friendJWK)

        let ourJWKData = Data(E2EE.publicJWK().utf8)
        // The JWK carries non-string fields too (ext: true, key_ops: []).
        let ourJWK = try XCTUnwrap(JSONSerialization.jsonObject(with: ourJWKData) as? [String: Any])
        var x963 = Data([0x04])
        x963.append(Self.b64url(try XCTUnwrap(ourJWK["x"] as? String)))
        x963.append(Self.b64url(try XCTUnwrap(ourJWK["y"] as? String)))
        let ourPublic = try P256.KeyAgreement.PublicKey(x963Representation: x963)
        let secret = try friend.sharedSecretFromKeyAgreement(with: ourPublic)
        let friendKey = secret.withUnsafeBytes { SymmetricKey(data: Data($0)) }

        let sealed = try E2EE.encrypt("wave 👋", key: ourKey)
        XCTAssertEqual(E2EE.decrypt(sealed, key: friendKey), "wave 👋")
    }

    private static func jwk(for publicKey: P256.KeyAgreement.PublicKey) -> String {
        let x963 = publicKey.x963Representation
        let x = x963.subdata(in: 1..<33)
        let y = x963.subdata(in: 33..<65)
        let enc = { (d: Data) in
            d.base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
        }
        return #"{"crv":"P-256","kty":"EC","x":"\#(enc(x))","y":"\#(enc(y))"}"#
    }

    private static func b64url(_ s: String) -> Data {
        var b = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b.count % 4 != 0 { b += "=" }
        return Data(base64Encoded: b)!
    }
}
