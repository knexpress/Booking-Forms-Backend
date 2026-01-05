# MongoDB Backup & Restore Guide

## Current Database Status

**Database:** `finance`  
**Cluster:** `finance.gk7t9we.mongodb.net`  
**Collections:** 27 collections  
**Key Collections:**
- `bookings`: 41 documents (2.69 MB)
- `otps`: 2 documents
- `clients`: 64 documents
- And 24 more collections...

---

## ✅ How to Check for MongoDB Atlas Backups

Since you're using **MongoDB Atlas**, you have access to automated backups (if you have M10+ cluster):

### Step 1: Access Atlas Dashboard
1. Go to: https://cloud.mongodb.com
2. Log in with your MongoDB Atlas account
3. Select your project/organization

### Step 2: Navigate to Backups
1. Click on **Clusters** in the left sidebar
2. Select your cluster: `finance` (or the cluster name)
3. Click on **Backups** tab (available for M10+ clusters)

### Step 3: Check Backup Status
- **Automated Backups**: Available for M10, M30, M40+ clusters
- **Snapshot Schedule**: Shows when backups are created
- **Point-in-Time Restores**: Available for continuous backups
- **Backup Size**: Shows total backup storage used

---

## 🔄 Restore from MongoDB Atlas Backup

### Option 1: Restore via Atlas Dashboard (Recommended)

1. **Navigate to Backups Tab**
   - Go to: Clusters → Your Cluster → Backups

2. **Select a Snapshot**
   - Click on a snapshot from the list
   - Snapshot shows: Date, Time, Size, Status

3. **Restore Options**
   - **Download**: Download backup files locally
   - **Restore to New Cluster**: Create new cluster from backup
   - **Restore to Existing Cluster**: Overwrite existing cluster (⚠️ **DESTRUCTIVE**)
   - **Export**: Export to AWS S3, Azure Blob, or Google Cloud Storage

4. **Select Restore Method**
   - **Point-in-Time Restore**: Restore to specific date/time
   - **Snapshot Restore**: Restore from specific snapshot

### Option 2: Restore via mongorestore (If you have backup files)

If you have backup files (`.bson` files from `mongodump`):

```bash
# Install MongoDB Database Tools (if not installed)
# Download from: https://www.mongodb.com/try/download/database-tools

# Restore from backup directory
mongorestore --uri="mongodb+srv://aliabdullah:knex22939@finance.gk7t9we.mongodb.net/finance?retryWrites=true&w=majority&appName=Finance" ./backup/finance/

# Restore specific collection
mongorestore --uri="mongodb+srv://aliabdullah:knex22939@finance.gk7t9we.mongodb.net/finance?retryWrites=true&w=majority&appName=Finance" --collection=bookings ./backup/finance/bookings.bson

# Restore to different database
mongorestore --uri="mongodb+srv://aliabdullah:knex22939@finance.gk7t9we.mongodb.net/finance?retryWrites=true&w=majority&appName=Finance" --nsFrom="finance.*" --nsTo="finance_restored.*" ./backup/finance/
```

---

## 💾 Create Backup (If No Backup Exists)

### Option 1: Create Backup via mongodump

```bash
# Create backup of entire database
mongodump --uri="mongodb+srv://aliabdullah:knex22939@finance.gk7t9we.mongodb.net/finance?retryWrites=true&w=majority&appName=Finance" --out=./backup/

# Create backup of specific collection
mongodump --uri="mongodb+srv://aliabdullah:knex22939@finance.gk7t9we.mongodb.net/finance?retryWrites=true&w=majority&appName=Finance" --collection=bookings --out=./backup/

# Create backup with compression
mongodump --uri="mongodb+srv://aliabdullah:knex22939@finance.gk7t9we.mongodb.net/finance?retryWrites=true&w=majority&appName=Finance" --gzip --out=./backup/
```

### Option 2: Export to JSON (for specific collections)

```bash
# Export bookings collection
mongoexport --uri="mongodb+srv://aliabdullah:knex22939@finance.gk7t9we.mongodb.net/finance?retryWrites=true&w=majority&appName=Finance" --collection=bookings --out=bookings.json

# Export otps collection
mongoexport --uri="mongodb+srv://aliabdullah:knex22939@finance.gk7t9we.mongodb.net/finance?retryWrites=true&w=majority&appName=Finance" --collection=otps --out=otps.json

# Export with query filter
mongoexport --uri="mongodb+srv://aliabdullah:knex22939@finance.gk7t9we.mongodb.net/finance?retryWrites=true&w=majority&appName=Finance" --collection=bookings --query='{"status":"pending"}' --out=bookings_pending.json
```

### Option 3: Enable Atlas Automated Backups

1. Go to Atlas Dashboard → Clusters
2. Select your cluster
3. Click **Edit Configuration**
4. Upgrade to **M10** or higher cluster tier (if currently on M0/M2/M5)
5. Automated backups will be enabled automatically

---

## 📋 Quick Checklist

- [ ] **Check Atlas Dashboard** for automated backups (M10+ clusters)
- [ ] **Verify cluster tier** - M10+ gets automated backups
- [ ] **Check backup files** in local directory (if any)
- [ ] **Create manual backup** using `mongodump` (if needed)
- [ ] **Test restore** to a test database first
- [ ] **Document backup schedule** for future reference

---

## ⚠️ Important Notes

1. **Free Tier (M0)**: Does NOT have automated backups
   - You need to create manual backups using `mongodump`
   - Consider upgrading to M10+ for automated backups

2. **Restore is Destructive**: 
   - Restoring to existing cluster will **OVERWRITE** existing data
   - Always test restore on a test database first
   - Consider creating a backup before restoring

3. **Backup Storage**:
   - Atlas backups consume storage quota
   - Monitor backup storage usage
   - Delete old backups if needed

4. **Point-in-Time Restore**:
   - Available for continuous backups (M30+)
   - Allows restoring to any point in time
   - More granular than snapshot restores

---

## 🛠️ Required Tools

To use `mongodump` and `mongorestore`, you need MongoDB Database Tools:

- **Windows**: Download from https://www.mongodb.com/try/download/database-tools
- **Mac**: `brew install mongodb-database-tools`
- **Linux**: Install via package manager or download from MongoDB website

---

## 📞 Next Steps

1. **Check your cluster tier** in Atlas Dashboard
2. **Verify if automated backups are enabled**
3. **If no backups exist**, create one using `mongodump`
4. **Store backup files** in a safe location (not in the repo)
5. **Set up backup schedule** (automated if M10+, manual if M0)

---

## 🔍 Current Database Summary

- **Total Collections**: 27
- **Bookings**: 41 documents (2.69 MB)
- **OTPs**: 2 documents
- **Database**: `finance`
- **Cluster**: MongoDB Atlas

**Recommendation**: Create a backup immediately using `mongodump` if automated backups are not available!


