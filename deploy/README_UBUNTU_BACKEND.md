# Janji Nikah Backend Ubuntu Deployment

Panduan ini menyiapkan backend Janji Nikah di Ubuntu VPS dengan jalur utama Docker Compose.

- Docker + Docker Compose
- Backend Node.js di container
- MongoDB Community di container
- Nginx host reverse proxy
- HTTPS untuk `api.janjinikah.com`
- backup MongoDB harian

## 1. Keputusan Domain

Asumsi production:

- Frontend: `https://janjinikah.com`
- Backend/API: `https://api.janjinikah.com`
- Backend container exposed ke host: `127.0.0.1:5010`

Port `5000` sengaja tidak dipakai karena sudah digunakan Sadar Uang via PM2.

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
sudo chown -R 1000:www-data /var/www/janji-nikah/uploads
sudo chmod -R 775 /var/www/janji-nikah/uploads
sudo chmod 750 /etc/janji-nikah
```

Folder uploads diberi owner UID `1000` karena container backend memakai user `node` dari image resmi Node.

## 4. Install Docker

Jika Docker sudah terpasang, cukup cek:

```bash
docker --version
docker compose version
sudo systemctl status docker --no-pager
```

Opsional agar user `ubuntu` bisa menjalankan Docker tanpa `sudo`:

```bash
sudo usermod -aG docker ubuntu
```

Logout SSH lalu login lagi agar group baru aktif.

## 5. Cek Port Existing

Sebelum Janji Nikah dijalankan, pastikan port `5010` kosong:

```bash
sudo ss -tulpn | grep ':5010' || echo "port 5010 kosong"
```

Expected:

```text
port 5010 kosong
```

## 6. MongoDB Strategy

MongoDB Janji Nikah dijalankan di container `mongo:8.0`, bukan di host. Data database disimpan di Docker named volume `janji_nikah_mongo_data`.

Jangan expose port MongoDB ke host/public internet. Compose production tidak mempublish port `27017`.

## 7. Deploy Source Backend

Contoh manual deploy dari GitHub:

```bash
sudo -u janji git clone https://github.com/alankurniadi12/janji-nikah-backend.git /var/www/janji-nikah/backend/releases/initial
cd /var/www/janji-nikah/backend/releases/initial
sudo -u janji git switch develop
sudo ln -sfn /var/www/janji-nikah/backend/releases/initial /var/www/janji-nikah/backend/current
```

Untuk release berikutnya, clone/pull ke folder release baru lalu ganti symlink `current`.

## 8. Pasang Env Production Docker

Salin template:

```bash
sudo cp /var/www/janji-nikah/backend/current/deploy/backend.env.docker.example /etc/janji-nikah/backend.env
sudo cp /var/www/janji-nikah/backend/current/deploy/mongo.env.docker.example /etc/janji-nikah/mongo.env
sudo nano /etc/janji-nikah/backend.env
sudo nano /etc/janji-nikah/mongo.env
sudo chmod 640 /etc/janji-nikah/backend.env /etc/janji-nikah/mongo.env
sudo chown root:www-data /etc/janji-nikah/backend.env /etc/janji-nikah/mongo.env
```

Generate secret:

```bash
openssl rand -base64 48
```

Jangan pakai secret contoh. Jangan commit env production.

Important:

- `backend.env` harus memakai `PORT=5010`.
- `MONGODB_URI` harus memakai host internal Compose `mongo`, bukan `127.0.0.1`.
- Password app MongoDB di `backend.env` harus sama dengan `JANJI_NIKAH_APP_PASSWORD` di `mongo.env`.
- Password backup MongoDB di script backup harus sama dengan `JANJI_NIKAH_BACKUP_PASSWORD`.

## 9. Siapkan Compose Production

Salin compose example ke file aktif:

```bash
cd /var/www/janji-nikah/backend/current
sudo -u janji cp deploy/docker-compose.prod.yml.example deploy/docker-compose.prod.yml
```

File `deploy/docker-compose.prod.yml` jangan diubah kecuali perlu ganti port/nama container.

Build dan start:

```bash
cd /var/www/janji-nikah/backend/current/deploy
sudo docker compose -f docker-compose.prod.yml up -d --build
sudo docker compose -f docker-compose.prod.yml ps
```

Lihat log:

```bash
sudo docker compose -f docker-compose.prod.yml logs -f backend
sudo docker compose -f docker-compose.prod.yml logs -f mongo
```

## 10. Seed Database

Jalankan setelah backend dan MongoDB container sehat:

```bash
cd /var/www/janji-nikah/backend/current/deploy
sudo docker compose -f docker-compose.prod.yml exec backend npm run seed:admin
sudo docker compose -f docker-compose.prod.yml exec backend npm run seed:themes
sudo docker compose -f docker-compose.prod.yml exec backend npm run seed:credit-packages
```

Pastikan `ADMIN_EMAIL` sudah benar sebelum `seed:admin`.

## 11. Smoke Test Backend Local

Local di VPS:

```bash
curl -i http://127.0.0.1:5010/api/health
```

Expected:

```js
{"success":true,"data":{"service":"janji-nikah-backend","status":"ok","database":"connected"}}
```

## 12. Nginx Reverse Proxy

Sebelum SSL, pasang config:

```bash
sudo cp deploy/nginx-api.janjinikah.com.conf.example /etc/nginx/sites-available/api.janjinikah.com
sudo ln -sfn /etc/nginx/sites-available/api.janjinikah.com /etc/nginx/sites-enabled/api.janjinikah.com
sudo nginx -t
```

Pastikan `proxy_pass` mengarah ke port `5010`:

```nginx
proxy_pass http://127.0.0.1:5010;
```

Untuk SSL, pakai Certbot atau SSL provider hosting:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.janjinikah.com
sudo nginx -t
sudo systemctl reload nginx
```

## 13. Backup MongoDB Harian

Pasang script:

```bash
sudo mkdir -p /opt/janji-nikah
sudo cp /var/www/janji-nikah/backend/current/deploy/mongodb-backup-docker.sh.example /opt/janji-nikah/mongodb-backup.sh
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
cat /var/backups/janji-nikah/mongodb/<backup-file>.archive.gz | sudo docker compose -f /var/www/janji-nikah/backend/current/deploy/docker-compose.prod.yml exec -T mongo mongorestore --username="mongo_admin" --password="<mongodb-root-password>" --authenticationDatabase="admin" --archive --gzip --nsFrom="janji-nikah.*" --nsTo="janji-nikah-restore-test.*"
```

## 14. Smoke Test Backend Public

Public:

```bash
curl -i https://api.janjinikah.com/api/health
```

Expected:

```json
{"success":true,"data":{"service":"janji-nikah-backend","status":"ok","database":"connected"}}
```

## 15. Production Blockers

Jangan launch jika:

- `api.janjinikah.com` belum HTTPS.
- `docker compose ps` belum healthy.
- MongoDB port `27017` terpublish ke public.
- Backup belum berhasil dibuat dan dicek.
- `/etc/janji-nikah/backend.env` masih berisi placeholder.
- `/etc/janji-nikah/mongo.env` masih berisi placeholder.
- `ADMIN_EMAIL` belum benar.
- Google OAuth callback production belum diset.
- `npm audit`, `npm run check`, atau `npm test` gagal.

## 16. Catatan Hardening Berikutnya

Saat ini backend serve `/uploads` secara public. Ini cocok untuk foto undangan dan musik, tetapi bukti transfer di folder `transactions/.../proofs` sebaiknya dilayani lewat endpoint authenticated sebelum production besar. Untuk launch awal, risikonya tertahan oleh nama file random UUID, tetapi tetap lebih baik di-hardening.

## Referensi

- MongoDB official Ubuntu apt install docs: `https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-ubuntu/`
