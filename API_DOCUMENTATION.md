# ITMS API 문서

## 기본 정보
- **Base URL**: `http://localhost:3000/api`
- **인증**: JWT 토큰 (Authorization 헤더에 `Bearer {token}` 형식으로 전송)
- **Content-Type**: `application/json`

## 인증 (Authentication)

### 회원가입
```
POST /auth/register
```
**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "email": "string",
  "role": "user|engineer|user_master|super_admin",
  "level": 1-3
}
```

### 로그인
```
POST /auth/login
```
**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

### 이메일 인증
```
GET /auth/verify?token={verification_token}
```

## 사용자 관리 (Users)

### 모든 사용자 조회 (Super Admin만)
```
GET /users
```

### 특정 사용자 조회
```
GET /users/{id}
```

### 내 정보 조회
```
GET /users/me/profile
```

### 내 정보 수정
```
PUT /users/me/profile
```
**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "company": "string"
}
```

### 비밀번호 변경
```
PUT /users/me/password
```
**Request Body:**
```json
{
  "current_password": "string",
  "new_password": "string"
}
```

### 사용자 수정 (Super Admin만)
```
PUT /users/{id}
```
**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "role": "string",
  "level": "number",
  "company": "string",
  "user_master_id": "number"
}
```

### 사용자 삭제 (Super Admin만)
```
DELETE /users/{id}
```

### Engineer 목록 조회 (Super Admin만)
```
GET /users/engineers/list
```

### User Master별 소속 User 목록 조회
```
GET /users/user-master/{userMasterId}/users
```

## 프로젝트 관리 (Projects)

### 내 프로젝트 목록 조회
```
GET /projects/my
```

### 모든 프로젝트 조회 (Super Admin, Engineer만)
```
GET /projects
```

### 특정 프로젝트 조회
```
GET /projects/{id}
```

### 프로젝트 생성
```
POST /projects
```
**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "code": "string"
}
```

### 프로젝트 수정
```
PUT /projects/{id}
```
**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "status": "active|completed|on_hold"
}
```

### 프로젝트 삭제
```
DELETE /projects/{id}
```

## 티켓 관리 (Tickets)

### 내 티켓 목록 조회
```
GET /tickets/my
```

### 모든 티켓 조회 (Super Admin, Engineer만)
```
GET /tickets
```

### 특정 티켓 조회
```
GET /tickets/{id}
```

### 티켓 생성
```
POST /tickets
```
**Request Body:**
```json
{
  "project_id": "number",
  "title": "string",
  "issue_type": "string",
  "severity": "critical|high|medium|low",
  "description": "string",
  "product_name": "string",
  "product_version": "string",
  "os_info": "string",
  "fix_level": "string",
  "requested_end_date": "YYYY-MM-DD"
}
```

### 티켓 상태 변경
```
PUT /tickets/{id}/status
```
**Request Body:**
```json
{
  "status": "new|assigned|in_progress|on_hold|validation|complete|closed"
}
```

### Engineer 배정 (Super Admin만)
```
PUT /tickets/{id}/assign
```
**Request Body:**
```json
{
  "engineer_id": "number"
}
```

### 티켓 승인
```
PUT /tickets/{id}/approve
```
**Request Body:**
```json
{
  "approval_type": "user_master|super_admin"
}
```

## 댓글 관리 (Comments)

### 티켓 댓글 목록 조회
```
GET /comments/ticket/{ticketId}
```

### 댓글 작성
```
POST /comments
```
**Request Body:**
```json
{
  "ticket_id": "number",
  "content": "string",
  "attachment_name": "string"
}
```

### 댓글 수정
```
PUT /comments/{id}
```
**Request Body:**
```json
{
  "content": "string"
}
```

### 댓글 삭제
```
DELETE /comments/{id}
```

## 제품정보 관리 (Product Info)

### 내 제품정보 조회 (User Master)
```
GET /productinfo/my
```

### User Master의 제품정보 조회 (Super Admin, Engineer)
```
GET /productinfo/user-master/{userMasterId}
```

### 모든 제품정보 조회 (Super Admin, Engineer만)
```
GET /productinfo
```

### 특정 제품정보 조회
```
GET /productinfo/{id}
```

### 제품정보 생성 (User Master만)
```
POST /productinfo
```
**Request Body:**
```json
{
  "product_name": "string",
  "version": "string",
  "license_info": "string",
  "eos_date": "YYYY-MM-DD",
  "monitoring_solution": "boolean",
  "patch_history": "string"
}
```

### 제품정보 수정
```
PUT /productinfo/{id}
```
**Request Body:**
```json
{
  "product_name": "string",
  "version": "string",
  "license_info": "string",
  "eos_date": "YYYY-MM-DD",
  "monitoring_solution": "boolean",
  "patch_history": "string"
}
```

### 제품정보 삭제
```
DELETE /productinfo/{id}
```

## 대시보드 (Dashboard)

### 대시보드 메인 데이터
```
GET /dashboard
```

### 임박한 티켓 조회
```
GET /dashboard/upcoming-tickets
```

## 통계 (Statistics)

### 월간 통계 (Super Admin만)
```
GET /statistics/monthly?year={year}&month={month}
```

### Engineer별 성과 통계 (Super Admin만)
```
GET /statistics/engineer-performance?start_date={date}&end_date={date}
```

### 프로젝트별 통계 (Super Admin, Engineer만)
```
GET /statistics/project-stats
```

### 티켓 심각도별 통계 (Super Admin, Engineer만)
```
GET /statistics/ticket-severity
```

### 티켓 이슈 타입별 통계 (Super Admin, Engineer만)
```
GET /statistics/ticket-issue-type
```

### User Master별 통계 (Super Admin만)
```
GET /statistics/user-master-stats
```

### 전체 시스템 요약 통계 (Super Admin만)
```
GET /statistics/system-summary
```

## 파일 업로드 (Upload)

### 단일 파일 업로드
```
POST /upload/single
```
**Content-Type:** `multipart/form-data`
**Form Data:**
- `file`: 파일

### 다중 파일 업로드
```
POST /upload/multiple
```
**Content-Type:** `multipart/form-data`
**Form Data:**
- `files`: 파일들 (최대 10개)

### 파일 다운로드
```
GET /upload/download/{filename}
```

### 파일 삭제
```
DELETE /upload/{filename}
```

### 업로드된 파일 목록 조회
```
GET /upload/list
```

## 알림 (Notifications)

### 내 알림 목록 조회
```
GET /notifications/my
```

### 읽지 않은 알림 개수 조회
```
GET /notifications/unread-count
```

### 알림 읽음 처리
```
PUT /notifications/{id}/read
```

### 모든 알림 읽음 처리
```
PUT /notifications/read-all
```

### 알림 삭제
```
DELETE /notifications/{id}
```

### 모든 알림 삭제
```
DELETE /notifications/delete-all
```

## 권한 체계

### Super Admin
- 모든 기능 접근 가능
- 사용자 관리
- Engineer 배정
- 시스템 통계 조회

### Engineer
- 티켓 처리 및 상태 관리
- 프로젝트 조회
- 통계 조회 (일부)

### User Master
- 소속 User 관리
- 제품정보 관리
- 티켓 승인

### User
- 프로젝트 생성 및 관리
- 티켓 생성
- 자신의 데이터만 조회

## 응답 형식

### 성공 응답
```json
{
  "message": "성공 메시지",
  "data": { ... }
}
```

### 오류 응답
```json
{
  "error": "오류 메시지",
  "detail": "상세 오류 정보 (선택적)"
}
```

## 상태 코드

- `200`: 성공
- `201`: 생성 성공
- `400`: 잘못된 요청
- `401`: 인증 실패
- `403`: 권한 없음
- `404`: 리소스 없음
- `500`: 서버 오류

## 인증 헤더 예시

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 파일 업로드 제한

- **최대 파일 크기**: 10MB
- **최대 파일 수**: 10개 (다중 업로드 시)
- **지원 파일 형식**: 
  - 이미지: JPEG, PNG, GIF
  - 문서: PDF, DOC, DOCX, XLS, XLSX
  - 텍스트: TXT, CSV 