# Clash Party Provider Integration v2

Client spec: `cpx-plugin/2`.

Chinese reference document:
[`机场服务端对接指南-v2.md`](机场服务端对接指南-v2.md).

Related files:

- Reference gateway: [`deploy/gateway/`](../../deploy/gateway/)
- Sign test vectors:
  [`src/main/resolve/plugin/__fixtures__/sign-vectors.json`](../../src/main/resolve/plugin/__fixtures__/sign-vectors.json)

During development there was an earlier v1 design (password + encrypted container).
That design has been retired, and the current codebase does not include a v1
implementation.

---

## 1. Integration Model

The client must not receive the real subscription URL, API host, or origin token.

The user imports a public `.cpx` descriptor. Login happens in the system browser. The client generates an Ed25519 device key pair locally. Subscription updates then use a gateway challenge/config flow.

Provider-side components:

| Component                  | Host                                     | Purpose                                      |
| -------------------------- | ---------------------------------------- | -------------------------------------------- |
| OAuth authorize endpoint   | Login host from `.cpx` `loginUrl`        | User login and one-time code issuance        |
| `/.well-known/cpx-gateway` | Same host and port as `loginUrl`         | Current gateway origin and endpoint paths    |
| Gateway endpoints          | Gateway host; may differ from login host | Device enrollment, nonce, config, revocation |

The login host is the trust root and is fixed in distributed `.cpx` files. The gateway host is discovered at runtime and can be rotated by updating the well-known document.

Failure behavior:

| Failed host  | Result                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------- |
| Gateway host | Client can rediscover through the login host                                                  |
| Login host   | Existing devices can keep using the cached gateway; new login, re-login, and rediscovery fail |
| Both         | Client is disconnected; redistribute a new `.cpx`                                             |

Flow:

```text
Install:
  Import .cpx
  Validate descriptor
  Create local record; no network request yet

Login:
  1. GET https://<login-host>/.well-known/cpx-gateway
  2. Generate Ed25519 device key pair and deviceId(UUIDv4)
  3. Open system browser:
     loginUrl?response_type=code&code_challenge=...&state=...
  4. Provider login page redirects to:
     http://127.0.0.1:<port>/callback?code=...&state=...
  5. POST {gateway}/enroll with code and PKCE verifier
  6. POST {gateway}/challenge
  7. POST {gateway}/config with Ed25519 signature
  8. Store returned Clash YAML as a normal profile

Update:
  Repeat challenge -> config. No browser is opened.

Re-login:
  Gateway returns {"error":"revoked"} or {"error":"device_revoked"}.
  Client marks the profile as needs re-authentication.

Delete:
  Client best-effort calls /revoke, then deletes local state.
```

---

## 2. Reference Gateway

[`deploy/gateway/`](../../deploy/gateway/) is the reference implementation. It includes Docker deployment, a SQLite account store, and `cpx-admin`.

Important files:

| File                                                                     | Purpose                             |
| ------------------------------------------------------------------------ | ----------------------------------- |
| [`deploy/gateway/src/auth.mjs`](../../deploy/gateway/src/auth.mjs)       | authorize page and one-time codes   |
| [`deploy/gateway/src/gateway.mjs`](../../deploy/gateway/src/gateway.mjs) | enroll/challenge/config/revoke      |
| [`deploy/gateway/src/crypto.mjs`](../../deploy/gateway/src/crypto.mjs)   | PKCE, Ed25519, canonical sign input |
| [`deploy/gateway/src/origin.mjs`](../../deploy/gateway/src/origin.mjs)   | hidden-origin subscription fetch    |

For an existing panel, the usual additions are:

1. A device binding table: `user_id`, `device_id`, `device_pubkey`, `created_at`.
2. Pending nonce storage: Redis, memory, or database; short TTL; delete after use.
3. An OAuth authorize endpoint backed by the existing login system.
4. `/.well-known/cpx-gateway`.
5. Four gateway endpoints that call existing user-status and subscription-generation logic.

---

## 3. `.cpx` Descriptor

`.cpx` is public JSON. Use one file for all users. It must not contain user data, tokens, API hosts, gateway hosts, or subscription URLs.

```json
{
  "magic": "CPXF",
  "v": 2,
  "spec": "cpx-plugin/2",
  "loginUrl": "https://panel.example.com/oauth/authorize",
  "provider": {
    "name": "Example",
    "icon": "data:image/png;base64,iVBORw0K...",
    "site": "https://example.com"
  }
}
```

Field rules:

| Field                  | Rule                                                                                                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `magic`                | String `"CPXF"`                                                                                                                                                                                                                                            |
| `v`                    | Number `2`                                                                                                                                                                                                                                                 |
| `spec`                 | String `"cpx-plugin/2"`                                                                                                                                                                                                                                    |
| Top-level keys         | Only `magic`, `v`, `spec`, `loginUrl`, `provider`, `discoveryUrls`, `providerPubKey`                                                                                                                                                                       |
| `loginUrl`             | HTTPS URL; no query, fragment, or userinfo; host must not be private, loopback, `localhost`, or `*.localhost`                                                                                                                                              |
| `discoveryUrls`        | Optional. 1..8 public HTTPS origins (no path/query/fragment/userinfo), deduplicated, none equal to the `loginUrl` origin. Backup discovery sources, see §5. **Only clients from the release that added it accept this key; older clients reject the file** |
| `providerPubKey`       | Optional. Ed25519 raw 32-byte public key, standard base64 with padding. Once present the client **requires** a signed discovery document (§5a) and rejects unsigned ones. Use one key per `.cpx` lineage. **Older clients reject the file**                |
| `provider`             | Object; only `name`, `icon`, `site`, `description`                                                                                                                                                                                                         |
| `provider.name`        | Required non-empty string                                                                                                                                                                                                                                  |
| `provider.icon`        | Optional data URI; only PNG/JPEG/WEBP; total string length <= 65536                                                                                                                                                                                        |
| `provider.site`        | Optional HTTPS URL; same host restrictions as `loginUrl`; path is allowed                                                                                                                                                                                  |
| `provider.description` | Optional string shown to the user; sanitized like error `message` (§6) and capped at 500 code points. **Older clients reject the file**                                                                                                                    |

`loginUrl` is the OAuth authorize endpoint, not a generic login page. The client appends OAuth parameters to it.

Generator:

```bash
node scripts/plugin/gen-cpx.mjs <loginUrl> <providerName> [site] [output] [--discovery <origin>]...
```

`--discovery` may be repeated; each value becomes one entry of `discoveryUrls`.

### Distribution Options

- **File download**: Distribute the `.cpx` file directly. Clients with the file association registered can launch the app by double-clicking the file and will see the plugin preview and confirmation page.
- **Deep link**: Host the same `.cpx` file at a public HTTPS URL, then use the following link in a web button or QR code:

  ```text
  clash://install-plugin?url=https%3A%2F%2Fprovider.example.com%2Fapp.cpx
  ```

  `mihomo://` is equivalent to `clash://`. URL-encode the `url` parameter. The client downloads and validates the file, installs the plugin, and opens the system browser for login. The download URL must use public HTTPS, redirects are rejected, and the file must not exceed 1 MiB.

---

## 4. OAuth Authorize

Use OAuth 2.0 Authorization Code + PKCE(S256). The client opens the system browser. Credentials are submitted only to the provider page.

Client query parameters:

| Parameter               | Value                                          |
| ----------------------- | ---------------------------------------------- |
| `response_type`         | `code`                                         |
| `client_id`             | `mihomo-party`                                 |
| `redirect_uri`          | `http://127.0.0.1:<random-port>/callback`      |
| `code_challenge`        | `BASE64URL(SHA256(code_verifier))`, no padding |
| `code_challenge_method` | `S256`                                         |
| `state`                 | Random string; echo unchanged                  |
| `scope`                 | `subscribe`                                    |

Authorize endpoint requirements:

1. Allow loopback redirect URI `http://127.0.0.1:<random-port>/callback`. The port changes per login.
2. After successful login, redirect to `redirect_uri?code=...&state=...`.
3. The issued `code` must be one-time and expire in no more than 60 seconds.
4. Store `user_id`, `redirect_uri`, `client_id`, and `code_challenge` with the code.
5. `/enroll` must compare stored `redirect_uri` and `client_id` byte-for-byte.

Loopback redirect uses HTTP for native apps; do not reject it for not being HTTPS. See RFC 8252.

---

## 5. Gateway Discovery

The client requests the exact host from `loginUrl`:

```text
GET https://<login-host>/.well-known/cpx-gateway
```

Response:

```json
{
  "spec": "cpx-plugin/2",
  "gateway": "https://gw.front.example.net",
  "gateways": ["https://gw.front.example.net", "https://gw2-cdn.example.com"],
  "endpoints": {
    "enroll": "/enroll",
    "challenge": "/challenge",
    "config": "/config",
    "revoke": "/revoke"
  }
}
```

Field rules:

| Field       | Rule                                                                                                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spec`      | String `"cpx-plugin/2"`                                                                                                                                                                                    |
| `gateway`   | HTTPS origin only: scheme, host, optional port; no path, query, fragment, or userinfo; public host. **Must equal the normalized `gateways[0]`** when `gateways` is present                                 |
| `gateways`  | Optional. 1..3 HTTPS origins with the same rules as `gateway`, deduplicated. Absent → the client uses `[gateway]`. Any invalid entry, an empty list, or more than 3 entries invalidates the whole document |
| `endpoints` | Must contain `enroll`, `challenge`, `config`, `revoke`; each value is a relative path starting with `/`; no absolute URL, `?`, `#`, or backslash. The same endpoints apply to every gateway                |

The discovery request uses HTTPS only, does not follow redirects, and caps the response body at 64 KiB. Non-2xx, invalid JSON, or invalid fields are discovery failures.

Old clients only read `gateway`; new clients read `gateways` and fall back to `[gateway]`. Generate both from the same list so they never disagree.

**Multiple gateways must share state.** All `gateways` must point at the same backend state (authorize codes, devices, nonces): the client may take a nonce from `/challenge` on one gateway and post `/config` on another after a timeout. The reference deployment terminates TLS for every gateway domain in Caddy and forwards them all to one gateway process; it does not support multiple replicas.

### Gateway Rotation and Switching

To rotate gateways, update `/.well-known/cpx-gateway`.

Within one client operation (a complete business action such as challenge + config), the client tries the cached gateways in order — the last gateway that worked first, then the rest — and moves to the next candidate when the current one returns:

- HTTP `410` or JSON `{"error":"gateway_retired"}`;
- a network-level failure: DNS failure, connection failure, TLS handshake failure;
- a timeout (no HTTP response at all).

Any HTTP response other than the retired marker stops the operation: plain 5xx, 429, or `revoked` are never reasons to try another gateway. Only when **every** cached gateway failed in the switch-worthy way does the client rediscover **once** and try the new list, skipping targets it already tried in the same operation (same origin **and** same endpoints). If that still fails the operation ends as transient and backs off.

Each gateway origin is also routed independently: the client may reach one gateway directly and another through its local proxy (see §6).

Rediscovery requires a discovery source to be reachable (the login host, and any `discoveryUrls` from the descriptor).

### Multiple Discovery Sources

The login host is a single point of failure for rediscovery: if it is blocked, an enrolled device can no longer learn about a new gateway. The descriptor may therefore list backup sources in `discoveryUrls` (§3). They carry the same trust as `loginUrl` — both are static roots the user accepted at import time.

Discovery order is `[origin of loginUrl, ...discoveryUrls]`; every source is asked for `https://<origin>/.well-known/cpx-gateway`. **Any** failure at one source — network error, non-2xx, invalid JSON, invalid fields, or a client-side guard refusal — moves on to the next source; a backup may be a plain static file on a CDN, so `404` simply means "not provided here". When every source fails, the last error wins. Each source is its own origin, so route selection (§6) is independent per source.

A backup source only needs to serve the JSON document at that path over public HTTPS. Any CDN or object storage works, and the gateway itself already serves it, so listing a gateway origin in `discoveryUrls` is the simplest option. Backup sources help already-enrolled devices recover; a **new** login still needs the login host, because the OAuth page opens in the system browser.

### 5a. Signed Discovery Document

With `providerPubKey` in the descriptor the trust root moves from a host name to a key: a discovery document is accepted from anywhere — the login host, any gateway, a static CDN file, or the `/config` response — as long as it verifies under that key and its sequence number is not older than what the client already accepted. This makes the login host replaceable and lets `gateways`, `endpoints`, `loginUrl` and `discoveryUrls` rotate without touching the `.cpx` file.

**Envelope.** One string `"<payloadB64>.<sigB64>"`:

- `payloadB64`: the UTF-8 bytes of the payload JSON, standard base64 with padding.
- `sigB64`: the Ed25519 signature (64 bytes) over `"CPX2-DISCOVERY\0" || payloadBytes` — the ASCII prefix followed by a NUL byte, then the exact payload bytes — standard base64 with padding. The prefix separates discovery documents from any other message signed with the same key.
- Exactly one `.`. Both halves must be **canonical** base64 (decoding and re-encoding reproduces the input). The payload is at most **4 KiB**; after base64 and signature the envelope is about 5.6 KiB, inside the usual 8 KiB per-header limit of CDNs and reverse proxies.

The signer serializes the payload itself and signs those bytes; the client verifies the received bytes before parsing them. No canonicalization (JCS or similar) is involved on either side.

**Payload.**

```json
{
  "spec": "cpx-plugin/2",
  "seq": 12,
  "gateways": ["https://gw1.example.net", "https://gw2-cdn.example.com"],
  "endpoints": {
    "enroll": "/enroll",
    "challenge": "/challenge",
    "config": "/config",
    "revoke": "/revoke"
  },
  "loginUrl": "https://panel-new.example.com/oauth/authorize",
  "discoveryUrls": ["https://gw2-cdn.example.com"]
}
```

| Field           | Rule                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spec`          | `"cpx-plugin/2"`                                                                                                                                                                                                                                                                                                                                                      |
| `seq`           | Integer, `1 ≤ seq ≤ 2^53−1`. Strictly increase it on every change                                                                                                                                                                                                                                                                                                     |
| `gateways`      | Same rules as §5 (1..3 public HTTPS origins)                                                                                                                                                                                                                                                                                                                          |
| `endpoints`     | Same rules as §5; an optional `bootstrap` path is reserved for a later phase                                                                                                                                                                                                                                                                                          |
| `loginUrl`      | Optional; same rules as the descriptor field. When accepted it replaces the stored login URL; the next login opens the new one                                                                                                                                                                                                                                        |
| `discoveryUrls` | Optional; absent = unchanged, `[]` = clear, otherwise the descriptor rules (1..8). When the payload also carries `loginUrl`, the list must not contain that URL's origin — the whole document is invalid otherwise, so remove it before signing. When the payload omits `loginUrl`, the client drops entries equal to its currently stored login origin at apply time |

No other keys are allowed.

**Where it is served** — two places, same format, same verification:

1. The well-known document gains an optional top-level `signed`. Keep `gateway` / `gateways` / `endpoints` for unkeyed and older clients; a keyed client compares them with the payload and rejects the whole source if they disagree, so generate both from the same payload.
2. A successful `/config` response may carry the header `X-CPX-Discovery: <payloadB64>.<sigB64>`. Send it as a single header value; the client ignores repeated headers.

**What the client does.**

| `providerPubKey` in `.cpx` | `signed` in well-known | Behaviour                                                              |
| -------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| no                         | any                    | unsigned path (§5); `signed` and `X-CPX-Discovery` are ignored         |
| yes                        | no                     | **this source fails** (downgrade protection); the next source is tried |
| yes                        | yes                    | verify → parse → sequence check → apply                                |

The client stores the last accepted `seq` together with the SHA-256 of the payload bytes. For an incoming document: no stored value → accept; `seq` higher → accept; same `seq` and same digest → accept as an idempotent re-application; same `seq` but a different digest → reject (two different documents with one number, e.g. inconsistent CDN copies); lower `seq` → reject. A rejected well-known source is skipped like any other discovery failure. A rejected or malformed `X-CPX-Discovery` header is only logged: the authenticated `/config` response is never discarded because of it.

The sequence number protects against the **network** replaying an older document; it is not a defense against someone with write access to the client's own files.

**Applying an accepted document.** Gateways and endpoints go into the client's encrypted cache first; then `loginUrl`, `discoveryUrls`, `seq` and the digest are written to the plugin record in one step. The sequence number is the commit marker: if anything fails in between, the marker does not advance and the next arrival of the same document repairs the record idempotently. On a fresh login the discovery document is applied **before** the browser opens, so a rotated `loginUrl` takes effect immediately and a cancelled login cannot be talked back into an older document afterwards.

**Key management.** Sign offline. The gateway process holds no private key; it only serves a pre-signed envelope file (`DISCOVERY_SIGNED_FILE` in the reference gateway, used both for `signed` and for the header). `cpx-admin keygen` and `cpx-admin sign-discovery <payload.json>` (or `scripts/plugin/sign-discovery.mjs`) read the seed from a file or stdin, never from the command line. Use a separate key for every `.cpx` lineage: documents signed with the same key are interchangeable between the plugins that share it. Key rotation is not part of this version — a lost or leaked key means issuing a new `.cpx`.

**Publish order.** Serve the signed well-known first, then distribute the `.cpx` containing `providerPubKey`. In the other order every keyed client fails discovery until `signed` appears.

---

## 6. Gateway Common Rules

All gateway endpoints are `POST` with JSON request bodies. The client uses HTTPS only, does not follow redirects, and caps responses at 10 MiB.

No Authorization header is used. No bearer token is issued. Device identity is based on `deviceId`, the stored Ed25519 public key, and request signatures.

Client error classification:

| Class         | Condition                                                                                    | Client action                                                             |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `retired`     | HTTP `410`, or JSON `{"error":"gateway_retired"}`                                            | Try the next cached gateway; rediscover once when all are exhausted       |
| `revoked`     | JSON `{"error":"revoked"}` or `{"error":"device_revoked"}`                                   | Mark as needs re-authentication                                           |
| `unreachable` | DNS failure, connection failure, TLS handshake failure                                       | Try the next route, then the next gateway; rediscover once when exhausted |
| `transient`   | Other non-2xx (5xx, 429, bare 401/403), or a timeout                                         | Timeout: next route / next gateway. Any HTTP response: back off and retry |
| `blocked`     | The gateway host resolved to a private/loopback address (client-side guard, nothing is sent) | Back off; the user must fix the target or explicitly choose proxy mode    |
| success       | 2xx without an error marker                                                                  | Continue                                                                  |

For expired accounts, disabled users, or revoked devices, include `revoked` or `device_revoked` in the JSON body. A bare `401` or `403` is treated as transient.

**Optional `message`.** Any error JSON may add a human-readable `message` that the client shows on the plugin card next to its own fixed status text:

```json
{
  "error": "revoked",
  "message": "Your subscription expired on 2026-09-01. Renew and log in again."
}
```

The client only reads `message` when it is a string; it trims it, strips control characters except newline (U+000A), truncates to 200 code points, and treats an empty result as absent. It is rendered as plain text (no Markdown, no links). The message is stored with the plugin until the next successful operation clears it. The same sanitizing rules apply to the static `provider.description` in `.cpx` (cap 500 code points), which is shown on the install page and on the card.

**Routes.** Each request leaves the client either directly or through the user's local proxy. In the default _auto_ mode the client remembers the route that last worked for a plugin, tries it first, and switches to the other one only on a network-level failure or a timeout — never on an HTTP response. Stickiness is per origin: once a gateway origin has answered on a route, the rest of the operation keeps using that route for it. Before any request goes through the proxy, the client resolves the gateway host locally and refuses hosts that resolve to private addresses (`blocked`). Two residual risks remain, both shared with the explicit proxy mode: DNS rebinding between that check and the proxy's own lookup, and hosts that fail to resolve locally are still allowed through the proxy.

**`/enroll` is never replayed.** The authorize `code` is consumed by the first request that reaches the gateway. The client therefore only tries another route or another gateway for `/enroll` when the request provably never left the client (connection refused / DNS / TLS failure before the request was written). A timeout, a connection reset after sending, or any HTTP response ends the login; the user simply logs in again for a fresh code.

---

## 7. `POST {gateway}/enroll`

Purpose: exchange an authorize code for a device binding. This is similar to OAuth token exchange, but no bearer token is returned.

Request:

```json
{
  "code": "<authorize code>",
  "code_verifier": "<PKCE verifier>",
  "redirect_uri": "http://127.0.0.1:<port>/callback",
  "client_id": "mihomo-party",
  "devicePubKey": "<base64 Ed25519 public key>",
  "deviceId": "<UUIDv4>"
}
```

Server steps:

1. Find `code`; verify it is unexpired and unused.
2. Verify PKCE: `BASE64URL(SHA256(code_verifier)) == code_challenge`.
3. Compare `redirect_uri` and `client_id` with the stored values byte-for-byte.
4. Resolve `user_id` from the code.
5. Store `(user_id, deviceId, devicePubKey)`.
6. Mark the code as used.
7. Return 2xx, for example `{"ok":true}`.

Notes:

- `deviceId` is client-generated. Do not replace it.
- A user may have multiple devices. Apply a device-count limit or cleanup policy.
- If enroll succeeds but the first config fetch fails, keep the device binding.
- Re-login creates a new key pair and a new device binding. The client then revokes the device it replaced (see §10), so a user who logs in repeatedly on one machine does not accumulate bindings.

---

## 8. `POST {gateway}/challenge`

Purpose: issue a one-time nonce for a device.

Request:

```json
{ "deviceId": "<UUIDv4>" }
```

Success response:

```json
{
  "nonceId": "<opaque id>",
  "nonce": "<base64 32 bytes>",
  "exp": 60
}
```

Rules:

- Keep a pending-nonce pool per `deviceId`.
- Allow several pending nonces for concurrency.
- `nonce` is 32 cryptographically random bytes.
- TTL should be no more than 60 seconds.
- Delete nonce after use; clean expired nonces.
- Limit pending nonces per device, for example 8.
- `nonceId` is an opaque visible ASCII handle, length <= 64, with no spaces or control characters.
- `nonce` uses standard base64 with `=` padding; decoded length must be exactly 32 bytes.
- `exp` is informational.

For an unknown device, expired account, or revoked device, return:

```json
{ "error": "revoked" }
```

---

## 9. `POST {gateway}/config`

Purpose: verify the device signature and return the user's Clash YAML.

Request:

```json
{
  "deviceId": "<UUIDv4>",
  "nonceId": "<challenge nonceId>",
  "nonce": "<challenge nonce>",
  "ts": 1700000000000,
  "sig": "<base64 Ed25519 signature>"
}
```

Server steps:

1. Look up the pending nonce by `deviceId` and `nonceId`.
2. Verify request `nonce` matches the stored value.
3. Verify the nonce is unexpired and unconsumed.
4. Check clock skew: `abs(now_ms - ts) <= 300000`.
5. Load `devicePubKey` for the device.
6. Build the canonical sign input from section 11 with `op=1`.
7. Verify the Ed25519 signature.
8. Consume the nonce.
9. Resolve `user_id` from `deviceId`.
10. Generate the subscription internally or fetch it from a hidden origin.
11. Return HTTP 200 with Clash YAML as the response body.

Successful `/config` response is not JSON. The client parses it as Clash YAML and requires an object containing at least `proxies` or `proxy-providers`.

A successful response may additionally carry the header `X-CPX-Discovery: <payloadB64>.<sigB64>` (§5a). The client reads it only for plugins with `providerPubKey`, only as a single header value, and a failed verification is logged and ignored — the YAML body is still applied.

Do not return the subscription URL, origin API host, or origin token.

---

## 10. `POST {gateway}/revoke`

Purpose: unbind a device. The client calls it best-effort in two situations:

- the user deletes the plugin — for the current device and any device still waiting in the list below;
- a re-login replaced the device — for the **previous** device, signed with the previous key, right after the login completes. If that call fails, the client keeps the old credentials and retries after later successful `/config` fetches, one device per attempt.

A `/challenge` answer of `revoked` / `device_revoked` for the old device counts as "already unbound" and ends the retries. Nothing new is required of the gateway beyond §7 and the idempotency rule below; the only visible change is that `/revoke` now also arrives after re-logins, for a device that is no longer the account's newest one — unbind that `deviceId` only.

Request body is the same as `/config`.

Use the same verification flow as `/config`, but build the sign input with `op=2`. After successful verification, remove the `deviceId` binding and consume the nonce.

`/revoke` must be idempotent. Return 2xx even if the device is already absent.

---

## 11. Device Signature

Canonical sign input:

```text
SignInput = "CPX2"                              // 4 bytes ASCII
          | uint8(op)                           // config=1, revoke=2
          | uint8(len(deviceId)) | deviceId     // UTF-8 bytes
          | uint8(len(nonceId))  | nonceId      // UTF-8 bytes
          | nonce                               // 32 raw bytes
          | uint64_be(ts)                       // Unix milliseconds
```

Signature:

```text
sig = Ed25519_sign(devicePrivKey, SignInput)
```

`sig` is 64 raw bytes on input to standard base64.

Implementation notes:

- Decode `nonce` from base64 before adding it to `SignInput`.
- Encode `ts` as an 8-byte unsigned big-endian integer.
- `deviceId` and `nonceId` length prefixes are one unsigned byte.
- `/config` uses `op=1`; `/revoke` uses `op=2`.

---

## 12. Wire Encoding

| Field                              | Encoding                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `devicePubKey`                     | Ed25519 public key, 32 raw bytes, standard base64 with padding                    |
| `sig`                              | Ed25519 signature, 64 raw bytes, standard base64 with padding                     |
| `nonce`                            | 32 raw bytes, standard base64 with padding, usually 44 chars                      |
| `deviceId`                         | UUIDv4, 36 lowercase chars with hyphens; server cap <= 64                         |
| `nonceId`                          | Server-generated opaque visible ASCII, length <= 64                               |
| `ts`                               | Integer, Unix milliseconds                                                        |
| `op`                               | `uint8`; config=1, revoke=2                                                       |
| `code`                             | Opaque authorize code, length <= 2048                                             |
| `code_challenge` / `code_verifier` | RFC 7636 base64url, no padding; verifier length 43-128, charset `[A-Za-z0-9-._~]` |
| `providerPubKey`                   | Ed25519 public key, 32 raw bytes, standard base64 with padding                    |
| `signed` / `X-CPX-Discovery`       | `<payloadB64>.<sigB64>`; both halves canonical standard base64 with padding       |

Only PKCE fields use base64url without padding. Binary protocol fields use standard base64 with padding.

---

## 13. PHP Snippet

PKCE:

```php
function pkce_ok(string $verifier, string $challenge): bool {
    $calc = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    return hash_equals($challenge, $calc);
}
```

Signature verification:

```php
function build_sign_input(int $op, string $deviceId, string $nonceId, string $nonceRaw, int $tsMs): string {
    return "CPX2"
        . chr($op)
        . chr(strlen($deviceId)) . $deviceId
        . chr(strlen($nonceId)) . $nonceId
        . $nonceRaw
        . pack('J', $tsMs); // uint64 big-endian
}

$nonceRaw = base64_decode($req['nonce'], true);
$pub      = base64_decode($devicePubKeyB64, true);
$sig      = base64_decode($req['sig'], true);
$ts       = (int)$req['ts'];

if ($nonceRaw === false || $pub === false || $sig === false) { /* 400 */ }
if (strlen($nonceRaw) !== 32 || strlen($pub) !== 32 || strlen($sig) !== 64) { /* 400 */ }
if (abs((int)(microtime(true) * 1000) - $ts) > 300000) { /* 400 */ }

// Also check nonceId/nonce belongs to deviceId and is unexpired/unconsumed.

$op    = ($endpoint === 'config') ? 1 : 2;
$input = build_sign_input($op, $req['deviceId'], $req['nonceId'], $nonceRaw, $ts);
$ok    = sodium_crypto_sign_verify_detached($sig, $input, $pub);
if (!$ok) { /* 401 or 400 */ }

// Consume nonce after successful verification.
```

Revocation response:

```php
http_response_code(403);
header('Content-Type: application/json');
echo json_encode(['error' => 'revoked']);
```

---

Signed discovery document (§5a), done offline:

```php
$payload = json_encode($doc, JSON_UNESCAPED_SLASHES); // sign exactly these bytes
$sig     = sodium_crypto_sign_detached("CPX2-DISCOVERY\0" . $payload, $secretKey);
$signed  = base64_encode($payload) . '.' . base64_encode($sig);
// providerPubKey for the .cpx: base64_encode(sodium_crypto_sign_publickey($keypair))
```

---

## 14. Test Vectors

File:

```text
src/main/resolve/plugin/__fixtures__/sign-vectors.json
```

Each vector contains:

- `op`
- `deviceId`
- `nonceId`
- `privSeedB64`
- `pubKeyB64`
- `nonceB64`
- `ts`
- `inputHex`
- `sigB64`

Verify:

1. Your canonical input hex equals `inputHex`.
2. `sigB64` verifies under `pubKeyB64`.

Regenerate vectors:

```bash
node scripts/plugin/gen-sign-vectors.mjs
```

Signed discovery vectors (§5a):

```text
src/main/resolve/plugin/__fixtures__/discovery-vectors.json
```

Each entry contains `seedB64`, `pubKeyB64`, `payloadJson`, `payloadB64`, `signInputHex` (prefix + payload), `sigB64`, `signed` and `digestHex`. Verify that signing `signInputHex` with the seed reproduces `sigB64`, that `signed` verifies under `pubKeyB64`, and that SHA-256 of the payload bytes equals `digestHex`. Regenerate with `node scripts/plugin/gen-discovery-vectors.mjs`.

---

## 15. Launch Checklist

Descriptor:

- [ ] `.cpx` contains only valid v2 fields.
- [ ] `loginUrl` is an HTTPS authorize endpoint with no query, fragment, or userinfo.
- [ ] Optional icon uses an allowed data URI format and size.

Login host:

- [ ] `/.well-known/cpx-gateway` returns valid JSON.
- [ ] authorize accepts `http://127.0.0.1:<random-port>/callback`.
- [ ] successful login redirects with `code` and original `state`.
- [ ] code is one-time and TTL <= 60 seconds.
- [ ] code stores `redirect_uri`, `client_id`, and `code_challenge`.

Gateway:

- [ ] `gateway` is a public HTTPS origin.
- [ ] if `gateways` is present it lists 1..3 public HTTPS origins and `gateway` equals `gateways[0]`.
- [ ] every listed gateway reaches the same backend state (codes, devices, nonces); no independent replicas.
- [ ] if the `.cpx` carries `providerPubKey`: the well-known already serves `signed`, the top-level fields match the payload, and the signed document went live **before** the `.cpx` was distributed.
- [ ] endpoint paths are relative and contain no backslash, query, or fragment.
- [ ] `/enroll` verifies PKCE, code, redirect URI, and client ID.
- [ ] `/challenge` issues 32-byte standard-base64 nonce values with short TTL and pool limits.
- [ ] `/config` verifies nonce, clock skew, signature, consumes nonce, and returns Clash YAML.
- [ ] `/revoke` verifies with `op=2`, consumes nonce, and idempotently unbinds the device.
- [ ] account/device revocation returns `{"error":"revoked"}` or `{"error":"device_revoked"}`.
- [ ] gateway retirement returns HTTP `410` or `{"error":"gateway_retired"}`.

Compatibility:

- [ ] `devicePubKey`, `sig`, and `nonce` use standard base64 with padding.
- [ ] PKCE uses base64url without padding.
- [ ] sign input uses raw nonce bytes, not the base64 string.
- [ ] `ts` is encoded as uint64 big-endian.
- [ ] implementation passes `sign-vectors.json`.

---

## 16. Logging

Do not log:

- authorize `code`
- `code_verifier`
- nonce or nonceId
- user password or raw login form
- subscription URL, origin token, or full Clash YAML

Safe operational fields include `user_id`, `deviceId`, endpoint name, status code, duration, and gateway version.
