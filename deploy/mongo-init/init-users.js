const appPassword = process.env.JANJI_NIKAH_APP_PASSWORD;
const backupPassword = process.env.JANJI_NIKAH_BACKUP_PASSWORD;

if (!appPassword || !backupPassword) {
  throw new Error("JANJI_NIKAH_APP_PASSWORD and JANJI_NIKAH_BACKUP_PASSWORD are required.");
}

db = db.getSiblingDB("janji-nikah");
db.createUser({
  user: "janji_nikah_app",
  pwd: appPassword,
  roles: [{ role: "readWrite", db: "janji-nikah" }]
});

db = db.getSiblingDB("admin");
db.createUser({
  user: "janji_nikah_backup",
  pwd: backupPassword,
  roles: [{ role: "backup", db: "admin" }]
});
