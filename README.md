# Servio — Restaurant AI Waiter frontend

Static frontend using HTML5, CSS3, Bootstrap 5 and vanilla JavaScript modules.

## Run locally

From this directory run:

```bash
python -m http.server 5500
```

Open http://localhost:5500. Do not open HTML files directly with `file://` because Firebase uses ES modules.

## Firebase setup

1. Create a Firebase project and register a Web App.
2. Put its web configuration in `assets/firebase-config.js`.
3. Enable Email/Password and Google providers under Authentication.
4. Create Firestore and configure restrictive security rules.
5. Add localhost and your production domain to Authentication's authorized domains.

The sample stores basic profile data in `users/{uid}`. In production, have your backend create a separate public `restaurantId`; do not expose a private account ID in public QR links.

## FastAPI integration

Set `API_BASE_URL` in `assets/firebase-config.js`. The customer chat sends `POST /api/chat` with:

```json
{"restaurant_id":"public-id","session_id":"browser-generated-id","message":"Do you have vegetarian pasta?","language":"en"}
```

It expects `{ "answer": "..." }` (also accepts `response` or `message`). Adapt `chat/chat.js` if your API contract differs. Menu upload has an integration placeholder in `dashboard/index.js`; use `FormData` and a Firebase ID token as shown in comments there.

## Production security checklist

- Firebase auth state redirect is a UI route guard, not a security boundary.
- Verify Firebase ID tokens in every protected FastAPI endpoint.
- Enforce restaurant ownership and roles server-side.
- Backend must verify payments, package entitlement and menu quota on every upload. Never trust plan, quota, prices or payment status from browser JavaScript.
- Keep Firestore security rules restrictive; plan/payment/quota fields should be server-managed.
- Validate PDF content, size and ownership on the server; configure CORS allow-list, rate limits and abuse protection.
- Never put service-account credentials, private API keys or payment secrets in frontend code.

Dashboard metrics, conversations, menu entries and purchase history are sample UI data until connected to APIs.
