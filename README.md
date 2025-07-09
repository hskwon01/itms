# ITMS 게시판 시스템

webMethods Integration Server를 중심으로 한 webMethods 제품 전문가 집단(BI팀)을 위한 ITMS(IT Management System) 게시판입니다.

## 주요 기능

### 1. 사용자 관리
- **Super Admin**: BI팀 관리자, Engineer 배정, 티켓 승인
- **Engineer**: BI 팀원, 티켓 처리 및 상태 관리
- **User Master**: 고객사 대표, 티켓 승인 및 사용자 관리
- **User**: 고객사 시스템 운영 담당자, 프로젝트 및 티켓 생성

### 2. 프로젝트 관리
- 프로젝트 생성, 조회, 수정, 삭제
- 프로젝트별 티켓 관리
- 프로젝트 코드 자동 생성

### 3. 티켓 관리
- 티켓 생성 및 자동 번호 생성 (BITM-{Project}-{Sequence})
- 티켓 상태 관리 (New → Assigned → In Progress → On Hold → Validation → Complete → Closed)
- Engineer 배정 및 승인 시스템
- 이슈 타입 및 심각도 관리

### 4. 댓글 시스템
- 티켓별 댓글 작성, 조회, 수정, 삭제
- 첨부파일 지원

### 5. 제품정보 관리
- 제품명, 버전, 라이선스, EOS 정보 관리
- 모니터링 솔루션 정보

### 6. 대시보드
- 역할별 맞춤 대시보드
- 통계 정보 및 요약 데이터
- 임박한 티켓 알림

## 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Authentication**: JWT (JSON Web Token)
- **Password Hashing**: bcrypt

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
`.env` 파일을 생성하고 다음 내용을 추가하세요:
```
DATABASE_URL=postgres://username:password@localhost:5432/itmsdb
JWT_SECRET=your_jwt_secret_key
MAIL_USER=your_gmail@gmail.com
MAIL_PASS=your_gmail_app_password
```

### 3. 데이터베이스 설정
PostgreSQL에서 다음 테이블들을 생성하세요:

```sql
-- Users 테이블
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    level INT NOT NULL DEFAULT 1,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token VARCHAR(255),
    user_master_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects 테이블
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    code VARCHAR(20) UNIQUE NOT NULL,
    owner_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tickets 테이블
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    project_id INT NOT NULL,
    creator_id INT NOT NULL,
    assigned_engineer_id INT,
    title VARCHAR(200) NOT NULL,
    issue_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    product_name VARCHAR(100),
    product_version VARCHAR(50),
    os_info VARCHAR(100),
    fix_level VARCHAR(50),
    status VARCHAR(20) DEFAULT 'new',
    created_date DATE DEFAULT CURRENT_DATE,
    requested_end_date DATE,
    actual_end_date DATE,
    is_approved_by_user_master BOOLEAN DEFAULT FALSE,
    is_approved_by_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_engineer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Comments 테이블
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL,
    author_id INT NOT NULL,
    content TEXT NOT NULL,
    attachment_path VARCHAR(255),
    attachment_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Product Info 테이블
CREATE TABLE product_info (
    id SERIAL PRIMARY KEY,
    user_master_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    version VARCHAR(50),
    license_info TEXT,
    eos_date DATE,
    monitoring_solution BOOLEAN DEFAULT FALSE,
    patch_history TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_master_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 4. 서버 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/verify` - 이메일 인증

### 프로젝트
- `GET /api/projects/my` - 내 프로젝트 목록
- `GET /api/projects` - 모든 프로젝트 (Super Admin, Engineer)
- `GET /api/projects/:id` - 특정 프로젝트 조회
- `POST /api/projects` - 프로젝트 생성
- `PUT /api/projects/:id` - 프로젝트 수정
- `DELETE /api/projects/:id` - 프로젝트 삭제

### 티켓
- `GET /api/tickets/my` - 내 티켓 목록
- `GET /api/tickets` - 모든 티켓 (Super Admin, Engineer)
- `GET /api/tickets/:id` - 특정 티켓 조회
- `POST /api/tickets` - 티켓 생성
- `PUT /api/tickets/:id/status` - 티켓 상태 변경
- `PUT /api/tickets/:id/assign` - Engineer 배정
- `PUT /api/tickets/:id/approve` - 티켓 승인

### 댓글
- `GET /api/comments/ticket/:ticketId` - 티켓 댓글 목록
- `POST /api/comments` - 댓글 작성
- `PUT /api/comments/:id` - 댓글 수정
- `DELETE /api/comments/:id` - 댓글 삭제

### 제품정보
- `GET /api/productinfo/my` - 내 제품정보 (User Master)
- `GET /api/productinfo/user-master/:userMasterId` - User Master 제품정보
- `GET /api/productinfo` - 모든 제품정보 (Super Admin, Engineer)
- `POST /api/productinfo` - 제품정보 생성
- `PUT /api/productinfo/:id` - 제품정보 수정
- `DELETE /api/productinfo/:id` - 제품정보 삭제

### 대시보드
- `GET /api/dashboard` - 대시보드 메인 데이터
- `GET /api/dashboard/upcoming-tickets` - 임박한 티켓
- `GET /api/dashboard/monthly-stats` - 월간 통계

## 사용법

1. **회원가입**: 웹 페이지에서 회원가입을 진행합니다.
2. **이메일 인증**: 가입 후 이메일 인증을 완료합니다.
3. **로그인**: 인증 완료 후 로그인합니다.
4. **프로젝트 생성**: User 역할로 프로젝트를 생성합니다.
5. **티켓 생성**: 프로젝트 하위에 티켓을 생성합니다.
6. **티켓 처리**: Engineer가 배정되어 티켓을 처리합니다.

## 권한 체계

- **Super Admin**: 모든 기능 접근 가능
- **Engineer**: 티켓 처리, 프로젝트 조회
- **User Master**: 소속 User 관리, 제품정보 관리
- **User**: 프로젝트 생성, 티켓 생성

## 개발 참고사항

- 모든 API는 JWT 토큰 인증이 필요합니다 (인증 관련 제외)
- 비밀번호는 bcrypt로 해시화되어 저장됩니다
- 티켓 번호는 자동으로 생성됩니다 (BITM-{Project}-{Sequence})
- 파일 업로드 기능은 추후 구현 예정입니다

## 라이선스

ISC License 