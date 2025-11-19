# Vercel Deployment Guide

## Quick Deploy

### Step 1: Prepare Your Code

1. **Ensure all files are committed:**
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push
   ```

### Step 2: Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `.` (leave as root)
   - **Build Command**: Leave empty
   - **Output Directory**: Leave empty
   - **Install Command**: `npm install`
5. Add Environment Variables:
   - `MONGODB_URI` - Your MongoDB connection string
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `NODE_ENV` - `production`
6. Click **"Deploy"**

#### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (follow prompts)
vercel

# For production
vercel --prod
```

### Step 3: Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

```
MONGODB_URI=your_mongodb_connection_string
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=production
```

**Important**: After adding environment variables, redeploy your project.

### Step 4: Test Your Deployment

```bash
# Replace with your Vercel URL
curl https://your-project.vercel.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "KN Express Backend API"
}
```

## Environment Variables

### Required:
- `MONGODB_URI` - MongoDB Atlas connection string
- `OPENAI_API_KEY` - OpenAI API key for OCR

### Optional:
- `NODE_ENV` - Set to `production` (default)
- `PORT` - Vercel handles this automatically

## Important Notes

1. **Serverless Functions**: Vercel runs your Express app as serverless functions
2. **Cold Starts**: First request may take 1-2 seconds
3. **Timeout**: 
   - Hobby plan: 10 seconds
   - Pro plan: 60 seconds
4. **File System**: Read-only in serverless environment
5. **MongoDB**: Ensure your MongoDB Atlas allows connections from Vercel IPs (0.0.0.0/0)

## Troubleshooting

### Deployment Fails
- Check build logs in Vercel dashboard
- Ensure `package.json` has all dependencies
- Verify Node.js version (requires >=18.0.0)

### 404 Errors
- Check `vercel.json` configuration
- Verify routes are correct
- Check function logs in Vercel dashboard

### Environment Variables Not Working
- Ensure variables are set in Vercel dashboard
- Redeploy after adding variables
- Variable names are case-sensitive

### OpenAI API Errors
- Verify `OPENAI_API_KEY` is correct
- Check API key has credits
- Ensure access to GPT-4 Vision models

## Monitoring

- **Logs**: Vercel Dashboard → Functions → Logs
- **Analytics**: Available in Vercel Dashboard
- **Errors**: Check Function logs for details

## Update Frontend

After deployment, update your frontend `.env`:

```env
VITE_API_BASE_URL=https://your-project.vercel.app
```

## Cost

- **Vercel Hobby**: Free (with limitations)
- **OpenAI API**: ~$0.01-0.03 per OCR request
- **MongoDB**: Depends on your plan

