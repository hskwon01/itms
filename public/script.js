// 전역 변수
let currentUser = null;
let authToken = localStorage.getItem('token');

// API 기본 설정
const API_BASE = '/api';

// 페이지 로드 시 토큰 확인
// document.addEventListener('DOMContentLoaded', () => {
//     if (authToken) {
//         checkAuth();
//     }
// });

// // 인증 확인
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            currentUser = userData.user;
            showDashboard();
        } else {
            localStorage.removeItem('token');
            authToken = null;
        }
    } catch (error) {
        console.error('인증 확인 오류:', error);
        localStorage.removeItem('token');
        authToken = null;
    }
}

// 로그인
async function login(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            showDashboard();
        } else {
            alert(data.error || '로그인에 실패했습니다.');
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        alert('로그인 중 오류가 발생했습니다.');
    }
}

// User Master 필드 토글
function toggleUserMasterField() {
    const role = document.getElementById('reg-role').value;
    const userMasterField = document.getElementById('user-master-field');
    const userMasterInput = document.getElementById('reg-user-master');
    
    if (role === 'user') {
        userMasterField.style.display = 'block';
        userMasterInput.required = true;
    } else {
        userMasterField.style.display = 'none';
        userMasterInput.required = false;
    }
}

// 회원가입
async function register(event) {
    event.preventDefault();
    
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const email = document.getElementById('reg-email').value;
    const role = document.getElementById('reg-role').value;
    const level = parseInt(document.getElementById('reg-level').value);
    const userMasterUsername = document.getElementById('reg-user-master').value;

    // User 역할인 경우 User Master 사용자명 필수
    if (role === 'user' && !userMasterUsername) {
        alert('User 역할을 선택한 경우 User Master 사용자명을 입력해야 합니다.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username, 
                password, 
                email,
                role, 
                level,
                user_master_username: userMasterUsername 
            })
        });

        const data = await response.json();
        console.log(data);

        if (response.ok) {
            let message = data.message || '회원가입이 완료되었습니다.';
            
            if (role === 'user_master') {
                message += ' Super Admin의 승인을 기다려주세요.';
            } else if (role === 'user') {
                message += ' User Master의 승인을 기다려주세요.';
            } else {
                message += ' 이메일을 확인하세요.';
            }
            
            alert(message);
            showLogin();
        } else {
            alert(data.error || '회원가입에 실패했습니다.');
        }
    } catch (error) {
        console.error('회원가입 오류:', error);
        alert('회원가입 중 오류가 발생했습니다.');
    }
}

// 로그아웃
function logout() {
    localStorage.removeItem('token');
    authToken = null;
    currentUser = null;
    showAuth();
}

// UI 표시 함수들
function showLogin() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

function showRegister() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function showAuth() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('productinfo-section').style.display = 'none';
    document.getElementById('file-section').style.display = 'none';
    document.getElementById('notification-section').style.display = 'none';
    document.getElementById('project-form').style.display = 'none';
    document.getElementById('ticket-form').style.display = 'none';
    document.getElementById('approval-section').style.display = 'none';
}

// 대시보드 표시
function showDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('user-info').style.display = 'block';
    
    // 사용자 정보 표시
    if (currentUser) {
        document.getElementById('user-info').innerHTML = `
            <div class="user-info">
                <span>환영합니다, ${currentUser.username}님!</span>
                <span>역할: ${currentUser.role}</span>
                <span>레벨: ${currentUser.level}</span>
                <button onclick="logout()">로그아웃</button>
            </div>
        `;
    }
    
    // 권한별 메뉴 업데이트
    updateMenuByRole();
    
    // 대시보드 데이터 로드
    loadDashboard();
    
    // 각 섹션 데이터 로드
    loadProductInfo();
    loadFiles();
    loadNotifications();
    loadProjects();
    loadTickets();
}

// 승인 대기 목록 로드
async function loadPendingApprovals() {
    try {
        const response = await fetchWithAuth(`${API_BASE}/auth/pending-approvals`);
        const data = await response.json();
        
        if (response.ok) {
            displayPendingApprovals(data.pendingUsers || []);
        } else {
            console.error('승인 대기 목록 로드 실패:', data.error);
        }
    } catch (error) {
        console.error('승인 대기 목록 로드 오류:', error);
    }
}

// 승인 대기 목록 표시
function displayPendingApprovals(pendingUsers) {
    const container = document.getElementById('pending-approvals-list');
    
    if (!pendingUsers.length) {
        container.innerHTML = '<p>승인 대기 중인 사용자가 없습니다.</p>';
        return;
    }
    
    const role = currentUser?.role;
    const isSuperAdmin = role === 'super_admin';
    
    container.innerHTML = pendingUsers.map(user => `
        <div class="approval-card">
            <div class="user-info">
                <strong>${user.username}</strong>
                <span>${user.email}</span>
                <small>가입일: ${new Date(user.created_at).toLocaleDateString()}</small>
            </div>
            <div class="approval-actions">
                <button onclick="approveUser(${user.id}, '${isSuperAdmin ? 'user_master' : 'user'}')" class="approve-btn">
                    승인
                </button>
            </div>
        </div>
    `).join('');
}

// 사용자 승인
async function approveUser(userId, userType) {
    try {
        const endpoint = userType === 'user_master' ? 
            `${API_BASE}/auth/approve-user-master/${userId}` : 
            `${API_BASE}/auth/approve-user/${userId}`;
            
        const response = await fetchWithAuth(endpoint, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(data.message);
            loadPendingApprovals(); // 목록 새로고침
        } else {
            alert(data.error || '승인에 실패했습니다.');
        }
    } catch (error) {
        console.error('사용자 승인 오류:', error);
        alert('승인 중 오류가 발생했습니다.');
    }
}

// fetch wrapper (JWT 자동 포함)
async function fetchWithAuth(url, options = {}) {
    options.headers = options.headers || {};
    if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (!options.headers['Content-Type'] && !(options.body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
    }
    return fetch(url, options);
}

// 권한별 메뉴/섹션 show/hide
function updateMenuByRole() {
    const role = currentUser?.role;
    // 예시: 제품정보, 파일, 알림 섹션 show/hide
    document.getElementById('productinfo-section').style.display = (role === 'user_master' || role === 'super_admin' || role === 'engineer') ? 'block' : 'none';
    document.getElementById('file-section').style.display = 'block';
    document.getElementById('notification-section').style.display = 'block';
    
    // 승인 관리 섹션 (Super Admin, User Master만)
    document.getElementById('approval-section').style.display = (role === 'super_admin' || role === 'user_master') ? 'block' : 'none';
    
    // 승인 대기 목록 로드
    if (role === 'super_admin' || role === 'user_master') {
        loadPendingApprovals();
    }
}

// --- 제품정보 ---
async function loadProductInfo() {
    let url = '';
    if (currentUser.role === 'user_master') {
        url = `${API_BASE}/productinfo/my`;
    } else if (currentUser.role === 'super_admin' || currentUser.role === 'engineer') {
        url = `${API_BASE}/productinfo`;
    } else {
        document.getElementById('productinfo-list').innerHTML = '<p>권한이 없습니다.</p>';
        return;
    }
    try {
        const res = await fetchWithAuth(url);
        const data = await res.json();
        displayProductInfo(data.products || []);
    } catch (e) {
        document.getElementById('productinfo-list').innerHTML = '<p>제품정보를 불러올 수 없습니다.</p>';
    }
}
function displayProductInfo(products) {
    const el = document.getElementById('productinfo-list');
    if (!products.length) {
        el.innerHTML = '<p>제품정보가 없습니다.</p>';
        return;
    }
    el.innerHTML = products.map(p => `
        <div class="product-card">
            <h4>${p.product_name} <small>(${p.version || ''})</small></h4>
            <p>라이선스: ${p.license_info || '-'}</p>
            <p>EOS: ${p.eos_date || '-'}</p>
            <p>모니터링: ${p.monitoring_solution ? 'O' : 'X'}</p>
            <p>패치: ${p.patch_history || '-'}</p>
        </div>
    `).join('');
}

// --- 파일 업로드 ---
async function loadFiles() {
    try {
        const res = await fetchWithAuth(`${API_BASE}/upload/list`);
        const data = await res.json();
        displayFiles(data.files || []);
    } catch (e) {
        document.getElementById('file-list').innerHTML = '<p>파일 목록을 불러올 수 없습니다.</p>';
    }
}
function displayFiles(files) {
    const el = document.getElementById('file-list');
    if (!files.length) {
        el.innerHTML = '<p>업로드된 파일이 없습니다.</p>';
        return;
    }
    el.innerHTML = files.map(f => `
        <div class="file-card">
            <span>${f.filename}</span>
            <span>(${(f.size/1024).toFixed(1)} KB)</span>
            <button onclick="downloadFile('${f.filename}')">다운로드</button>
            <button onclick="deleteFile('${f.filename}')">삭제</button>
        </div>
    `).join('');
}
async function uploadFile(event) {
    event.preventDefault();
    const fileInput = document.getElementById('file-upload-input');
    if (!fileInput.files.length) return alert('파일을 선택하세요.');
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    try {
        const res = await fetchWithAuth(`${API_BASE}/upload/single`, { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
            alert('업로드 성공');
            loadFiles();
        } else {
            alert(data.error || '업로드 실패');
        }
    } catch (e) {
        alert('업로드 중 오류');
    }
}
async function downloadFile(filename) {
    window.open(`/uploads/${filename}`);
}
async function deleteFile(filename) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
        const res = await fetchWithAuth(`${API_BASE}/upload/${filename}`, { method: 'DELETE' });
        if (res.ok) {
            alert('삭제 성공');
            loadFiles();
        } else {
            alert('삭제 실패');
        }
    } catch (e) {
        alert('삭제 중 오류');
    }
}

// --- 알림 ---
async function loadNotifications() {
    try {
        const res = await fetchWithAuth(`${API_BASE}/notifications/my`);
        const data = await res.json();
        displayNotifications(data.notifications || []);
    } catch (e) {
        document.getElementById('notification-list').innerHTML = '<p>알림을 불러올 수 없습니다.</p>';
    }
}
function displayNotifications(notis) {
    const el = document.getElementById('notification-list');
    if (!notis.length) {
        el.innerHTML = '<p>알림이 없습니다.</p>';
        return;
    }
    el.innerHTML = notis.map(n => `
        <div class="noti-card${n.is_read ? '' : ' unread'}">
            <span>${n.title || ''}</span>
            <span>${n.message || ''}</span>
            <button onclick="markNotificationRead(${n.id})">읽음</button>
            <button onclick="deleteNotification(${n.id})">삭제</button>
        </div>
    `).join('');
}
async function markNotificationRead(id) {
    await fetchWithAuth(`${API_BASE}/notifications/${id}/read`, { method: 'PUT' });
    loadNotifications();
}
async function deleteNotification(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await fetchWithAuth(`${API_BASE}/notifications/${id}`, { method: 'DELETE' });
    loadNotifications();
}

// 대시보드 로드
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/dashboard`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayDashboard(data);
        }
    } catch (error) {
        console.error('대시보드 로드 오류:', error);
    }
}

// 대시보드 표시
function displayDashboard(data) {
    const dashboardContent = document.getElementById('dashboard-content');
    
    let html = '<div class="dashboard-stats">';
    
    if (data.role === 'user') {
        html += `
            <div class="stat-card">
                <h4>내 프로젝트</h4>
                <p>${data.projectCount}개</p>
            </div>
            <div class="stat-card">
                <h4>최근 티켓</h4>
                <p>${data.recentTickets.length}개</p>
            </div>
        `;
    } else if (data.role === 'engineer') {
        html += `
            <div class="stat-card">
                <h4>배정된 티켓</h4>
                <p>${data.assignedTickets.length}개</p>
            </div>
        `;
    } else if (data.role === 'super_admin') {
        html += `
            <div class="stat-card">
                <h4>전체 프로젝트</h4>
                <p>${data.projectStats.total_projects}개</p>
            </div>
            <div class="stat-card">
                <h4>활성 프로젝트</h4>
                <p>${data.projectStats.active_projects}개</p>
            </div>
        `;
    }
    
    html += '</div>';
    dashboardContent.innerHTML = html;
}

// 프로젝트 관련 함수들
async function loadProjects() {
    try {
        const response = await fetch(`${API_BASE}/projects/my`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayProjects(data.projects);
        }
    } catch (error) {
        console.error('프로젝트 로드 오류:', error);
    }
}

function displayProjects(projects) {
    const projectsList = document.getElementById('projects-list');
    
    if (projects.length === 0) {
        projectsList.innerHTML = '<p>프로젝트가 없습니다.</p>';
        return;
    }

    let html = '<div class="projects-grid">';
    projects.forEach(project => {
        html += `
            <div class="project-card">
                <h4>${project.name}</h4>
                <p><strong>코드:</strong> ${project.code}</p>
                <p><strong>상태:</strong> ${project.status}</p>
                <p>${project.description || '설명 없음'}</p>
                <button onclick="viewProject(${project.id})">상세보기</button>
            </div>
        `;
    });
    html += '</div>';
    
    projectsList.innerHTML = html;
}

async function createProject(event) {
    event.preventDefault();
    
    const name = document.getElementById('project-name').value;
    const code = document.getElementById('project-code').value;
    const description = document.getElementById('project-description').value;

    try {
        const response = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name, code, description })
        });

        const data = await response.json();

        if (response.ok) {
            alert('프로젝트가 생성되었습니다.');
            hideProjectForm();
            loadProjects();
        } else {
            alert(data.error || '프로젝트 생성에 실패했습니다.');
        }
    } catch (error) {
        console.error('프로젝트 생성 오류:', error);
        alert('프로젝트 생성 중 오류가 발생했습니다.');
    }
}

function showProjectForm() {
    document.getElementById('project-form').style.display = 'block';
}

function hideProjectForm() {
    document.getElementById('project-form').style.display = 'none';
    document.getElementById('project-form').reset();
}

// 티켓 관련 함수들
async function loadTickets() {
    try {
        const response = await fetch(`${API_BASE}/tickets/my`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayTickets(data.tickets);
        }
    } catch (error) {
        console.error('티켓 로드 오류:', error);
    }
}

function displayTickets(tickets) {
    const ticketsList = document.getElementById('tickets-list');
    
    if (tickets.length === 0) {
        ticketsList.innerHTML = '<p>티켓이 없습니다.</p>';
        return;
    }

    let html = '<div class="tickets-grid">';
    tickets.forEach(ticket => {
        html += `
            <div class="ticket-card">
                <h4>${ticket.title}</h4>
                <p><strong>번호:</strong> ${ticket.ticket_number}</p>
                <p><strong>프로젝트:</strong> ${ticket.project_name}</p>
                <p><strong>상태:</strong> ${ticket.status}</p>
                <p><strong>심각도:</strong> ${ticket.severity}</p>
                <button onclick="viewTicket(${ticket.id})">상세보기</button>
            </div>
        `;
    });
    html += '</div>';
    
    ticketsList.innerHTML = html;
}

async function createTicket(event) {
    event.preventDefault();
    
    const project_id = document.getElementById('ticket-project').value;
    const title = document.getElementById('ticket-title').value;
    const issue_type = document.getElementById('ticket-issue-type').value;
    const severity = document.getElementById('ticket-severity').value;
    const description = document.getElementById('ticket-description').value;
    const product_name = document.getElementById('ticket-product-name').value;
    const product_version = document.getElementById('ticket-product-version').value;
    const os_info = document.getElementById('ticket-os-info').value;
    const fix_level = document.getElementById('ticket-fix-level').value;
    const requested_end_date = document.getElementById('ticket-end-date').value;

    try {
        const response = await fetch(`${API_BASE}/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                project_id, title, issue_type, severity, description,
                product_name, product_version, os_info, fix_level, requested_end_date
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('티켓이 생성되었습니다.');
            hideTicketForm();
            loadTickets();
        } else {
            alert(data.error || '티켓 생성에 실패했습니다.');
        }
    } catch (error) {
        console.error('티켓 생성 오류:', error);
        alert('티켓 생성 중 오류가 발생했습니다.');
    }
}

function showTicketForm() {
    document.getElementById('ticket-form').style.display = 'block';
    loadProjectsForTicket();
}

function hideTicketForm() {
    document.getElementById('ticket-form').style.display = 'none';
    document.getElementById('ticket-form').reset();
}

async function loadProjectsForTicket() {
    try {
        const response = await fetch(`${API_BASE}/projects/my`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const projectSelect = document.getElementById('ticket-project');
            
            projectSelect.innerHTML = '<option value="">프로젝트 선택</option>';
            data.projects.forEach(project => {
                projectSelect.innerHTML += `<option value="${project.id}">${project.name} (${project.code})</option>`;
            });
        }
    } catch (error) {
        console.error('프로젝트 목록 로드 오류:', error);
    }
}

// 상세보기 함수들 (추후 구현)
function viewProject(projectId) {
    alert(`프로젝트 ${projectId} 상세보기 - 추후 구현`);
}

function viewTicket(ticketId) {
    alert(`티켓 ${ticketId} 상세보기 - 추후 구현`);
}