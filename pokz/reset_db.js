const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.run('DELETE FROM users', (err) => {
    if (err) {
        console.error('Ошибка при удалении пользователей:', err.message);
    } else {
        console.log('Все пользователи удалены.');
    }
    db.close();
});
