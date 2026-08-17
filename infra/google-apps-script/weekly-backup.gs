const SOURCE_SPREADSHEET_ID = 'CHANGE_ME';
const BACKUP_FOLDER_ID = 'CHANGE_ME';
const RETENTION = 8;

function weeklyBackup() {
  const source = DriveApp.getFileById(SOURCE_SPREADSHEET_ID);
  const folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd-HHmm');
  source.makeCopy(`JAD HOME Catalogue backup ${stamp}`, folder);
  const files = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (file.getName().startsWith('JAD HOME Catalogue backup ')) files.push(file);
  }
  files.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
  files.slice(RETENTION).forEach((file) => file.setTrashed(true));
  console.log(`Backup complete. Kept ${Math.min(files.length, RETENTION)} copies.`);
}
