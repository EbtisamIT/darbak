# Auto Apply Gmail OAuth (local setup)

Auto Apply requests one Gmail API permission only: `https://www.googleapis.com/auth/gmail.send`.
It also requests the standard `openid email` identity scopes so Darbak can verify and display which Google account was connected. These identity scopes do not permit reading Gmail.

Required backend environment variables:

```ini
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/auto-apply/email/gmail/callback
AUTO_APPLY_FRONTEND_URL=http://localhost:3000/auto-apply
AUTO_APPLY_EMAIL_TOKEN_ENCRYPTION_KEY=
```

`AUTO_APPLY_EMAIL_TOKEN_ENCRYPTION_KEY` must be 32 random bytes encoded as Base64, or 64 hexadecimal characters. Never commit its value.

The Google Cloud Web application must authorize this exact local redirect URI:

```text
http://localhost:3001/api/auto-apply/email/gmail/callback
```
