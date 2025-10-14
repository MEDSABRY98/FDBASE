# Vercel Cache Setup Guide

## 📌 Cache Behavior on Vercel

Vercel's serverless functions are **stateless**, meaning file-based caching doesn't work. The application automatically detects when running on Vercel and adjusts its caching strategy.

## 🔄 Three Cache Modes

### 1. ⚡ No-Cache Mode (Default on Vercel)
**When**: Running on Vercel WITHOUT Redis/KV  
**Behavior**: Data fetched directly from Google Sheets on every request  
**Performance**: Slower, but works without additional setup  
**Cost**: Free (no cache service needed)

### 2. 🚀 Redis Cache Mode (Recommended for Production)
**When**: Redis URL is configured  
**Behavior**: Data cached in Redis with configurable TTL  
**Performance**: Very fast  
**Cost**: Requires Redis service

### 3. 📁 File Cache Mode (Local/Desktop Only)
**When**: Running locally or as desktop app  
**Behavior**: Data cached in local filesystem  
**Performance**: Fast  
**Cost**: Free

## 🔧 Setting Up Redis on Vercel

### Option 1: Upstash Redis (Recommended)

1. **Create Upstash Account**
   - Go to [upstash.com](https://upstash.com)
   - Sign up (free tier available)

2. **Create Redis Database**
   - Click "Create Database"
   - Choose region closest to your Vercel deployment
   - Copy the Redis URL

3. **Add to Vercel**
   - Go to Vercel Dashboard
   - Select your project
   - Settings → Environment Variables
   - Add: `REDIS_URL` = `your-upstash-redis-url`

### Option 2: Vercel KV (Beta)

1. **Enable Vercel KV**
   - Go to your project in Vercel Dashboard
   - Storage → Create Database → KV
   - Follow Vercel's setup wizard

2. **Auto-Configuration**
   - Vercel automatically sets `KV_URL` environment variable
   - Application will detect and use it

### Option 3: Other Redis Providers

Compatible providers:
- **Redis Cloud** (redis.com)
- **Railway** (railway.app)
- **Render Redis** (render.com)
- **AWS ElastiCache**
- **Azure Cache for Redis**

Just set the `REDIS_URL` environment variable.

## 📊 Performance Comparison

| Mode | First Request | Cached Request | Cost |
|------|---------------|----------------|------|
| No-Cache | ~2-5s | ~2-5s | Free |
| Redis | ~2-5s | ~50-200ms | ~$0-10/month |
| File (Local) | ~2-5s | ~10-50ms | Free |

## 🔍 How to Check Current Mode

The application logs the cache mode on startup:

```
✅ Using Redis cache: xxxxx  // Redis mode
📁 Using file-based cache: ... // File mode
⚡ Vercel detected: Running in NO-CACHE mode // No-cache mode
```

Or check via API:
```bash
curl https://your-app.vercel.app/api/ahly-stats/sync-status
```

Response includes cache type:
```json
{
  "cache_type": "Redis",  // or "File" or "No Cache (Direct Fetch)"
  ...
}
```

## ⚙️ Environment Variables

### Required for All Deployments
```bash
GOOGLE_CREDENTIALS_JSON_AHLY_MATCH='{"type": "service_account", ...}'
AHLY_MATCH_SHEET_ID='your_sheet_id'
```

### Optional - Enable Caching
```bash
REDIS_URL='redis://...'  # For Redis caching
# OR
KV_URL='redis://...'     # For Vercel KV
```

### Optional - Cache Configuration
```bash
CACHE_TTL_HOURS=6  # Default: 6 hours
```

## 🎯 Recommendations

### For Development/Testing
- ✅ Use **No-Cache mode** (no setup needed)
- ✅ Or use **File cache** locally

### For Production (Low Traffic)
- ✅ Use **No-Cache mode** (save costs)
- ⚠️ Accept slower response times

### For Production (High Traffic)
- ✅ Use **Redis** (best performance)
- ✅ Use **Upstash** free tier for small apps
- ✅ Upgrade to paid Redis for large-scale apps

## 🐛 Troubleshooting

### Problem: Slow Response Times on Vercel

**Cause**: Running in no-cache mode  
**Solution**: Add Redis/KV

### Problem: "Redis not available" Error

**Cause**: Invalid REDIS_URL  
**Solution**: 
1. Check REDIS_URL is correctly set
2. Verify Redis service is running
3. Check Redis accepts connections from Vercel IPs

### Problem: Stale Data

**Cause**: Cache not refreshing  
**Solution**:
1. Trigger manual sync: `POST /api/ahly-stats/sync-now`
2. Reduce `CACHE_TTL_HOURS`
3. Clear cache via Redis CLI

### Problem: Out of Memory on Redis

**Cause**: Too much cached data  
**Solution**:
1. Reduce `CACHE_TTL_HOURS`
2. Upgrade Redis plan
3. Implement cache size limits

## 📚 Additional Resources

- [Upstash Documentation](https://docs.upstash.com/)
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Redis Documentation](https://redis.io/documentation)

## 💡 Tips

1. **Monitor Redis Usage**: Check Upstash dashboard for usage metrics
2. **Set Alerts**: Configure alerts for Redis memory/connection limits
3. **Test Locally First**: Use file cache locally before deploying
4. **Backup Strategy**: Google Sheets is your source of truth
5. **Cache Invalidation**: Use manual sync endpoint when data changes

---

**Need Help?** Open an issue on GitHub or check the main README.md

