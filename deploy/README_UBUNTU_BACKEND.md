# Janji Nikah Backend Ubuntu Deployment

Panduan ini menyiapkan backend Janji Nikah di Ubuntu VPS dengan:

- Node.js 20+
- MongoDB Community self-hosted
- Nginx reverse proxy
- HTTPS untuk `api.janjinikah.com`
- systemd service
- backup MongoDB harian

## 1. Keputusan Domain

Asumsi production:

- Frontend: `https://janjinikah.com`
- Backend/API: `https://api.janjinikah.com`
- Backend local port: `5000`

DNS yang perlu dibuat:

- `A janjinikah.com -> IP VPS/frontend hosting`
- `A www.janjinikah.com -> IP VPS/frontend hosting`
- `A api.janjinikah.com -> IP VPS backend`

Jika frontend dan backend berada di VPS yang sama, ketiganya boleh mengarah ke IP yang sama.

## 2. Update Server Dasar

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git nginx ufw ca-certificates gnupg
```

Firewall minimal:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Jangan buka port MongoDB `27017` ke internet.

## 3. Buat User Aplikasi

```bash
sudo adduser --system --group --home /var/www/janji-nikah janji
sudo usermod -aG www-data janji
sudo mkdir -p /var/www/janji-nikah/backend/releases
sudo mkdir -p /var/www/janji-nikah/uploads
sudo mkdir -p /etc/janji-nikah
sudo chown -R janji:www-data /var/www/janji-nikah
sudo chmod 750 /etc/janji-nikah
```

## 4. Install Node.js 20+

Gunakan Node.js 20 atau lebih baru. `sharp@0.35.x` membutuhkan Node `>=20.9.0`.

Contoh dengan NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 5. Install MongoDB Community

Gunakan paket resmi MongoDB, bukan paket `mongodb` bawaan Ubuntu. MongoDB 8.0 Community mendukung Ubuntu LTS 24.04 `noble`, 22.04 `jammy`, dan 20.04 `focal`.

Cek versi Ubuntu:

```bash
. /etc/os-release
echo "$VERSION_CODENAME"
```

Install MongoDB 8.0 dari apt repository resmi:

```bash
sudo apt-get install -y gnupg curl
curl -fsSL https://pgp.mongodb.com/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
. /etc/os-release
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${VERSION_CODENAME}/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

Jika `VERSION_CODENAME` bukan `noble`, `jammy`, atau `focal`, jangan lanjut sebelum cek support OS.

Setelah install:

```bash
sudo systemctl enable mongod
sudo systemctl start mongod
sudo systemctl status mongod
```

## 6. Amankan MongoDB

Pastikan `/etc/mongod.conf` hanya bind local:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
```

Buat admin database user:

```bash
mongosh
```

```js
use admin
db.createUser({
  user: "mongo_admin",
  pwd: "<strong-admin-password>",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" },
    { role: "backup", db: "admin" },
    { role: "restore", db: "admin" }
  ]
})
```

Aktifkan auth di `/etc/mongod.conf`:

```yaml
security:
  authorization: enabled
```

Restart:

```bash
sudo systemctl restart mongod
```

Buat app user:

```bash
mongosh -u mongo_admin -p --authenticationDatabase admin
```

```js
db = db.getSiblingDB("janji-nikah")
db.createUser({
  user: "janji_nikah_app",
  pwd: "<mongodb-app-password>",
  roles: [{ role: "readWrite", db: "janji-nikah" }]
})
```

Buat backup user:

```js
use admin
db.createUser({
  user: "janji_nikah_backup",
  pwd: "<mongodb-backup-password>",
  roles: [{ role: "backup", db: "admin" }]
})
```

## 7. Deploy Source Backend

Contoh manual deploy dari GitHub:

```bash
sudo -u janji git clone https://github.com/alankurniadi12/janji-nikah-backend.git /var/www/janji-nikah/backend/releases/initial
cd /var/www/janji-nikah/backend/releases/initial
sudo -u janji git switch develop
sudo -u janji npm ci --omit=dev
sudo ln -sfn /var/www/janji-nikah/backend/releases/initial /var/www/janji-nikah/backend/current
```

Untuk release berikutnya, clone/pull ke folder release baru lalu ganti symlink `current`.

## 8. Pasang Env Production

Salin template:

```bash
sudo cp deploy/backend.env.production.example /etc/janji-nikah/backend.env
sudo nano /etc/janji-nikah/backend.env
sudo chmod 640 /etc/janji-nikah/backend.env
sudo chown root:www-data /etc/janji-nikah/backend.env
```

Generate secret:

```bash
openssl rand -base64 48
```

Jangan pakai secret contoh. Jangan commit env production.

## 9. Install systemd Service

```bash
sudo cp deploy/janji-nikah-backend.service.example /etc/systemd/system/janji-nikah-backend.service
sudo systemctl daemon-reload
sudo systemctl enable janji-nikah-backend
sudo systemctl start janji-nikah-backend
sudo systemctl status janji-nikah-backend
```

Log:

```bash
journalctl -u janji-nikah-backend -f
```

## 10. Seed Database

Jalankan setelah service/env bisa connect ke MongoDB:

```bash
cd /var/www/janji-nikah/backend/current
sudo -u janji npm run seed:admin
sudo -u janji npm run seed:themes
sudo -u janji npm run seed:credit-packages
```

Pastikan `ADMIN_EMAIL` sudah benar sebelum `seed:admin`.

## 11. Nginx Reverse Proxy

Sebelum SSL, pasang config:

```bash
sudo cp deploy/nginx-api.janjinikah.com.conf.example /etc/nginx/sites-available/api.janjinikah.com
sudo ln -sfn /etc/nginx/sites-available/api.janjinikah.com /etc/nginx/sites-enabled/api.janjinikah.com
sudo nginx -t
```

Untuk SSL, pakai Certbot atau SSL provider hosting:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.janjinikah.com
sudo nginx -t
sudo systemctl reload nginx
```

## 12. Backup MongoDB Harian

Pasang script:

```bash
sudo mkdir -p /opt/janji-nikah
sudo cp deploy/mongodb-backup.sh.example /opt/janji-nikah/mongodb-backup.sh
sudo nano /opt/janji-nikah/mongodb-backup.sh
sudo chmod 750 /opt/janji-nikah/mongodb-backup.sh
sudo mkdir -p /var/backups/janji-nikah/mongodb
sudo chown -R root:root /var/backups/janji-nikah
```

Test backup:

```bash
sudo /opt/janji-nikah/mongodb-backup.sh
ls -lah /var/backups/janji-nikah/mongodb
```

Cron harian jam 02:30:

```bash
sudo crontab -e
```

```cron
30 2 * * * /opt/janji-nikah/mongodb-backup.sh >> /var/log/janji-nikah-mongodb-backup.log 2>&1
```

Uji restore di database test sebelum launch:

```bash
mongorestore --uri="mongodb://mongo_admin:<password>@127.0.0.1:27017/janji-nikah-restore-test?authSource=admin" --archive=/var/backups/janji-nikah/mongodb/<backup-file>.archive.gz --gzip --nsFrom="janji-nikah.*" --nsTo="janji-nikah-restore-test.*"
```

## 13. Smoke Test Backend

Local di VPS:

```bash
curl -i http://127.0.0.1:5000/api/health
```

Public:

```bash
curl -i https://api.janjinikah.com/api/health
```

Expected:

```json
{"success":true,"data":{"service":"janji-nikah-backend","status":"ok","database":"connected"}}
```

## 14. Production Blockers

Jangan launch jika:

- `api.janjinikah.com` belum HTTPS.
- MongoDB belum auth.
- MongoDB masih bind ke `0.0.0.0`.
- Backup belum berhasil dibuat dan dicek.
- `/etc/janji-nikah/backend.env` masih berisi placeholder.
- `ADMIN_EMAIL` belum benar.
- Google OAuth callback production belum diset.
- `npm audit`, `npm run check`, atau `npm test` gagal.

## 15. Catatan Hardening Berikutnya

Saat ini backend serve `/uploads` secara public. Ini cocok untuk foto undangan dan musik, tetapi bukti transfer di folder `transactions/.../proofs` sebaiknya dilayani lewat endpoint authenticated sebelum production besar. Untuk launch awal, risikonya tertahan oleh nama file random UUID, tetapi tetap lebih baik di-hardening.

## Referensi

- MongoDB official Ubuntu apt install docs: `https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-ubuntu/`
