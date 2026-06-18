# Secret Calculator Chat

A full-stack private messenger hidden behind a fake calculator. Visitors see only the calculator until they enter `+914+` and press `=`.

## Features

- Fake calculator landing screen with funny incorrect answers
- Secret code gate to authentication
- Sign up, password login, Pass ID quick login, forgot password, reset password
- JWT sessions and bcrypt password hashing
- MongoDB schemas for users, contacts, and messages
- Contact search by 5-digit User ID
- Real-time Socket.io messaging with delivery/read status
- Client-side AES-GCM encryption for text messages
- Emoji, sticker, image, voice, and file messages
- Message timestamps and delete-for-me
- Profile photo upload
- Online/offline presence
- Dark mode
- Voice/video WebRTC calls with incoming call notifications
- Express rate limiting, Helmet, validation, XSS cleanup, and MongoDB query APIs

## Project Structure

```text
secret-calculator-chat/
  client/        React + Tailwind + Socket.io client
  server/        Express + Socket.io + MongoDB API
  README.md
```

## Requirements

- Node.js 20+
- MongoDB 7+ running locally or a MongoDB Atlas database
- A browser that supports WebRTC, Web Crypto, MediaRecorder, and getUserMedia

## Local Installation

1. Install dependencies:

```bash
npm install
npm run install:all
```

2. Start MongoDB.

Fastest local option, no MongoDB install required:

```bash
npm run dev:local
```

This starts the server with an embedded development MongoDB and starts the React app.

If you have Docker Desktop installed:

```bash
npm run dev:db
```

If you already run MongoDB another way, make sure it is listening at `mongodb://127.0.0.1:27017`, or update `server/.env` with your own `MONGODB_URI`.

3. Configure the backend:

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/secret-calculator-chat
JWT_SECRET=use-a-long-random-secret
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

4. Configure the frontend:

```bash
cd ../client
cp .env.example .env
```

Edit `client/.env` if your API is not on port `5000`:

```env
VITE_API_URL=http://localhost:5000
```

5. Start the app from the project root:

```bash
npm run dev
```

6. Open:

```text
http://localhost:5173
```

Enter `+914+` and press `=` to reveal authentication.

If signup says the backend cannot be reached, verify both services are running:

```bash
curl http://localhost:5000/api/health
```

## API Routes

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login/password`
- `POST /api/auth/login/passid`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Users

- `GET /api/users/search?userId=123`
- `PATCH /api/users/profile`

### Contacts

- `GET /api/contacts`
- `POST /api/contacts`

### Messages

- `GET /api/messages?with=<mongoUserId>`
- `DELETE /api/messages/:id`

### Uploads

- `POST /api/uploads` with multipart field `file`

## Socket.io Events

### Messaging

- Client emits `message:send`
- Server emits `message:new`
- Client emits `message:read`
- Server emits `message:status`
- Server emits `presence:update`

### WebRTC Signaling

- `call:offer`
- `call:answer`
- `call:ice`
- `call:end`

The server handles signaling only. Audio/video media flows peer-to-peer through WebRTC.

## Database Schemas

### Users

```js
{
  username,
  userId,
  passwordHash,
  passIdHash,
  profilePhoto,
  resetCodeHash,
  resetCodeExpires,
  createdAt
}
```

### Contacts

```js
{
  ownerId,
  contactId,
  createdAt,
  updatedAt
}
```

### Messages

```js
{
  senderId,
  receiverId,
  type,
  content,
  iv,
  fileName,
  status,
  deletedFor,
  timestamp
}
```

## Security Notes

- Passwords and Pass IDs are hashed with bcrypt.
- JWTs expire after 7 days.
- Auth routes are rate limited.
- Inputs are validated with `express-validator`.
- Text messages are encrypted in the browser with AES-GCM before storage.
- Text content is sanitized server-side before persistence.
- MongoDB is accessed through Mongoose models, not raw SQL-style string queries.
- For production password reset, replace the development reset-code response with email/SMS delivery.
- For production WebRTC reliability, add a TURN provider such as Coturn, Twilio, Xirsys, or Metered.

## VPS + Domain Deployment

1. Provision a VPS with Ubuntu 24.04.

2. Point DNS records to the VPS:

```text
A     example.com      <server-ip>
A     www              <server-ip>
```

3. Install packages:

```bash
sudo apt update
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx
```

Install MongoDB locally or use MongoDB Atlas. For local MongoDB, follow MongoDB's official Ubuntu repository steps for your OS version.

4. Upload this project to `/var/www/secret-calculator-chat`.

5. Install and build:

```bash
cd /var/www/secret-calculator-chat
npm install
npm run install:all
npm run build --prefix client
```

6. Create `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/secret-calculator-chat
JWT_SECRET=<long-random-production-secret>
CLIENT_ORIGIN=https://example.com
NODE_ENV=production
```

7. Install PM2 and start the API:

```bash
sudo npm install -g pm2
pm2 start server/src/index.js --name secret-calculator-chat
pm2 save
pm2 startup
```

8. Configure Nginx:

```nginx
server {
  listen 80;
  server_name example.com www.example.com;

  root /var/www/secret-calculator-chat/client/dist;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:5000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:5000/uploads/;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:5000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

Save as `/etc/nginx/sites-available/secret-calculator-chat`, then enable:

```bash
sudo ln -s /etc/nginx/sites-available/secret-calculator-chat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

9. Enable HTTPS:

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

10. Update `client/.env` before future production builds:

```env
VITE_API_URL=https://example.com
```

Then rebuild the client and reload Nginx.

## Production Checklist

- Use HTTPS only.
- Store `JWT_SECRET` outside source control.
- Replace development reset code output with email/SMS delivery.
- Use object storage for uploads if traffic grows.
- Add virus scanning for uploaded files.
- Configure TURN for WebRTC calls across strict networks.
- Add database backups.
- Add log rotation and monitoring for PM2/Nginx/MongoDB.
