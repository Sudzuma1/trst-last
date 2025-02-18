const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Ошибка при подключении к БД:', err.message);
    } else {
        console.log('Подключено к SQLite.');
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS ads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            text TEXT,
            premium INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS promo_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            used_by INTEGER DEFAULT NULL
        )`);
    }
});

// Генерация промокодов
app.get('/generate-promo', (req, res) => {
    let codes = [];
    for (let i = 0; i < 10; i++) {
        let code = Math.random().toString(36).substring(2, 10).toUpperCase();
        codes.push(code);
        db.run('INSERT INTO promo_codes (code) VALUES (?)', [code], (err) => {
            if (err) console.error('Ошибка при добавлении промокода:', err.message);
        });
    }
    res.json({ codes });
});

// Регистрация пользователя
app.post('/register', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email обязателен' });

    db.run('INSERT INTO users (email) VALUES (?)', [email], function (err) {
        if (err) {
            console.error('Ошибка при регистрации:', err.message);
            return res.status(400).json({ error: 'Email уже используется' });
        }
        res.json({ user_id: this.lastID });
    });
});

// Добавление объявления с промокодом
app.post('/add-ad', (req, res) => {
    const { user_id, text, promo_code } = req.body;
    if (!user_id || !text) return res.status(400).json({ error: 'Все поля обязательны' });

    db.get('SELECT COUNT(*) as count FROM ads WHERE user_id = ?', [user_id], (err, row) => {
        if (err) {
            console.error('Ошибка при проверке объявлений:', err.message);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        if (row.count > 0) return res.status(400).json({ error: 'Можно добавить только одно объявление' });

        let isPremium = 0;
        if (promo_code) {
            db.get('SELECT * FROM promo_codes WHERE code = ? AND used_by IS NULL', [promo_code], (err, promo) => {
                if (err) {
                    console.error('Ошибка при проверке промокода:', err.message);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }
                if (promo) {
                    isPremium = 1;
                    db.run('UPDATE promo_codes SET used_by = ? WHERE id = ?', [user_id, promo.id], (err) => {
                        if (err) console.error('Ошибка при обновлении промокода:', err.message);
                    });
                }
                db.run('INSERT INTO ads (user_id, text, premium) VALUES (?, ?, ?)', [user_id, text, isPremium], function (err) {
                    if (err) {
                        console.error('Ошибка при добавлении объявления:', err.message);
                        return res.status(500).json({ error: 'Ошибка при добавлении' });
                    }
                    res.json({ ad_id: this.lastID, premium: isPremium });
                });
            });
        } else {
            db.run('INSERT INTO ads (user_id, text, premium) VALUES (?, ?, ?)', [user_id, text, isPremium], function (err) {
                if (err) {
                    console.error('Ошибка при добавлении объявления:', err.message);
                    return res.status(500).json({ error: 'Ошибка при добавлении' });
                }
                res.json({ ad_id: this.lastID, premium: isPremium });
            });
        }
    });
});

// Получение списка объявлений
app.get('/ads', (req, res) => {
    db.all('SELECT * FROM ads ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            console.error('Ошибка при получении объявлений:', err.message);
            return res.status(500).json({ error: 'Ошибка при получении объявлений' });
        }
        res.json(rows);
    });
});
// Удаление объявления
app.delete('/delete-ad/:id', (req, res) => {
    const adId = req.params.id;

    db.run('DELETE FROM ads WHERE id = ?', [adId], function (err) {
        if (err) {
            console.error('Ошибка при удалении объявления:', err.message);
            return res.status(500).json({ error: 'Ошибка при удалении' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Объявление не найдено' });
        }
        res.json({ success: true });
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
