const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middlewares/auth');

// 업로드 디렉토리 생성
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 파일명 중복 방지를 위해 타임스탬프 추가
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // 허용할 파일 타입
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('지원하지 않는 파일 형식입니다.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  }
});

// 단일 파일 업로드
router.post('/single', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '업로드할 파일이 없습니다.' });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`,
      uploaded_by: req.user.id,
      uploaded_at: new Date()
    };

    res.json({
      message: '파일이 성공적으로 업로드되었습니다.',
      file: fileInfo
    });
  } catch (err) {
    console.error('파일 업로드 오류:', err);
    res.status(500).json({ error: '파일 업로드에 실패했습니다.' });
  }
});

// 다중 파일 업로드
router.post('/multiple', auth, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '업로드할 파일이 없습니다.' });
    }

    const filesInfo = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: `/uploads/${file.filename}`,
      uploaded_by: req.user.id,
      uploaded_at: new Date()
    }));

    res.json({
      message: `${filesInfo.length}개의 파일이 성공적으로 업로드되었습니다.`,
      files: filesInfo
    });
  } catch (err) {
    console.error('파일 업로드 오류:', err);
    res.status(500).json({ error: '파일 업로드에 실패했습니다.' });
  }
});

// 파일 다운로드
router.get('/download/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    // 파일 스트림으로 전송
    res.download(filePath);
  } catch (err) {
    console.error('파일 다운로드 오류:', err);
    res.status(500).json({ error: '파일 다운로드에 실패했습니다.' });
  }
});

// 파일 삭제
router.delete('/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    // 파일 삭제
    fs.unlinkSync(filePath);

    res.json({
      message: '파일이 성공적으로 삭제되었습니다.'
    });
  } catch (err) {
    console.error('파일 삭제 오류:', err);
    res.status(500).json({ error: '파일 삭제에 실패했습니다.' });
  }
});

// 업로드된 파일 목록 조회
router.get('/list', auth, async (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    const fileList = files.map(filename => {
      const filePath = path.join(uploadDir, filename);
      const stats = fs.statSync(filePath);
      
      return {
        filename: filename,
        size: stats.size,
        created_at: stats.birthtime,
        modified_at: stats.mtime
      };
    });

    res.json({
      files: fileList
    });
  } catch (err) {
    console.error('파일 목록 조회 오류:', err);
    res.status(500).json({ error: '파일 목록 조회에 실패했습니다.' });
  }
});

// 에러 핸들링 미들웨어
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '파일 크기가 너무 큽니다. (최대 10MB)' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: '업로드할 수 있는 파일 수를 초과했습니다.' });
    }
  }
  
  console.error('업로드 에러:', error);
  res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
});

module.exports = router; 