import "server-only";
import { createPrivateKey, createSign } from "node:crypto";
import { connect, constants as h2 } from "node:http2";
import { createServiceClient } from "./supabase/service";
import type { PushPayload } from "./push";

// APNs sender for the native iOS app. Same alerts as web push, delivered
// through Apple. No-ops (returns 0) until the APNS_* env vars are set:
//   APNS_TEAM_ID      Apple Developer team id
//   APNS_KEY_ID       key id of the APNs auth key
//   APNS_PRIVATE_KEY  the .p8 contents (\n-escaped is fine)
//   APNS_TOPIC        bundle id (defaults to io.morta.beanlo)
//   APNS_ENV          "production" (default) or "sandbox"

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

let jwtCache: { token: string; iat: number } | null = null;

/** ES256 provider token, cached (Apple wants reuse for 20–60 min). */
function apnsJwt(): string | null {
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY;
  if (!teamId || !keyId || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  if (jwtCache && now - jwtCache.iat < 45 * 60) return jwtCache.token;

  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: now }));
  const signer = createSign("SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign({
    key: createPrivateKey(privateKey.replace(/\\n/g, "\n")),
    dsaEncoding: "ieee-p1363",
  });
  const token = `${header}.${claims}.${b64url(signature)}`;
  jwtCache = { token, iat: now };
  return token;
}

/**
 * Send an alert to every iOS device of the given users. Prunes tokens Apple
 * reports as gone. Returns how many were delivered.
 */
export async function sendApnsToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<number> {
  const jwt = apnsJwt();
  if (!jwt || userIds.length === 0) return 0;

  const service = createServiceClient();
  const { data: rows } = await service
    .from("ios_push_tokens")
    .select("id, token")
    .in("user_id", userIds);
  if (!rows?.length) return 0;

  const host =
    process.env.APNS_ENV === "sandbox"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";
  const topic = process.env.APNS_TOPIC || "io.morta.beanlo";
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      "thread-id": payload.tag ?? "beanlo",
    },
    url: payload.url ?? "/today",
  });

  const session = connect(host);
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    rows.map(
      (row) =>
        new Promise<void>((resolve) => {
          const req = session.request({
            [h2.HTTP2_HEADER_METHOD]: "POST",
            [h2.HTTP2_HEADER_PATH]: `/3/device/${row.token}`,
            authorization: `bearer ${jwt}`,
            "apns-topic": topic,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "content-type": "application/json",
          });
          let status = 0;
          let responseBody = "";
          req.on("response", (headers) => {
            status = Number(headers[h2.HTTP2_HEADER_STATUS] ?? 0);
          });
          req.on("data", (chunk) => (responseBody += chunk));
          req.on("close", () => {
            if (status === 200) {
              sent += 1;
            } else if (
              status === 410 ||
              responseBody.includes("BadDeviceToken") ||
              responseBody.includes("Unregistered")
            ) {
              dead.push(row.id);
            }
            resolve();
          });
          req.on("error", () => resolve());
          req.end(body);
        })
    )
  );
  session.close();

  if (dead.length) {
    await service.from("ios_push_tokens").delete().in("id", dead);
  }
  return sent;
}
