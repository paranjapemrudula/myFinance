# Azure VM deployment guide for my_finance

This project is a React frontend (`frontend`) plus Django backend (`backend`).

## 1. Recommended Azure setup

- OS: Ubuntu Server 22.04 LTS or 24.04 LTS
- VM size: start with the smallest burstable size you can tolerate for testing
- Inbound ports: open `22` for SSH and `80` for HTTP
- Keep `443` for later when you add HTTPS

For a free-trial account, Azure currently gives a `$200 credit for 30 days`, and services stop when that credit expires unless you upgrade. Check cost regularly in Azure Cost Management.

## 2. Connect from Windows

If your VM public IP is `X.X.X.X` and your username is `azureuser`:

```powershell
ssh -i "C:\path\to\my-virtual-machine-key.pem" azureuser@X.X.X.X
```

If SSH fails on Windows because of permissions, run:

```powershell
icacls "C:\path\to\my-virtual-machine-key.pem" /inheritance:r
icacls "C:\path\to\my-virtual-machine-key.pem" /grant:r "%USERNAME%:R"
```

## 3. Prepare the server

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx nodejs npm git
cd ~
git clone YOUR_GITHUB_REPO_URL myFinance
cd ~/myFinance
```

## 4. Backend setup

```bash
cd ~/myFinance
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
nano backend/.env
```

Set these values in `backend/.env`:

- `DJANGO_SECRET_KEY`: generate a new secret
- `DJANGO_DEBUG=False`
- `DJANGO_ALLOWED_HOSTS`: your VM public IP and later your domain
- `DJANGO_CORS_ALLOWED_ORIGINS`: frontend URL
- `DJANGO_CSRF_TRUSTED_ORIGINS`: frontend URL
- `DJANGO_DB_NAME=/home/azureuser/myFinance/backend/db.sqlite3`

Then run:

```bash
cd ~/myFinance/backend
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py collectstatic --noinput
../.venv/bin/python manage.py createsuperuser
```

## 5. Frontend setup

```bash
cd ~/myFinance/frontend
cp .env.production.example .env.production
nano .env.production
```

Set:

```env
VITE_API_BASE_URL=http://YOUR_VM_PUBLIC_IP
```

Build it:

```bash
npm install
npm run build
```

## 6. Gunicorn service

```bash
sudo cp ~/myFinance/deploy/gunicorn/my_finance.service /etc/systemd/system/
sudo nano /etc/systemd/system/my_finance.service
```

Change `User` if your VM username is not `azureuser`.

Start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable my_finance
sudo systemctl start my_finance
sudo systemctl status my_finance
```

## 7. Nginx setup

```bash
sudo cp ~/myFinance/deploy/nginx/my_finance.conf /etc/nginx/sites-available/my_finance
sudo nano /etc/nginx/sites-available/my_finance
```

Replace the `server_name` if your public IP changes or if you later add a domain.

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/my_finance /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 7.5 Deployment script

The repo includes a `deploy.sh` script for repeat deployments.

On the VM:

```bash
cd ~/myFinance
chmod +x deploy.sh
./deploy.sh
```

What it does:

- creates `.venv` if missing
- installs backend requirements
- runs migrations
- collects static files
- installs frontend packages
- builds the frontend
- restarts `my_finance`
- reloads `nginx`

## 8. Azure networking checks

In Azure Portal:

- VM -> Networking -> Inbound port rules
- Allow `22` from your IP
- Allow `80` from anywhere
- Keep `8000` closed because Gunicorn should stay private behind Nginx

## 9. Verify deployment

Open:

- `http://YOUR_VM_PUBLIC_IP`
- `http://YOUR_VM_PUBLIC_IP/api/health/`

Check services:

```bash
sudo systemctl status my_finance
sudo systemctl status nginx
journalctl -u my_finance -n 100 --no-pager
```

## 9.5 Future updates

After you change code locally:

1. Commit and push from your Windows machine.
2. SSH into the VM.
3. Run:

```bash
cd ~/myFinance
git pull origin main
./deploy.sh
```

## 10. Strongly recommended next step

After HTTP works, add a domain plus HTTPS with Let's Encrypt:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Do not add HTTPS before basic HTTP deployment is working.
