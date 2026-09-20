// ==========================================
// 1. إعدادات Firebase
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBhBuU1OdkHDkcWTNu0G8wzvrjHHM5BsCE",
    authDomain: "medeamawahib.firebaseapp.com",
    projectId: "medeamawahib",
    storageBucket: "medeamawahib.firebasestorage.app",
    messagingSenderId: "292370574224",
    appId: "1:292370574224:web:40cf123c34c7401ef32115",
    measurementId: "G-FB8QE8L2JZ"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==========================================
// 2. متغيرات عامة
// ==========================================
const ADMIN_PASSWORD = "medeaAdmin"; // ⚠️ غيّرها لكلمة مرور قوية

let currentFilter = {
    talents: 'pending',
    suggestions: 'new'
};
let allData = {
    talents: [],
    subscribers: [],
    suggestions: []
};
let pendingDeleteAction = null;
let charts = {};

// ==========================================
// 3. دوال مساعدة
// ==========================================
function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    try {
        var date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('ar-DZ', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return '-';
    }
}

function getStatusText(status) {
    var map = {
        pending: 'قيد الانتظار',
        approved: 'مقبولة',
        rejected: 'مرفوضة',
        new: 'جديد',
        processed: 'تمت المعالجة'
    };
    return map[status] || 'قيد الانتظار';
}

function getActionText(action) {
    var map = {
        login: 'تسجيل دخول',
        logout: 'تسجيل خروج',
        approve: 'قبول موهبة',
        reject: 'رفض موهبة',
        delete_talent: 'حذف موهبة',
        delete_subscriber: 'حذف مشترك',
        delete_suggestion: 'حذف اقتراح',
        mark_processed: 'تعليم اقتراح كمُعالَج',
        export: 'تصدير بيانات'
    };
    return map[action] || action;
}

// ✅ التحقق مما إذا كان الموهوب قاصراً
function isMinor(talent) {
    var age = parseInt(talent.age);
    if (!isNaN(age) && age < 18) return true;
    if (talent.guardianName && talent.guardianName.trim()) return true;
    return false;
}

// ==========================================
// 4. نظام الإشعارات (Toast)
// ==========================================
function showToast(type, title, message) {
    var container = document.getElementById('toastContainer');
    if (!container) return;

    var icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML =
        '<div class="toast-icon"><i class="fa-solid ' + icons[type] + '"></i></div>' +
        '<div class="toast-content">' +
        '<div class="toast-title">' + title + '</div>' +
        '<div class="toast-message">' + message + '</div>' +
        '</div>';
    container.appendChild(toast);
    setTimeout(function() {
        toast.classList.add('hiding');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
}

// ==========================================
// 5. سجل النشاطات - تسجيل الإجراءات في Firebase
// ==========================================
async function logActivity(action, target, details) {
    try {
        await db.collection('activityLogs').add({
            action: action,
            target: target || '',
            details: details || '',
            adminName: 'المدير',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.warn('فشل تسجيل النشاط:', error);
    }
}

// ==========================================
// 6. نظام تسجيل الدخول (في index.html)
// ==========================================
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var password = document.getElementById('adminPassword').value;
        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem('adminAuth', 'true');
            await logActivity('login', 'المدير', 'تم تسجيل الدخول بنجاح');
            window.location.href = 'admin.html';
        } else {
            var errEl = document.getElementById('loginError');
            errEl.textContent = 'كلمة المرور غير صحيحة';
            setTimeout(function() { errEl.textContent = ''; }, 3000);
        }
    });
}

// ==========================================
// 7. التحقق من المصادقة (في admin.html)
// ==========================================
if (document.getElementById('adminPanel')) {
    if (sessionStorage.getItem('adminAuth') !== 'true') {
        window.location.href = 'index.html';
    } else {
        initAdminPanel();
    }
}

// ==========================================
// 8. تهيئة لوحة التحكم
// ==========================================
function initAdminPanel() {

    // --- Sidebar ---
    var sidebar = document.getElementById('sidebar');
    var sidebarOverlay = document.getElementById('sidebarOverlay');
    var menuToggle = document.getElementById('menuToggle');
    var sidebarClose = document.getElementById('sidebarClose');

    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }

    menuToggle.addEventListener('click', openSidebar);
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // --- Navigation ---
    var navButtons = document.querySelectorAll('.nav-btn[data-section]');
    var sections = document.querySelectorAll('.content-section');
    var pageTitle = document.getElementById('pageTitle');
    var titles = {
        dashboard: 'لوحة القيادة',
        talents: 'إدارة المواهب',
        subscribers: 'النشرة البريدية',
        suggestions: 'الاقتراحات',
        analytics: 'التحليلات',
        activity: 'سجل النشاطات',
        settings: 'الإعدادات'
    };

    function switchSection(name) {
        navButtons.forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.section === name);
        });
        sections.forEach(function(sec) {
            sec.classList.toggle('active', sec.id === 'section-' + name);
        });
        pageTitle.textContent = titles[name] || '';

        if (name === 'dashboard') loadDashboard();
        else if (name === 'talents') loadTalents();
        else if (name === 'subscribers') loadSubscribers();
        else if (name === 'suggestions') loadSuggestions();
        else if (name === 'analytics') loadAnalytics();
        else if (name === 'activity') loadActivity();

        closeSidebar();
    }

    navButtons.forEach(function(btn) {
        btn.addEventListener('click', function() { switchSection(btn.dataset.section); });
    });

    document.querySelectorAll('[data-goto]').forEach(function(btn) {
        btn.addEventListener('click', function() { switchSection(btn.dataset.goto); });
    });

    // --- Logout ---
    document.getElementById('logoutBtn').addEventListener('click', async function() {
        await logActivity('logout', 'المدير', 'تم تسجيل الخروج');
        sessionStorage.removeItem('adminAuth');
        window.location.href = 'index.html';
    });

    // --- Confirm Delete ---
    document.getElementById('confirmDeleteBtn').addEventListener('click', async function() {
        if (!pendingDeleteAction) return;
        var col = pendingDeleteAction.collection;
        var id = pendingDeleteAction.id;
        var name = pendingDeleteAction.name;
        try {
            await db.collection(col).doc(id).delete();

            var actionType = col === 'talents' ? 'delete_talent' :
                             col === 'subscribers' ? 'delete_subscriber' : 'delete_suggestion';
            await logActivity(actionType, name, 'تم الحذف النهائي');

            if (col === 'talents') {
                allData.talents = allData.talents.filter(function(t) { return t.id !== id; });
                renderTalents();
            } else if (col === 'subscribers') {
                allData.subscribers = allData.subscribers.filter(function(s) { return s.id !== id; });
                renderSubscribers();
            } else if (col === 'suggestions') {
                allData.suggestions = allData.suggestions.filter(function(s) { return s.id !== id; });
                renderSuggestions();
            }
            showToast('success', 'تم الحذف', 'تم الحذف بنجاح');
        } catch (error) {
            console.error(error);
            showToast('error', 'خطأ', 'فشل الحذف');
        }
        closeModal('confirmModal');
        pendingDeleteAction = null;
    });

    // --- Modals ---
    window.openModal = function(id) {
        document.getElementById(id).classList.add('active');
    };
    window.closeModal = function(id) {
        document.getElementById(id).classList.remove('active');
    };
    document.querySelectorAll('[data-close-modal]').forEach(function(btn) {
        btn.addEventListener('click', function() { closeModal(btn.dataset.closeModal); });
    });
    document.querySelectorAll('.modal').forEach(function(modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // --- Search Inputs ---
    document.getElementById('talentsSearch').addEventListener('input', renderTalents);
    document.getElementById('subscribersSearch').addEventListener('input', renderSubscribers);
    document.getElementById('suggestionsSearch').addEventListener('input', renderSuggestions);

    // --- Filter Buttons (Talents) ---
    document.querySelectorAll('#section-talents .filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#section-talents .filter-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentFilter.talents = btn.dataset.filter;
            renderTalents();
        });
    });

    // --- Filter Buttons (Suggestions) ---
    document.querySelectorAll('#section-suggestions .filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#section-suggestions .filter-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentFilter.suggestions = btn.dataset.filter;
            renderSuggestions();
        });
    });

    // --- Export Talents CSV ---
    document.getElementById('exportTalents').addEventListener('click', async function() {
        if (allData.talents.length === 0) {
            showToast('warning', 'تنبيه', 'لا توجد مواهب للتصدير');
            return;
        }
        var csv = 'الاسم,الفئة,العمر,البلدية,البريد,الهاتف,الحالة,قاصر,اسم ولي الأمر,بريد ولي الأمر,تاريخ التسجيل\n';
        allData.talents.forEach(function(t) {
            var minor = isMinor(t) ? 'نعم' : 'لا';
            csv += '"' + (t.fullName || t.talentName || '') + '","' + (t.category || '') + '","' + (t.age || '') + '","' + (t.municipality || '') + '","' + (t.email || '') + '","' + (t.phone || '-') + '","' + getStatusText(t.status) + '","' + minor + '","' + (t.guardianName || '') + '","' + (t.guardianEmail || '') + '","' + formatDate(t.createdAt) + '"\n';
        });
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'talents_' + new Date().toISOString().split('T')[0] + '.csv';
        link.click();
        await logActivity('export', 'المواهب', 'تم تصدير ' + allData.talents.length + ' موهبة');
        showToast('success', 'تم التصدير', 'تم تصدير ' + allData.talents.length + ' موهبة');
    });

    // --- Export Subscribers CSV ---
    document.getElementById('exportCSV').addEventListener('click', async function() {
        if (allData.subscribers.length === 0) {
            showToast('warning', 'تنبيه', 'لا يوجد مشتركين للتصدير');
            return;
        }
        var csv = 'البريد الإلكتروني,تاريخ الاشتراك\n';
        allData.subscribers.forEach(function(s) {
            csv += '"' + s.email + '","' + formatDate(s.subscribedAt) + '"\n';
        });
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'subscribers_' + new Date().toISOString().split('T')[0] + '.csv';
        link.click();
        await logActivity('export', 'المشتركين', 'تم تصدير ' + allData.subscribers.length + ' مشترك');
        showToast('success', 'تم التصدير', 'تم تصدير ' + allData.subscribers.length + ' مشترك');
    });

    // --- Export All Data JSON ---
    document.getElementById('exportAllData').addEventListener('click', async function() {
        try {
            var tSnap = await db.collection('talents').get();
            var sSnap = await db.collection('subscribers').get();
            var gSnap = await db.collection('suggestions').get();
            var data = {
                talents: tSnap.docs.map(function(d) { return d.data(); }),
                subscribers: sSnap.docs.map(function(d) { return d.data(); }),
                suggestions: gSnap.docs.map(function(d) { return d.data(); }),
                exportedAt: new Date().toISOString()
            };
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'backup_' + new Date().toISOString().split('T')[0] + '.json';
            link.click();
            await logActivity('export', 'جميع البيانات', 'نسخة احتياطية JSON');
            showToast('success', 'تم التصدير', 'تم تصدير جميع البيانات');
        } catch (error) {
            console.error(error);
            showToast('error', 'خطأ', 'فشل تصدير البيانات');
        }
    });

    // --- Change Password ---
    document.getElementById('changePasswordBtn').addEventListener('click', function() {
        var np = document.getElementById('newPassword').value;
        if (np.length < 6) {
            showToast('warning', 'تنبيه', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }
        showToast('info', 'ملاحظة', 'تغيير كلمة المرور يحتاج Backend لحفظها بشكل دائم');
    });

    // ==========================================
    // 9. تحميل لوحة القيادة
    // ==========================================
    async function loadDashboard() {
        try {
            var results = await Promise.all([
                db.collection('talents').get(),
                db.collection('subscribers').get(),
                db.collection('suggestions').get()
            ]);

            var talents = results[0].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            allData.talents = talents;
            allData.subscribers = results[1].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            allData.suggestions = results[2].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });

            var pending = talents.filter(function(t) { return t.status === 'pending'; }).length;
            var approved = talents.filter(function(t) { return t.status === 'approved'; }).length;

            document.getElementById('stat-total-talents').textContent = talents.length;
            document.getElementById('stat-pending').textContent = pending;
            document.getElementById('stat-approved').textContent = approved;
            document.getElementById('stat-subscribers').textContent = allData.subscribers.length;

            var badgeP = document.getElementById('badge-pending');
            badgeP.textContent = pending;
            badgeP.style.display = pending > 0 ? 'inline-block' : 'none';

            var newSug = allData.suggestions.filter(function(s) { return s.status === 'new'; }).length;
            var badgeN = document.getElementById('badge-new');
            badgeN.textContent = newSug;
            badgeN.style.display = newSug > 0 ? 'inline-block' : 'none';

            renderCharts(talents);

            // Recent Talents
            var recent = talents.slice().sort(function(a, b) {
                return (b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0);
            }).slice(0, 5);

            var rtEl = document.getElementById('recent-talents');
            if (recent.length === 0) {
                rtEl.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>لا توجد مواهب مسجلة بعد</p></div>';
            } else {
                rtEl.innerHTML = recent.map(function(t) {
                    var name = t.fullName || t.talentName || 'بدون اسم';
                    var minorBadge = isMinor(t) ? '<span class="minor-badge"><i class="fa-solid fa-child"></i> قاصر</span>' : '';
                    return '<div class="recent-item">' +
                        '<div class="recent-avatar">' + name.charAt(0) + '</div>' +
                        '<div class="recent-info">' +
                        '<div class="recent-title">' + escapeHtml(name) + ' ' + minorBadge + '</div>' +
                        '<div class="recent-meta">' + escapeHtml(t.category || '-') + ' • ' + formatDate(t.createdAt) + '</div>' +
                        '</div>' +
                        '<span class="recent-badge badge-' + (t.status || 'pending') + '">' + getStatusText(t.status) + '</span>' +
                        '</div>';
                }).join('');
            }

            // Recent Suggestions
            var recentSug = allData.suggestions.slice().sort(function(a, b) {
                return (b.suggestedAt && b.suggestedAt.toMillis ? b.suggestedAt.toMillis() : 0) - (a.suggestedAt && a.suggestedAt.toMillis ? a.suggestedAt.toMillis() : 0);
            }).slice(0, 5);

            var rsEl = document.getElementById('recent-suggestions');
            if (recentSug.length === 0) {
                rsEl.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>لا توجد اقتراحات بعد</p></div>';
            } else {
                rsEl.innerHTML = recentSug.map(function(s) {
                    var content = s.content || '';
                    var short = content.length > 50 ? content.substring(0, 50) + '...' : content;
                    var badge = s.status === 'new' ? 'new' : 'processed';
                    var label = s.status === 'new' ? 'جديد' : 'تمت المعالجة';
                    return '<div class="recent-item">' +
                        '<div class="recent-avatar"><i class="fa-solid fa-lightbulb"></i></div>' +
                        '<div class="recent-info">' +
                        '<div class="recent-title">' + escapeHtml(s.email || 'بريد غير معروف') + '</div>' +
                        '<div class="recent-meta">' + escapeHtml(short) + '</div>' +
                        '</div>' +
                        '<span class="recent-badge badge-' + badge + '">' + label + '</span>' +
                        '</div>';
                }).join('');
            }

        } catch (error) {
            console.error(error);
            showToast('error', 'خطأ', 'فشل تحميل البيانات');
        }
    }

    // ==========================================
    // 10. رسم البيانيات
    // ==========================================
    function renderCharts(talents) {
        var talentsCtx = document.getElementById('talentsChart');
        if (talentsCtx && typeof Chart !== 'undefined') {
            if (charts.talents) charts.talents.destroy();
            charts.talents = new Chart(talentsCtx, {
                type: 'bar',
                data: {
                    labels: ['قيد الانتظار', 'مقبولة', 'مرفوضة'],
                    datasets: [{
                        label: 'عدد المواهب',
                        data: [
                            talents.filter(function(t) { return t.status === 'pending'; }).length,
                            talents.filter(function(t) { return t.status === 'approved'; }).length,
                            talents.filter(function(t) { return t.status === 'rejected'; }).length
                        ],
                        backgroundColor: ['#fbbf24', '#00f5a0', '#ff6b6b']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                    }
                }
            });
        }

        var catCtx = document.getElementById('categoriesChart');
        if (catCtx && typeof Chart !== 'undefined') {
            if (charts.categories) charts.categories.destroy();
            var counts = {};
            talents.forEach(function(t) {
                var c = t.category || 'غير محدد';
                counts[c] = (counts[c] || 0) + 1;
            });
            charts.categories = new Chart(catCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(counts),
                    datasets: [{
                        data: Object.values(counts),
                        backgroundColor: ['#00f5a0', '#00d9f5', '#a78bfa', '#fbbf24', '#ff6b6b', '#00c6ff']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0' } } }
                }
            });
        }
    }

    // ==========================================
    // 11. إدارة المواهب - البطاقة الذكية
    // ==========================================
    async function loadTalents() {
        var container = document.getElementById('talents-list');
        container.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل...</div>';
        try {
            var snap = await db.collection('talents').orderBy('createdAt', 'desc').get();
            allData.talents = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            renderTalents();
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>فشل تحميل البيانات</p></div>';
        }
    }

    function buildGuardianSection(t) {
        if (!isMinor(t)) return '';
        return '<div class="guardian-section">' +
            '<div class="guardian-header">' +
            '<i class="fa-solid fa-shield-halved"></i>' +
            '<span>معلومات ولي الأمر (الموهوب قاصر)</span>' +
            '</div>' +
            '<div class="guardian-details">' +
            '<div class="guardian-row">' +
            '<i class="fa-solid fa-user-tie"></i>' +
            '<span><strong>الاسم:</strong> ' + escapeHtml(t.guardianName || '-') + '</span>' +
            '</div>' +
            '<div class="guardian-row">' +
            '<i class="fa-solid fa-envelope"></i>' +
            '<span><strong>البريد:</strong> ' + escapeHtml(t.guardianEmail || '-') + '</span>' +
            '</div>' +
            '<div class="guardian-row">' +
            '<i class="fa-solid fa-circle-check"></i>' +
            '<span><strong>الموافقة:</strong> ' + (t.parentalConsent ? '<span style="color:#00f5a0">ممنوحة ✓</span>' : '<span style="color:#ff6b6b">غير ممنوحة ✗</span>') + '</span>' +
            '</div>' +
            '</div></div>';
    }

    function buildSocialLinks(t) {
        if (!t.socialLinks || !Array.isArray(t.socialLinks) || t.socialLinks.length === 0) return '';
        var html = '<div class="social-links-section">' +
            '<div class="section-label"><i class="fa-solid fa-share-nodes"></i> روابط المنصات</div>' +
            '<div class="social-links-list">';
        t.socialLinks.forEach(function(link) {
            if (link.platform && link.link) {
                html += '<a href="' + escapeHtml(link.link) + '" target="_blank" class="social-link-item">' +
                    '<i class="fa-solid fa-external-link-alt"></i>' +
                    '<span>' + escapeHtml(link.platform) + '</span>' +
                    '</a>';
            }
        });
        html += '</div></div>';
        return html;
    }

    function renderTalents() {
        var container = document.getElementById('talents-list');
        var search = document.getElementById('talentsSearch').value.toLowerCase().trim();
        var filtered = allData.talents;

        if (currentFilter.talents !== 'all') {
            filtered = filtered.filter(function(t) { return t.status === currentFilter.talents; });
        }
        if (search) {
            filtered = filtered.filter(function(t) {
                return (t.fullName || '').toLowerCase().indexOf(search) !== -1 ||
                    (t.talentName || '').toLowerCase().indexOf(search) !== -1 ||
                    (t.category || '').toLowerCase().indexOf(search) !== -1 ||
                    (t.municipality || '').toLowerCase().indexOf(search) !== -1 ||
                    (t.email || '').toLowerCase().indexOf(search) !== -1;
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>لا توجد نتائج</p></div>';
            return;
        }

        container.innerHTML = filtered.map(function(t) {
            var name = t.fullName || t.talentName || 'بدون اسم';
            var minor = isMinor(t);
            var minorBadge = minor ? '<span class="minor-badge"><i class="fa-solid fa-child"></i> قاصر</span>' : '';

            // ✅ التوسع التلقائي: القاصرين + قيد الانتظار
            var isExpandedByDefault = minor || t.status === 'pending';

            var html = '<div class="item-card talent-card' + (minor ? ' minor-card' : '') + (isExpandedByDefault ? ' expanded' : '') + '">' +
                '<div class="card-top">' +
                '<div class="item-header">' +
                '<div>' +
                '<div class="item-title">' + escapeHtml(name) + ' ' + minorBadge + '</div>' +
                '<div class="item-meta">' +
                '<i class="fa-solid fa-palette"></i> ' + escapeHtml(t.category || '-') +
                (t.age ? ' • <i class="fa-solid fa-cake-candles"></i> ' + t.age + ' سنة' : '') +
                (t.municipality ? ' • <i class="fa-solid fa-location-dot"></i> ' + escapeHtml(t.municipality) : '') +
                '</div>' +
                '<div class="item-meta" style="margin-top:4px">' +
                '<i class="fa-solid fa-calendar"></i> ' + formatDate(t.createdAt) +
                ' <span class="recent-badge badge-' + (t.status || 'pending') + '" style="margin-right:8px">' + getStatusText(t.status) + '</span>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '<div class="item-contact">' +
                '<span><i class="fa-solid fa-envelope"></i> ' + escapeHtml(t.email || 'غير متوفر') + '</span>' +
                '<span><i class="fa-solid fa-phone"></i> ' + escapeHtml(t.phone || '-') + '</span>' +
                '</div>';

            if (t.description) {
                html += '<div class="item-body">' + escapeHtml(t.description) + '</div>';
            }

            html += buildSocialLinks(t);
            html += buildGuardianSection(t);

            // زر التوسيع
            var toggleIcon = isExpandedByDefault ? 'fa-chevron-up' : 'fa-chevron-down';
            var toggleLabel = isExpandedByDefault ? 'إخفاء التفاصيل' : 'تفاصيل إضافية';

            html += '<div class="item-actions">' +
                '<button class="action-icon-btn btn-toggle-details" onclick="toggleTalentDetails(this)">' +
                '<i class="fa-solid ' + toggleIcon + '"></i> <span>' + toggleLabel + '</span>' +
                '</button>';

            // ✅ زر القبول: يظهر للمواهب قيد الانتظار والمرفوضة
            if (t.status === 'pending') {
                html += '<button class="action-icon-btn btn-approve" onclick="updateTalentStatus(\'' + t.id + '\', \'approved\')">' +
                    '<i class="fa-solid fa-check"></i> قبول</button>';
            } else if (t.status === 'rejected') {
                html += '<button class="action-icon-btn btn-approve" onclick="updateTalentStatus(\'' + t.id + '\', \'approved\')">' +
                    '<i class="fa-solid fa-rotate-left"></i> إعادة قبول</button>';
            }

            // ✅ زر الرفض: يظهر للمواهب قيد الانتظار والمقبولة
            if (t.status === 'pending') {
                html += '<button class="action-icon-btn btn-reject" onclick="updateTalentStatus(\'' + t.id + '\', \'rejected\')">' +
                    '<i class="fa-solid fa-xmark"></i> رفض</button>';
            } else if (t.status === 'approved') {
                html += '<button class="action-icon-btn btn-reject" onclick="updateTalentStatus(\'' + t.id + '\', \'rejected\')">' +
                    '<i class="fa-solid fa-rotate-left"></i> إعادة رفض</button>';
            }

            html += '<button class="action-icon-btn btn-delete" onclick="confirmDelete(\'talents\', \'' + t.id + '\', \'' + escapeHtml(name) + '\')">' +
                '<i class="fa-solid fa-trash"></i> حذف</button>' +
                '</div>' +
                '</div>';

            return html;
        }).join('');
    }

    window.toggleTalentDetails = function(btn) {
        var card = btn.closest('.talent-card');
        var socialSection = card.querySelector('.social-links-section');
        var guardianSection = card.querySelector('.guardian-section');
        var icon = btn.querySelector('i');
        var label = btn.querySelector('span');

        var isExpanded = card.classList.toggle('expanded');

        if (socialSection) socialSection.style.display = isExpanded ? 'block' : 'none';
        if (guardianSection) guardianSection.style.display = isExpanded ? 'block' : 'none';

        if (isExpanded) {
            icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
            label.textContent = 'إخفاء التفاصيل';
        } else {
            icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
            label.textContent = 'تفاصيل إضافية';
        }
    };

    window.updateTalentStatus = async function(id, status) {
        try {
            await db.collection('talents').doc(id).update({ status: status });
            var t = allData.talents.find(function(x) { return x.id === id; });
            var name = t ? (t.fullName || t.talentName || '') : '';

            var action = status === 'approved' ? 'approve' : 'reject';
            await logActivity(action, name, 'تم تغيير الحالة إلى: ' + getStatusText(status));

            if (t) t.status = status;
            renderTalents();
            showToast('success', 'تم التحديث', 'تم تغيير الحالة إلى: ' + getStatusText(status));
        } catch (error) {
            console.error(error);
            showToast('error', 'خطأ', 'فشل تحديث الحالة');
        }
    };

    window.confirmDelete = function(collection, id, name) {
        pendingDeleteAction = { collection: collection, id: id, name: name };
        document.getElementById('confirmMessage').textContent = 'هل أنت متأكد من حذف "' + name + '"؟ هذا الإجراء لا يمكن التراجع عنه.';
        openModal('confirmModal');
    };

    // ==========================================
    // 12. إدارة المشتركين
    // ==========================================
    async function loadSubscribers() {
        var container = document.getElementById('subscribers-list');
        container.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل...</div>';
        try {
            var snap = await db.collection('subscribers').orderBy('subscribedAt', 'desc').get();
            allData.subscribers = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            document.getElementById('subscribers-count').textContent = allData.subscribers.length;
            renderSubscribers();
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>فشل تحميل البيانات</p></div>';
        }
    }

    function renderSubscribers() {
        var container = document.getElementById('subscribers-list');
        var search = document.getElementById('subscribersSearch').value.toLowerCase().trim();
        var filtered = allData.subscribers;
        if (search) {
            filtered = filtered.filter(function(s) { return (s.email || '').toLowerCase().indexOf(search) !== -1; });
        }
        document.getElementById('subscribers-count').textContent = filtered.length;
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>لا توجد نتائج</p></div>';
            return;
        }
        container.innerHTML = filtered.map(function(s) {
            return '<div class="item-card"><div class="item-header"><div>' +
                '<div class="item-title" style="font-size:1rem">' + escapeHtml(s.email) + '</div>' +
                '<div class="item-meta"><i class="fa-solid fa-calendar"></i> ' + formatDate(s.subscribedAt) + '</div>' +
                '</div><button class="action-icon-btn btn-delete" onclick="confirmDelete(\'subscribers\', \'' + s.id + '\', \'' + escapeHtml(s.email) + '\')"><i class="fa-solid fa-trash"></i> حذف</button>' +
                '</div></div>';
        }).join('');
    }

    // ==========================================
    // 13. إدارة الاقتراحات
    // ==========================================
    async function loadSuggestions() {
        var container = document.getElementById('suggestions-list');
        container.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل...</div>';
        try {
            var snap = await db.collection('suggestions').orderBy('suggestedAt', 'desc').get();
            allData.suggestions = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            renderSuggestions();
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>فشل تحميل البيانات</p></div>';
        }
    }

    function renderSuggestions() {
        var container = document.getElementById('suggestions-list');
        var search = document.getElementById('suggestionsSearch').value.toLowerCase().trim();
        var filtered = allData.suggestions;
        if (currentFilter.suggestions !== 'all') {
            filtered = filtered.filter(function(s) { return s.status === currentFilter.suggestions; });
        }
        if (search) {
            filtered = filtered.filter(function(s) {
                return (s.email || '').toLowerCase().indexOf(search) !== -1 ||
                    (s.content || '').toLowerCase().indexOf(search) !== -1;
            });
        }
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>لا توجد نتائج</p></div>';
            return;
        }
        container.innerHTML = filtered.map(function(s) {
            var badge = s.status === 'new' ? 'new' : 'processed';
            var label = s.status === 'new' ? 'جديد' : 'تمت المعالجة';
            var html = '<div class="item-card"><div class="item-header"><div>' +
                '<div class="item-title">' + escapeHtml(s.email || 'بريد غير معروف') + '</div>' +
                '<div class="item-meta"><i class="fa-solid fa-calendar"></i> ' + formatDate(s.suggestedAt) +
                ' <span class="recent-badge badge-' + badge + '" style="margin-right:8px">' + label + '</span></div>' +
                '</div></div>' +
                '<div class="item-body">' + escapeHtml(s.content || 'لا يوجد محتوى') + '</div>' +
                '<div class="item-actions">';
            if (s.status === 'new') {
                html += '<button class="action-icon-btn btn-mark" onclick="markSuggestionProcessed(\'' + s.id + '\')"><i class="fa-solid fa-check"></i> تمت المعالجة</button>';
            }
            html += '<button class="action-icon-btn btn-delete" onclick="confirmDelete(\'suggestions\', \'' + s.id + '\', \'هذا الاقتراح\')"><i class="fa-solid fa-trash"></i> حذف</button>' +
                '</div></div>';
            return html;
        }).join('');
    }

    window.markSuggestionProcessed = async function(id) {
        try {
            await db.collection('suggestions').doc(id).update({ status: 'processed' });
            var s = allData.suggestions.find(function(x) { return x.id === id; });
            var email = s ? (s.email || '') : '';

            await logActivity('mark_processed', email, 'تم تعليم الاقتراح كمُعالَج');

            if (s) s.status = 'processed';
            renderSuggestions();
            showToast('success', 'تم', 'تم تعليم الاقتراح كمُعالَج');
        } catch (error) {
            console.error(error);
            showToast('error', 'خطأ', 'فشل تحديث الحالة');
        }
    };

    // ==========================================
    // 14. التحليلات
    // ==========================================
    async function loadAnalytics() {
        try {
            var snap = await db.collection('talents').get();
            var talents = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });

            var growthCtx = document.getElementById('growthChart');
            if (growthCtx && typeof Chart !== 'undefined') {
                if (charts.growth) charts.growth.destroy();
                var days = [];
                var counts = [];
                for (var i = 29; i >= 0; i--) {
                    var d = new Date();
                    d.setDate(d.getDate() - i);
                    var ds = d.toISOString().split('T')[0];
                    days.push(ds.substring(5));
                    counts.push(talents.filter(function(t) {
                        var cd = t.createdAt && t.createdAt.toDate ? t.createdAt.toDate() : null;
                        return cd && cd.toISOString().split('T')[0] === ds;
                    }).length);
                }
                charts.growth = new Chart(growthCtx, {
                    type: 'line',
                    data: {
                        labels: days,
                        datasets: [{
                            label: 'مواهب جديدة',
                            data: counts,
                            borderColor: '#00f5a0',
                            backgroundColor: 'rgba(0,245,160,0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                            x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                        }
                    }
                });
            }

            var geoCtx = document.getElementById('geoChart');
            if (geoCtx && typeof Chart !== 'undefined') {
                if (charts.geo) charts.geo.destroy();
                var mCounts = {};
                talents.forEach(function(t) {
                    var m = t.municipality || 'غير محدد';
                    mCounts[m] = (mCounts[m] || 0) + 1;
                });
                var sorted = Object.entries(mCounts).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);
                charts.geo = new Chart(geoCtx, {
                    type: 'bar',
                    data: {
                        labels: sorted.map(function(m) { return m[0]; }),
                        datasets: [{
                            label: 'عدد المواهب',
                            data: sorted.map(function(m) { return m[1]; }),
                            backgroundColor: '#00d9f5'
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                            x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                        }
                    }
                });
            }
        } catch (error) {
            console.error(error);
            showToast('error', 'خطأ', 'فشل تحميل التحليلات');
        }
    }

    // ==========================================
    // 15. سجل النشاطات الحقيقي
    // ==========================================
    async function loadActivity() {
        var container = document.getElementById('activity-list');
        container.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل...</div>';
        try {
            var snap = await db.collection('activityLogs').orderBy('timestamp', 'desc').limit(100).get();

            if (snap.empty) {
                container.innerHTML = '<div class="empty-state">' +
                    '<i class="fa-solid fa-clock-rotate-left"></i>' +
                    '<p>لا توجد نشاطات مسجلة بعد</p>' +
                    '<p style="font-size:0.85rem; margin-top:0.5rem; color:#64748b">ستظهر هنا كل الإجراءات التي تقوم بها (قبول، رفض، حذف، تسجيل دخول...)</p>' +
                    '</div>';
                return;
            }

            var activities = snap.docs.map(function(d) {
                return Object.assign({ id: d.id }, d.data());
            });

            var iconMap = {
                login: { icon: 'fa-right-to-bracket', cls: 'info' },
                logout: { icon: 'fa-right-from-bracket', cls: 'warning' },
                approve: { icon: 'fa-check', cls: 'success' },
                reject: { icon: 'fa-xmark', cls: 'warning' },
                delete_talent: { icon: 'fa-trash', cls: 'danger' },
                delete_subscriber: { icon: 'fa-trash', cls: 'danger' },
                delete_suggestion: { icon: 'fa-trash', cls: 'danger' },
                mark_processed: { icon: 'fa-circle-check', cls: 'info' },
                export: { icon: 'fa-file-export', cls: 'info' }
            };

            container.innerHTML = activities.map(function(a) {
                var info = iconMap[a.action] || { icon: 'fa-circle-info', cls: 'info' };
                return '<div class="activity-item">' +
                    '<div class="activity-icon ' + info.cls + '">' +
                    '<i class="fa-solid ' + info.icon + '"></i>' +
                    '</div>' +
                    '<div class="activity-info">' +
                    '<div class="activity-title">' + escapeHtml(getActionText(a.action)) + '</div>' +
                    '<div class="activity-meta">' +
                    '<strong>' + escapeHtml(a.target || '-') + '</strong>' +
                    (a.details ? ' • ' + escapeHtml(a.details) : '') +
                    ' • ' + formatDate(a.timestamp) +
                    '</div>' +
                    '</div>' +
                    '</div>';
            }).join('');

        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>فشل تحميل النشاطات</p></div>';
        }
    }

    // ==========================================
    // 16. تحميل لوحة القيادة تلقائياً
    // ==========================================
    loadDashboard();
}
