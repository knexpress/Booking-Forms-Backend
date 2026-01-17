# KN Express Backend

Express + MongoDB API server with OpenAI Vision OCR for Emirates ID detection.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Create .env file (see .env.example)
cp .env.example .env

# Start server
npm start
```

## 📡 API Endpoints

- `GET /health` - Health check
- `GET /api` - API information
- `POST /api/bookings` - Submit booking
- `POST /api/ocr` - OCR for Emirates ID detection (uses OpenAI Vision)

## 🚀 Deploy to Render

### Quick Deploy

1. **Go to [Render.com](https://render.com)**

2. **Create New Web Service**
   - Connect your GitHub repository
   - Root directory: `backend`
   - Name: `kn-express-api`
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`

3. **Environment Variables**

Add in Render Dashboard → Environment:

```
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/?retryWrites=true&w=majority&appName=APP_NAME
PORT=5000
NODE_ENV=production
```

**⚠️ IMPORTANT:** Replace `USERNAME`, `PASSWORD`, `cluster`, and `APP_NAME` with your actual MongoDB Atlas credentials from your `.env` file. Never commit real credentials to git.

4. **Deploy!**

Your API will be at: `https://kn-express-api.onrender.com`

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Create .env file
# See .env.example

# Run server
npm run dev
```

Server runs on: http://localhost:5000

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api` | API info |
| POST | `/api/bookings` | Submit booking |

---

## 🧪 Test API

```bash
# Health check
curl https://kn-express-api.onrender.com/health

# Submit booking
curl -X POST https://kn-express-api.onrender.com/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "sender": {
      "fullName": "John Doe",
      "emailAddress": "john@example.com",
      "completeAddress": "Dubai",
      "contactNo": "+971501234567"
    },
    "receiver": {
      "fullName": "Jane Doe",
      "emailAddress": "jane@example.com",
      "completeAddress": "Manila",
      "contactNo": "+639171234567",
      "deliveryOption": "deliver"
    },
    "items": [
      {"commodity": "Clothes", "quantity": 5}
    ],
    "termsAccepted": true
  }'
```

---

## 🔒 CORS Configuration

Update `server.js` after deploying frontend:

```javascript
app.use(cors({
  origin: 'https://your-frontend.vercel.app',
  credentials: true
}))
```

---

## 📊 MongoDB

Bookings are saved to:
- Database: **AYA**
- Collection: **BOOKING-DATA**

View at: [MongoDB Atlas](https://cloud.mongodb.com)

---

## 🛠️ Deployment Checklist

- [ ] Environment variables set in Render
- [ ] MongoDB connection string added
- [ ] Server starts successfully
- [ ] `/health` endpoint returns OK
- [ ] Test booking submission
- [ ] Update frontend `VITE_API_URL`
- [ ] Update CORS to allow frontend domain

---

## 📝 Environment Variables

Required:
- `MONGODB_URI` - MongoDB connection string
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)

---

**Deployed URL:** https://kn-express-api.onrender.com

