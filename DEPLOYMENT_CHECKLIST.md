# Vercel Deployment Checklist

## Pre-Deployment

- [x] Code finalized with OpenAI Vision API
- [x] `vercel.json` created
- [x] `.vercelignore` created
- [x] `.env.example` created
- [x] Server exports app correctly
- [x] All dependencies in `package.json`
- [x] No Python dependencies needed
- [x] CORS configured for production

## Environment Variables to Set in Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:

```
MONGODB_URI=your_mongodb_connection_string
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=production
```

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push
   ```

2. **Deploy to Vercel**
   - Go to vercel.com
   - Import GitHub repository
   - Configure (see VERCEL_DEPLOY.md)
   - Add environment variables
   - Deploy

3. **Test Deployment**
   ```bash
   curl https://your-project.vercel.app/health
   ```

4. **Update Frontend**
   - Set `VITE_API_BASE_URL=https://your-project.vercel.app`

## Post-Deployment

- [ ] Test `/health` endpoint
- [ ] Test `/api` endpoint
- [ ] Test `/api/ocr` endpoint with sample image
- [ ] Test `/api/bookings` endpoint
- [ ] Update frontend API URL
- [ ] Monitor logs for errors
- [ ] Check OpenAI API usage/costs

## Files Created for Deployment

- `vercel.json` - Vercel configuration
- `.vercelignore` - Files to exclude from deployment
- `.env.example` - Environment variable template
- `DEPLOYMENT.md` - Detailed deployment guide
- `VERCEL_DEPLOY.md` - Quick deployment guide

## Notes

- Serverless functions may have cold starts (1-2 seconds)
- Timeout: 10s (Hobby) or 60s (Pro)
- MongoDB must allow connections from Vercel IPs
- OpenAI API key must have credits

