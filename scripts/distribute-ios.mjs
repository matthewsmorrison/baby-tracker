// Final mile of shipping: wait for the just-uploaded build to finish
// processing, submit it for beta review (subsequent builds are normally
// approved automatically), and attach it to the external "Public" group.
// Without this, uploads sit at READY_FOR_BETA_SUBMISSION and testers
// silently stay on the old build.
//
//   node scripts/distribute-ios.mjs            # newest build
//   node scripts/distribute-ios.mjs 17         # specific version
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const APP_ID = "6805460146";
const KEY_ID = "2XVZ5U8275";
const ISSUER = "93f22c36-dfcf-4d70-8980-2309f2712564";
const KEY_PATH = `${homedir()}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`;
const POLL_SECONDS = 60;
const MAX_WAIT_MIN = 40;

function jwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" }) +
    "." +
    b64({ iss: ISSUER, iat: now, exp: now + 900, aud: "appstoreconnect-v1" });
  const signer = createSign("SHA256");
  signer.update(unsigned);
  const sig = signer
    .sign({ key: readFileSync(KEY_PATH, "utf8"), dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  return `${unsigned}.${sig}`;
}

async function api(path, init = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.errors?.[0]?.detail ?? `HTTP ${res.status}`;
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return body;
}

const wantVersion = process.argv[2] ?? null;
const deadline = Date.now() + MAX_WAIT_MIN * 60_000;
let build = null;

// 1. Wait for the build to appear and finish processing.
for (;;) {
  const filter = wantVersion ? `&filter[version]=${wantVersion}` : "";
  const res = await api(`/v1/builds?filter[app]=${APP_ID}&sort=-version&limit=1${filter}`);
  build = res.data?.[0] ?? null;
  const state = build?.attributes?.processingState;
  if (build && state === "VALID") break;
  if (build && state && state !== "PROCESSING") {
    throw new Error(`build ${build.attributes.version} is ${state} — cannot distribute`);
  }
  if (Date.now() > deadline) {
    throw new Error(`build not processed after ${MAX_WAIT_MIN} min — run me again later: node scripts/distribute-ios.mjs`);
  }
  console.log(`waiting for processing (${build ? "build " + build.attributes.version : "not visible yet"})…`);
  await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
}
console.log(`build ${build.attributes.version} processed (VALID)`);

// 2. Submit for beta review (409 = already submitted; that's fine).
try {
  await api("/v1/betaAppReviewSubmissions", {
    method: "POST",
    body: JSON.stringify({
      data: { type: "betaAppReviewSubmissions", relationships: { build: { data: { type: "builds", id: build.id } } } },
    }),
  });
  console.log("submitted for beta review");
} catch (e) {
  if (e.status === 409) console.log("beta review: already submitted");
  else throw e;
}

// 3. Attach to the external (public-link) group.
const groups = await api(`/v1/betaGroups?filter[app]=${APP_ID}`);
const pub = groups.data.find((g) => !g.attributes.isInternalGroup);
if (!pub) throw new Error("no external beta group found");
await api(`/v1/betaGroups/${pub.id}/relationships/builds`, {
  method: "POST",
  body: JSON.stringify({ data: [{ type: "builds", id: build.id }] }),
});
console.log(`attached build ${build.attributes.version} to "${pub.attributes.name}" — testers get it when the (normally automatic) approval clears`);
