import Foundation
import CryptoKit

/// End-to-end encryption for friend messages — interoperable with the web's
/// WebCrypto implementation (lib/e2ee.ts): ECDH P-256 keypair per device,
/// public key published as a JWK, per-friendship AES-256-GCM key derived
/// directly from the ECDH shared secret (WebCrypto's deriveKey semantics —
/// the raw x-coordinate is the key), bodies stored as {v:1, iv, ct} JSON
/// envelopes where ct = ciphertext ‖ tag. Same honest limits as the web:
/// keys are per-device, no forward secrecy.
enum E2EE {
    private static let keyDefaultsKey = "e2ee-private-key"

    struct Envelope: Codable {
        let v: Int
        let iv: String
        let ct: String
    }

    /// This device's keypair, created on first use.
    static func privateKey() -> P256.KeyAgreement.PrivateKey {
        if let b64 = UserDefaults.standard.string(forKey: keyDefaultsKey),
           let data = Data(base64Encoded: b64),
           let key = try? P256.KeyAgreement.PrivateKey(rawRepresentation: data) {
            return key
        }
        let key = P256.KeyAgreement.PrivateKey()
        UserDefaults.standard.set(key.rawRepresentation.base64EncodedString(), forKey: keyDefaultsKey)
        return key
    }

    /// Public key as the JWK JSON string published to profiles.public_key.
    static func publicJWK() -> String {
        let pub = privateKey().publicKey.x963Representation // 0x04 ‖ x ‖ y
        let x = pub[1..<33]
        let y = pub[33..<65]
        let jwk: [String: Any] = [
            "kty": "EC",
            "crv": "P-256",
            "x": base64url(Data(x)),
            "y": base64url(Data(y)),
            "ext": true,
            "key_ops": [],
        ]
        let data = try! JSONSerialization.data(withJSONObject: jwk, options: [.sortedKeys])
        return String(data: data, encoding: .utf8)!
    }

    /// Shared AES key for one friendship — same bytes on both sides.
    static func sharedKey(theirPublicJWK: String) throws -> SymmetricKey {
        guard let data = theirPublicJWK.data(using: .utf8),
              let jwk = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let xB64 = jwk["x"] as? String, let yB64 = jwk["y"] as? String,
              let x = base64urlDecode(xB64), let y = base64urlDecode(yB64),
              x.count == 32, y.count == 32
        else { throw CocoaError(.coderInvalidValue) }
        var x963 = Data([0x04])
        x963.append(x)
        x963.append(y)
        let theirKey = try P256.KeyAgreement.PublicKey(x963Representation: x963)
        let secret = try privateKey().sharedSecretFromKeyAgreement(with: theirKey)
        // WebCrypto's ECDH→AES-GCM deriveKey uses the raw shared secret
        // (the x-coordinate, 32 bytes) as the key material directly.
        return secret.withUnsafeBytes { SymmetricKey(data: Data($0)) }
    }

    static func encrypt(_ plaintext: String, key: SymmetricKey) throws -> String {
        let nonce = AES.GCM.Nonce()
        let sealed = try AES.GCM.seal(Data(plaintext.utf8), using: key, nonce: nonce)
        let envelope = Envelope(
            v: 1,
            iv: Data(nonce).base64EncodedString(),
            ct: (sealed.ciphertext + sealed.tag).base64EncodedString()
        )
        let data = try JSONEncoder().encode(envelope)
        return String(data: data, encoding: .utf8)!
    }

    /// Nil when undecryptable (another device's keys, tampering).
    static func decrypt(_ body: String, key: SymmetricKey) -> String? {
        guard let data = body.data(using: .utf8),
              let env = try? JSONDecoder().decode(Envelope.self, from: data),
              env.v == 1,
              let iv = Data(base64Encoded: env.iv), iv.count == 12,
              let ct = Data(base64Encoded: env.ct), ct.count > 16
        else { return nil }
        do {
            let box = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: iv),
                ciphertext: ct.dropLast(16),
                tag: ct.suffix(16)
            )
            let plain = try AES.GCM.open(box, using: key)
            return String(data: plain, encoding: .utf8)
        } catch {
            return nil
        }
    }

    private static func base64url(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func base64urlDecode(_ s: String) -> Data? {
        var b64 = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64 += "=" }
        return Data(base64Encoded: b64)
    }
}
