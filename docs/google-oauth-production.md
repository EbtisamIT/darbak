# Google OAuth production readiness — Darbak Auto Apply

This checklist prepares Darbak for Google OAuth verification. It does not enable Auto Apply sending or launch Auto Apply publicly.

## Public app information

- App name: `Darbak`
- Homepage: `https://darbak.space/`
- Privacy policy: `https://darbak.space/privacy`
- Terms of service: `https://darbak.space/terms`
- Support email: `info@darbak.space`
- Authorized top private domain: `darbak.space`
- Production API origin: `https://api.darbak.space`
- Production OAuth callback: `https://api.darbak.space/api/auto-apply/email/gmail/callback`
- Audience: External
- Production Google Cloud project: required and separate from the local/test project
- Gmail API: enabled in the production project

## Requested scopes

Request only:

- `openid`
- `email`
- `https://www.googleapis.com/auth/gmail.send`

Inbox-reading scopes requested: **NONE**.

Do not request `gmail.readonly`, `gmail.modify`, or `https://mail.google.com/`.

### Why `gmail.send` is needed

Darbak sends student-approved training applications from the student's own Gmail account. The initial product mode is Review First: the student reviews the destination, subject, message, and attachments and explicitly approves each send.

## Production environment variables

Configure secrets in the production backend environment only. Never commit their values.

```ini
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://api.darbak.space/api/auto-apply/email/gmail/callback
AUTO_APPLY_FRONTEND_URL=https://darbak.space
AUTO_APPLY_EMAIL_TOKEN_ENCRYPTION_KEY=
AUTO_APPLY_GMAIL_OAUTH_ENABLED=true
AUTO_APPLY_REAL_SEND_ENABLED=false
```

Keep local development in its separate Google Cloud test project/client with this callback:

```text
http://localhost:3001/api/auto-apply/email/gmail/callback
```

`AUTO_APPLY_EMAIL_TOKEN_ENCRYPTION_KEY` must be 32 random bytes encoded as Base64 or 64 hexadecimal characters. Never commit it.

## Google Cloud verification checklist

- [x] Add `api.darbak.space` to the existing Render API service without disabling the Render fallback domain.
- [x] Point the `api` CNAME to the exact Render target and confirm HTTPS/API health.
- [x] Confirm ownership of `https://darbak.space/` in Google Search Console.
- [ ] Create and configure a dedicated production Google Cloud project and Web OAuth client.
- [ ] Enable Gmail API in the production Google Cloud project.
- [ ] Set audience to External.
- [ ] Add the final exact HTTPS callback URI to the production Web OAuth client.
- [ ] Configure homepage, privacy policy, terms, support email, developer contacts, and authorized domain.
- [ ] Add only the scopes listed above.
- [ ] Publish the updated privacy policy and terms before verification submission.
- [ ] Configure the production backend OAuth variables while keeping real sending disabled.
- [ ] Confirm OAuth tokens are encrypted server-side and never returned by an API response.
- [ ] Record the verification demonstration only after the public legal pages and connection-only production smoke pass.

## Verification video script

Use a dedicated test student and a controlled recipient. Mask personal data and secrets.

1. Open Darbak Auto Apply while signed in as the test student.
2. Show the Gmail connection section and select **ربط Gmail**.
3. Show the Google consent screen and the Darbak app identity.
4. Expand the permission details and show that Gmail permission is send-only; no inbox-reading permission is requested.
5. Approve the connection and return to Darbak.
6. Show the connected Gmail address in Darbak without exposing any token.
7. Open one prepared training application in Review First mode.
8. Show the destination, subject, message, base CV, and any supported attachments.
9. Explicitly approve the send.
10. Show the success state and then show the message in the Gmail Sent folder.
11. State and demonstrate that Darbak never opens, lists, searches, or reads inbox messages.
12. Return to Darbak and disconnect Gmail.
13. Refresh the page and show that the account is no longer connected.

Do not record or submit the video until the production OAuth client, public policies, and connection-only smoke are ready.

## Policy references

- Google OAuth production readiness: <https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance>
- Google API Services User Data Policy: <https://developers.google.com/terms/api-services-user-data-policy>
- Gmail API scopes: <https://developers.google.com/workspace/gmail/api/auth/scopes>
- Sensitive scope verification: <https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification>
