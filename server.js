require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));


// 라우터 연결
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/productinfo', require('./routes/productinfo'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/statistics', require('./routes/statistics'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/notifications', require('./routes/notifications'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));