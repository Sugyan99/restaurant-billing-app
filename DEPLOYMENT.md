# 🚀 Production Deployment Guide
## Oracle Cloud Free Tier VM — 24/7 Hosting

---

## PART 1: Setup Oracle VM (one-time)

### Step 1: SSH into your VM
```bash
# From your Windows terminal or Termux:
ssh ubuntu@YOUR_VM_IP
# Or via Tailscale (which you already have set up):
ssh ubuntu@your-tailscale-hostname
```

### Step 2: Install required software on VM
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install PM2 (keeps app running 24/7)
sudo npm install -g pm2

# Install Nginx (reverse proxy + SSL)
sudo apt install -y nginx

# Verify everything installed:
node -v    # should say v20.x.x
npm -v
psql --version
pm2 --version
nginx -v
```

---

## PART 2: Setup PostgreSQL Database

```bash
# Switch to postgres user
sudo -i -u postgres

# Create database and user for your client
psql
```

Inside psql, run these commands:
```sql
-- Create database (one per restaurant client)
CREATE DATABASE restaurant_odisha;

-- Create a secure user
CREATE USER restobill_user WITH PASSWORD 'choose-a-strong-password-here';

-- Give permissions
GRANT ALL PRIVILEGES ON DATABASE restaurant_odisha TO restobill_user;

-- Exit psql
\q
```

```bash
# Exit postgres user
exit
```

---

## PART 3: Clone and Configure the App

```bash
# Go to your home directory
cd ~

# Clone your repo (use your GitHub token if private)
git clone https://YOUR_GITHUB_TOKEN@github.com/Sugyan99/restaurant-billing-app.git
cd restaurant-billing-app

# Install dependencies
npm install

# Create your .env file
nano .env
```

Paste this into the .env file (edit the values):
```
DATABASE_URL="postgresql://restobill_user:your-password@localhost:5432/restaurant_odisha"
JWT_SECRET="paste-a-very-long-random-string-here-minimum-40-characters"
GROQ_API_KEY="your-groq-api-key-from-console.groq.com"
NODE_ENV="production"
NEXTAUTH_URL="https://yourdomain.com"
```

Save with Ctrl+X, then Y, then Enter.

```bash
# Setup database tables
npx prisma generate
npx prisma db push

# Build the Next.js app for production
npm run build
```

---

## PART 4: Start App with PM2

```bash
# Start the app (PM2 keeps it running even if VM restarts)
pm2 start npm --name "restobill" -- start

# Save PM2 config so it restarts on VM reboot
pm2 save
pm2 startup

# Copy-paste the command it gives you (starts with sudo)
# It looks like: sudo env PATH=... pm2 startup...

# Check app is running:
pm2 status
pm2 logs restobill   # View live logs
```

App is now running on http://localhost:3000 inside the VM.

---

## PART 5: Setup Nginx + Free SSL

```bash
# Create Nginx config for your domain
sudo nano /etc/nginx/sites-available/restobill
```

Paste this (replace yourdomain.com with your actual domain):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the config
sudo ln -s /etc/nginx/sites-available/restobill /etc/nginx/sites-enabled/
sudo nginx -t          # Test config (should say OK)
sudo systemctl restart nginx

# Get free SSL from Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com

# Auto-renew SSL (runs twice a day, renews when near expiry)
sudo crontab -e
# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

Your app is now live at **https://yourdomain.com** 🎉

---

## PART 6: First Login Setup

Open your app URL in browser, then register the first Owner account:

```bash
# On your local machine, run this command to create the first Owner:
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Restaurant Owner","email":"owner@email.com","password":"yourpassword"}'
```

After that, login normally through the web interface.

---

## PART 7: Daily Operations (Future Updates)

When you add new features and want to deploy:
```bash
# On your VM:
cd ~/restaurant-billing-app
git pull                    # Get latest code from GitHub
npm install                 # Install any new packages
npm run build               # Rebuild
pm2 restart restobill       # Restart app
```

---

## PART 8: Adding a Second Client (New Restaurant)

For each new client, do this on the VM:
```bash
# 1. Create new database for them
sudo -i -u postgres
psql
CREATE DATABASE restaurant_CLIENT2_NAME;
GRANT ALL PRIVILEGES ON DATABASE restaurant_CLIENT2_NAME TO restobill_user;
\q
exit

# 2. Copy app to new folder
cp -r ~/restaurant-billing-app ~/restaurant-billing-CLIENT2

# 3. Create new .env with different database
cd ~/restaurant-billing-CLIENT2
nano .env
# Change DATABASE_URL to point to restaurant_CLIENT2_NAME

# 4. Push schema to new DB
npx prisma db push

# 5. Start on different port
PORT=3001 pm2 start npm --name "restobill-client2" -- start

# 6. Add new Nginx block for their domain
# (Same as Part 5, different server_name and proxy port 3001)
```

---

## Uptime Monitoring (Free)

1. Go to https://uptimerobot.com
2. Create free account
3. Add monitor: HTTP(S) → your domain URL
4. Add your WhatsApp/email for alerts
5. You'll get pinged instantly if the site goes down

---

## Backup (Important!)

```bash
# Add this to crontab for daily 2 AM DB backup:
crontab -e

# Add these lines:
0 2 * * * pg_dump -U restobill_user restaurant_odisha > ~/backups/db_$(date +\%Y\%m\%d).sql
# Keep only last 7 days:
0 3 * * * find ~/backups -name "*.sql" -mtime +7 -delete
```

Create the backups folder first: `mkdir ~/backups`
