# Deploy Reward to Alibaba Cloud

This project can be deployed as a static React site served by Nginx with a local FastAPI service behind it.

## One-command deploy

On a fresh Ubuntu/Debian Alibaba Cloud server:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/sakeyez/reward.git /opt/reward
cd /opt/reward
chmod +x deploy/deploy.sh
SERVER_NAME=your-domain-or-public-ip ./deploy/deploy.sh
```

If you do not have a domain yet, use your public IP as `SERVER_NAME`.

## Useful commands

Check API service:

```bash
sudo systemctl status reward-api
```

View logs:

```bash
sudo journalctl -u reward-api -f
```

Redeploy after pushing new code:

```bash
cd /opt/reward
SERVER_NAME=your-domain-or-public-ip ./deploy/deploy.sh
```

## Production files

- App directory: `/opt/reward`
- Environment file: `/opt/reward/.env`
- Frontend build: `/opt/reward/frontend/dist`
- API service: `reward-api`
- Nginx site: `/etc/nginx/sites-available/reward`
