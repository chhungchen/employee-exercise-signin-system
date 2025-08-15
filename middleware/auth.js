const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../database/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 驗證JWT Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '需要提供認證Token' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token無效或已過期' });
        }
        req.user = user;
        next();
    });
};

// 管理員登入驗證
const authenticateAdmin = async (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '請提供帳號和密碼' });
    }

    try {
        const admin = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM admins WHERE username = ?',
                [username],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!admin) {
            return res.status(401).json({ error: '帳號或密碼錯誤' });
        }

        const isValidPassword = await bcrypt.compare(password, admin.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: '帳號或密碼錯誤' });
        }

        // 生成JWT Token
        const token = jwt.sign(
            { id: admin.id, username: admin.username, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: '登入成功',
            token,
            user: {
                id: admin.id,
                username: admin.username,
                role: 'admin'
            }
        });
    } catch (error) {
        console.error('登入錯誤:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};

module.exports = {
    authenticateToken,
    authenticateAdmin,
    JWT_SECRET
}; 