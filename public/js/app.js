const API = {
  get: (url) => fetch(url, { credentials: 'same-origin' }).then(r => r.json()),
  post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) }).then(r => r.json()),
  put: (url, data) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) }).then(r => r.json()),
  del: (url) => fetch(url, { method: 'DELETE', credentials: 'same-origin' }).then(r => r.json()),
};

let currentUser = null;
let currentPage = 'home';

// 消息提示
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// 弹窗
function modal(title, bodyHtml, actions) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal"><h3>${title}</h3><div class="modal-body">${bodyHtml}</div><div class="modal-actions" id="modalActions"></div></div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  const actionsEl = overlay.querySelector('#modalActions');
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = `btn ${a.cls || 'btn-default'}`;
    btn.textContent = a.text;
    btn.onclick = () => a.onClick(overlay);
    actionsEl.appendChild(btn);
  });
  return overlay;
}

// 启动
async function init() {
  try {
    const res = await API.get('/api/me');
    if (res.user) { currentUser = res.user; renderApp(); }
    else renderLogin();
  } catch { renderLogin(); }
}

function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-box">
        <h1>学校资产管理系统</h1>
        <p class="subtitle">大方县黄泥塘镇第二小学</p>
        <div id="loginError" class="error"></div>
        <input id="loginUser" placeholder="用户名" />
        <input id="loginPwd" type="password" placeholder="密码" />
        <button onclick="doLogin()">登 录</button>
        <p class="tip">默认账号：admin / manager / teacher &nbsp;&nbsp; 密码：admin123 / manager123 / 123456</p>
      </div>
    </div>`;
  document.getElementById('loginPwd').addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPwd').value;
  const res = await API.post('/api/login', { username, password });
  if (res.success) { currentUser = res.user; renderApp(); }
  else { document.getElementById('loginError').textContent = res.message; }
}

async function doLogout() {
  await API.post('/api/logout');
  currentUser = null;
  renderLogin();
}

// 角色中文名
const roleName = { superadmin: '超级管理员', admin: '管理员', teacher: '教师' };

// 菜单
const menus = [
  { key: 'home', icon: '🏠', label: '首页', roles: ['superadmin', 'admin', 'teacher'] },
  { key: 'inbound', icon: '📥', label: '资产入库登记', roles: ['superadmin', 'admin'] },
  { key: 'outbound', icon: '📤', label: '出库登记', roles: ['superadmin', 'admin', 'teacher'] },
  { key: 'borrowing', icon: '🔄', label: '借出跟踪表', roles: ['superadmin', 'admin', 'teacher'] },
  { key: 'inventory', icon: '📦', label: '库存汇总表', roles: ['superadmin', 'admin', 'teacher'] },
  { key: 'ledger', icon: '📋', label: '资产变动台账', roles: ['superadmin', 'admin'] },
  { key: 'stats', icon: '📊', label: '统计报表', roles: ['superadmin', 'admin'] },
  { key: 'repair', icon: '🔧', label: '报修登记', roles: ['superadmin', 'admin', 'teacher'] },
  { key: 'purchase', icon: '🛒', label: '采购申请', roles: ['superadmin', 'admin', 'teacher'] },
  { key: 'users', icon: '👥', label: '用户管理', roles: ['superadmin'] },
  { key: 'settings', icon: '⚙️', label: '参数设置', roles: ['superadmin'] },
];

function renderApp() {
  const visibleMenus = menus.filter(m => m.roles.includes(currentUser.role));
  document.getElementById('app').innerHTML = `
    <div class="layout">
      <div class="sidebar">
        <div class="logo"><h2>资产管理系统</h2><p>${roleName[currentUser.role]}</p></div>
        ${visibleMenus.map(m => `<div class="menu-item ${currentPage === m.key ? 'active' : ''}" onclick="navigate('${m.key}')"><span class="icon">${m.icon}</span><span>${m.label}</span></div>`).join('')}
      </div>
      <div class="main">
        <div class="header">
          <div></div>
          <div class="user-info">
            <span>${currentUser.name}（${currentUser.department}）</span>
            <span class="role-tag role-${currentUser.role}">${roleName[currentUser.role]}</span>
            <span class="logout" onclick="doLogout()">退出登录</span>
          </div>
        </div>
        <div class="content" id="content"></div>
      </div>
    </div>`;
  navigate(currentPage);
}

function navigate(page) {
  if (!menus.find(m => m.key === page)?.roles.includes(currentUser.role)) page = 'home';
  currentPage = page;
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  const active = [...document.querySelectorAll('.menu-item')].find(el => el.textContent.includes(menus.find(m => m.key === page)?.label));
  if (active) active.classList.add('active');
  const renderers = { home: renderHome, inbound: renderInbound, outbound: renderOutbound, borrowing: renderBorrowing, inventory: renderInventory, ledger: renderLedger, stats: renderStats, repair: renderRepair, purchase: renderPurchase, users: renderUsers, settings: renderSettings };
  renderers[page]?.();
}

// ============ 首页 ============
async function renderHome() {
  document.getElementById('content').innerHTML = '<div class="empty">加载中...</div>';
  const res = await API.get('/api/stats');
  const d = res.data;
  document.getElementById('content').innerHTML = `
    <div class="page-title">首页概览</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="label">资产当前总数量</div><div class="value">${d.totalQty}</div></div>
      <div class="stat-card green"><div class="label">资产当前总金额(元)</div><div class="value">${d.totalAmount.toLocaleString()}</div></div>
      <div class="stat-card purple"><div class="label">资产种类数</div><div class="value">${d.assetTypes}</div></div>
      <div class="stat-card orange"><div class="label">待审核入库</div><div class="value">${d.pendingIn}</div></div>
      <div class="stat-card orange"><div class="label">待审核出库</div><div class="value">${d.pendingOut}</div></div>
      <div class="stat-card orange"><div class="label">待审核归还</div><div class="value">${d.pendingReturn}</div></div>
      <div class="stat-card"><div class="label">借出中</div><div class="value">${d.borrowing}</div></div>
      <div class="stat-card red"><div class="label">逾期未还</div><div class="value">${d.overdue}</div></div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:12px;">系统使用说明</h3>
      <div style="line-height:1.8; color:#475569; font-size:13px;">
        <p><b>角色权限：</b>教师可查看库存、提交出库/报修/采购申请；管理员可审核出入库、登记入库；超级管理员拥有全部权限。</p>
        <p><b>业务流程：</b></p>
        <p>• 入库：管理员录入 → 提交待审核 → 超管审核通过 → 库存增加</p>
        <p>• 出库：教师提交申请 → 管理员审核通过 → 库存扣减</p>
        <p>• 借用：审核通过自动写入借出跟踪表 → 教师归还 → 管理员审核 → 库存回补</p>
        <p>• 平衡校验：库存 = 期初 + 入库(已通过) - 出库(已通过)，统计报表自动校验</p>
      </div>
    </div>`;
}

// ============ 入库登记 ============
async function renderInbound() {
  const res = await API.get('/api/inbound');
  const isSuper = currentUser.role === 'superadmin';
  document.getElementById('content').innerHTML = `
    <div class="page-title">资产入库登记表 ${currentUser.role !== 'teacher' ? `<button class="btn btn-primary" onclick="showInboundForm()">+ 新增入库</button>` : ''}</div>
    <div class="card table-wrap"><table>
      <thead><tr><th>入库单号</th><th>入库日期</th><th>资产编号</th><th>资产名称</th><th>类别</th><th>规格</th><th>数量</th><th>单价</th><th>金额</th><th>位置</th><th>供应商</th><th>经办人</th><th>状态</th>${isSuper ? '<th>操作</th>' : ''}</tr></thead>
      <tbody>${res.data.length ? res.data.map(r => `<tr>
        <td>${r.inbound_no}</td><td>${r.inbound_date || '-'}</td><td>${r.asset_code}</td><td>${r.asset_name}</td><td>${r.category || ''}</td><td>${r.spec || ''}</td><td>${r.qty}</td><td>${r.price}</td><td>${(r.qty * r.price).toFixed(2)}</td><td>${r.location || ''}</td><td>${r.supplier || ''}</td><td>${r.handler || ''}</td>
        <td><span class="status status-${r.status}">${r.status === 'pending' ? '待审核' : r.status === 'approved' ? '已通过' : '已驳回'}</span></td>
        ${isSuper ? `<td>${r.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="reviewInbound(${r.id},'approve')">通过</button> <button class="btn btn-danger btn-sm" onclick="reviewInbound(${r.id},'reject')">驳回</button>` : '-'}</td>` : ''}
      </tr>`).join('') : '<tr><td colspan="14" class="empty">暂无数据</td></tr>'}</tbody>
    </table></div>`;
}

function showInboundForm() {
  const cats = ['电子设备', '教学设备', '家具用具', '办公设备', '实验器材', '图书资料', '体育器材', '其他'];
  const units = ['台', '套', '个', '把', '张', '件', '本'];
  const html = `<div class="form-row">
    <div class="form-group"><label>资产编号 *</label><input id="f_asset_code" placeholder="如 A007" /></div>
    <div class="form-group"><label>资产名称 *</label><input id="f_asset_name" /></div>
    <div class="form-group"><label>类别</label><select id="f_category">${cats.map(c => `<option>${c}</option>`).join('')}</select></div>
    <div class="form-group"><label>规格型号</label><input id="f_spec" /></div>
    <div class="form-group"><label>数量 *</label><input id="f_qty" type="number" /></div>
    <div class="form-group"><label>单位</label><select id="f_unit">${units.map(u => `<option>${u}</option>`).join('')}</select></div>
    <div class="form-group"><label>单价</label><input id="f_price" type="number" step="0.01" /></div>
    <div class="form-group"><label>存放位置</label><input id="f_location" /></div>
    <div class="form-group"><label>供应商</label><input id="f_supplier" /></div>
    <div class="form-group"><label>经办人</label><input id="f_handler" /></div>
    <div class="form-group" style="grid-column:1/-1"><label>备注</label><textarea id="f_remark" rows="2"></textarea></div>
  </div>`;
  const m = modal('新增入库登记', html, [
    { text: '取消', cls: 'btn-default', onClick: o => o.remove() },
    { text: '提交', cls: 'btn-primary', onClick: async (o) => {
      const data = { asset_code: v('f_asset_code'), asset_name: v('f_asset_name'), category: v('f_category'), spec: v('f_spec'), qty: +v('f_qty'), unit: v('f_unit'), price: +v('f_price') || 0, location: v('f_location'), supplier: v('f_supplier'), handler: v('f_handler'), remark: v('f_remark') };
      if (!data.asset_code || !data.asset_name || !data.qty) { toast('请填写必填项', 'error'); return; }
      const res = await API.post('/api/inbound', data);
      if (res.success) { toast('提交成功，等待审核'); o.remove(); renderInbound(); } else toast(res.message, 'error');
    }}
  ]);
}
const v = id => document.getElementById(id)?.value || '';

async function reviewInbound(id, action) {
  const res = await API.post(`/api/inbound/${id}/review`, { action });
  if (res.success) { toast(action === 'approve' ? '审核通过' : '已驳回'); renderInbound(); }
  else toast(res.message, 'error');
}

// ============ 出库登记 ============
async function renderOutbound() {
  const res = await API.get('/api/outbound');
  const isAdmin = currentUser.role !== 'teacher';
  document.getElementById('content').innerHTML = `
    <div class="page-title">出库登记表 <button class="btn btn-primary" onclick="showOutboundForm()">+ 提交出库申请</button></div>
    <div class="card table-wrap"><table>
      <thead><tr><th>出库单号</th><th>出库日期</th><th>资产编号</th><th>资产名称</th><th>数量</th><th>用途</th><th>申请人</th><th>部门</th><th>出库类型</th><th>计划归还</th><th>状态</th>${isAdmin ? '<th>操作</th>' : ''}</tr></thead>
      <tbody>${res.data.length ? res.data.map(r => `<tr>
        <td>${r.outbound_no}</td><td>${r.outbound_date || '-'}</td><td>${r.asset_code}</td><td>${r.asset_name}</td><td>${r.qty}</td><td>${r.purpose || ''}</td><td>${r.applicant}</td><td>${r.department || ''}</td><td>${r.outbound_type || ''}</td><td>${r.planned_return_date || '-'}</td>
        <td><span class="status status-${r.status}">${r.status === 'pending' ? '待审核' : r.status === 'approved' ? '已通过' : '已驳回'}</span></td>
        ${isAdmin ? `<td>${r.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="reviewOutbound(${r.id},'approve')">通过</button> <button class="btn btn-danger btn-sm" onclick="reviewOutbound(${r.id},'reject')">驳回</button>` : '-'}</td>` : ''}
      </tr>`).join('') : '<tr><td colspan="12" class="empty">暂无数据</td></tr>'}</tbody>
    </table></div>`;
}

function showOutboundForm() {
  const types = ['发放出库', '借用出库', '报废出库'];
  const html = `<div class="form-row">
    <div class="form-group"><label>资产编号 *</label><input id="o_asset_code" placeholder="如 A001" /></div>
    <div class="form-group"><label>数量 *</label><input id="o_qty" type="number" /></div>
    <div class="form-group"><label>用途</label><input id="o_purpose" /></div>
    <div class="form-group"><label>申请部门</label><input id="o_department" value="${currentUser.department || ''}" /></div>
    <div class="form-group"><label>出库类型</label><select id="o_type">${types.map(t => `<option>${t}</option>`).join('')}</select></div>
    <div class="form-group"><label>计划归还日期(借用必填)</label><input id="o_return" type="date" /></div>
  </div>`;
  const m = modal('提交出库申请', html, [
    { text: '取消', cls: 'btn-default', onClick: o => o.remove() },
    { text: '提交', cls: 'btn-primary', onClick: async (o) => {
      const data = { asset_code: v('o_asset_code'), qty: +v('o_qty'), purpose: v('o_purpose'), department: v('o_department'), outbound_type: v('o_type'), planned_return_date: v('o_return') };
      if (!data.asset_code || !data.qty) { toast('请填写必填项', 'error'); return; }
      const res = await API.post('/api/outbound', data);
      if (res.success) { toast('申请已提交'); o.remove(); renderOutbound(); } else toast(res.message, 'error');
    }}
  ]);
}

async function reviewOutbound(id, action) {
  const res = await API.post(`/api/outbound/${id}/review`, { action });
  if (res.success) { toast(action === 'approve' ? '审核通过' : '已驳回'); renderOutbound(); }
  else toast(res.message, 'error');
}

// ============ 借出跟踪 ============
async function renderBorrowing() {
  const res = await API.get('/api/borrowing');
  const isAdmin = currentUser.role !== 'teacher';
  document.getElementById('content').innerHTML = `
    <div class="page-title">借出跟踪表</div>
    <div class="card table-wrap"><table>
      <thead><tr><th>借出单号</th><th>借出日期</th><th>资产编号</th><th>资产名称</th><th>数量</th><th>借出人</th><th>部门</th><th>计划归还</th><th>实际归还</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>${res.data.length ? res.data.map(r => `<tr>
        <td>${r.borrow_no}</td><td>${r.borrow_date || '-'}</td><td>${r.asset_code}</td><td>${r.asset_name}</td><td>${r.qty}</td><td>${r.borrower}</td><td>${r.department || ''}</td><td>${r.planned_return_date || '-'}</td><td>${r.actual_return_date || '-'}</td>
        <td><span class="status status-${r.return_status}">${r.return_status === 'borrowing' ? '借出中' : r.return_status === 'pending_return' ? '待审核归还' : '已归还'}</span></td>
        <td>${r.return_status === 'borrowing' ? `<button class="btn btn-warning btn-sm" onclick="returnAsset(${r.id})">申请归还</button>` : ''}
        ${isAdmin && r.return_status === 'pending_return' ? `<button class="btn btn-success btn-sm" onclick="reviewReturn(${r.id},'approve')">通过</button> <button class="btn btn-danger btn-sm" onclick="reviewReturn(${r.id},'reject')">驳回</button>` : ''}</td>
      </tr>`).join('') : '<tr><td colspan="11" class="empty">暂无数据</td></tr>'}</tbody>
    </table></div>`;
}

function returnAsset(id) {
  const m = modal('申请归还', `<div class="form-group"><label>实际归还日期</label><input id="r_date" type="date" value="${new Date().toISOString().slice(0,10)}" /></div>`, [
    { text: '取消', cls: 'btn-default', onClick: o => o.remove() },
    { text: '提交', cls: 'btn-primary', onClick: async (o) => {
      const res = await API.post(`/api/borrowing/${id}/return`, { actual_return_date: v('r_date') });
      if (res.success) { toast('归还申请已提交'); o.remove(); renderBorrowing(); } else toast(res.message, 'error');
    }}
  ]);
}

async function reviewReturn(id, action) {
  const res = await API.post(`/api/borrowing/${id}/review-return`, { action });
  if (res.success) { toast(action === 'approve' ? '归还审核通过' : '已驳回'); renderBorrowing(); }
  else toast(res.message, 'error');
}

// ============ 库存汇总 ============
async function renderInventory() {
  const res = await API.get('/api/assets');
  document.getElementById('content').innerHTML = `
    <div class="page-title">库存汇总表</div>
    <div class="card table-wrap"><table>
      <thead><tr><th>资产编号</th><th>资产名称</th><th>类别</th><th>规格型号</th><th>单位</th><th>单价</th><th>存放位置</th><th>期初数量</th><th>累计入库</th><th>累计出库</th><th>当前库存</th><th>库存金额</th></tr></thead>
      <tbody>${res.data.length ? res.data.map(r => `<tr>
        <td>${r.asset_code}</td><td>${r.name}</td><td>${r.category || ''}</td><td>${r.spec || ''}</td><td>${r.unit || ''}</td><td>${r.price}</td><td>${r.location || ''}</td>
        <td>${r.initial_qty}</td><td>${r.total_in}</td><td>${r.total_out}</td><td><b>${r.current_qty}</b></td><td>${r.amount.toFixed(2)}</td>
      </tr>`).join('') : '<tr><td colspan="12" class="empty">暂无数据</td></tr>'}</tbody>
      ${res.data.length ? `<tfoot><tr style="font-weight:bold;background:#f1f5f9"><td colspan="9">合计</td><td>${res.data.reduce((s, r) => s + r.total_out, 0)}</td><td>${res.data.reduce((s, r) => s + r.current_qty, 0)}</td><td>${res.data.reduce((s, r) => s + r.amount, 0).toFixed(2)}</td></tr></tfoot>` : ''}
    </table></div>`;
}

// ============ 台账 ============
async function renderLedger() {
  const res = await API.get('/api/ledger');
  document.getElementById('content').innerHTML = `
    <div class="page-title">资产变动台账</div>
    <div class="card table-wrap"><table>
      <thead><tr><th>日期</th><th>变动类型</th><th>单据编号</th><th>资产编号</th><th>资产名称</th><th>数量变动</th><th>经手人</th><th>备注</th></tr></thead>
      <tbody>${res.data.length ? res.data.map(r => `<tr>
        <td>${r.date}</td><td>${r.change_type}</td><td>${r.doc_no}</td><td>${r.asset_code}</td><td>${r.asset_name}</td><td style="color:${r.qty > 0 ? '#10b981' : '#ef4444'}">${r.qty > 0 ? '+' : ''}${r.qty}</td><td>${r.handler}</td><td>${r.remark || ''}</td>
      </tr>`).join('') : '<tr><td colspan="8" class="empty">暂无数据</td></tr>'}</tbody>
    </table></div>`;
}

// ============ 统计报表 ============
async function renderStats() {
  const res = await API.get('/api/stats');
  const d = res.data; const b = d.balance;
  document.getElementById('content').innerHTML = `
    <div class="page-title">统计报表</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="label">资产当前总数量</div><div class="value">${d.totalQty}</div></div>
      <div class="stat-card green"><div class="label">资产当前总金额(元)</div><div class="value">${d.totalAmount.toLocaleString()}</div></div>
      <div class="stat-card purple"><div class="label">资产种类数</div><div class="value">${d.assetTypes}</div></div>
      <div class="stat-card orange"><div class="label">待审核入库</div><div class="value">${d.pendingIn}</div></div>
      <div class="stat-card orange"><div class="label">待审核出库</div><div class="value">${d.pendingOut}</div></div>
      <div class="stat-card orange"><div class="label">待审核归还</div><div class="value">${d.pendingReturn}</div></div>
      <div class="stat-card"><div class="label">借出中</div><div class="value">${d.borrowing}</div></div>
      <div class="stat-card red"><div class="label">逾期未还</div><div class="value">${d.overdue}</div></div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:12px;">平衡校验（差异应为 0）</h3>
      <table>
        <tr><td>期初库存总量</td><td><b>${b.initialTotal}</b></td></tr>
        <tr><td>累计入库(已通过)</td><td><b style="color:#10b981">+${b.totalIn}</b></td></tr>
        <tr><td>累计出库(已通过)</td><td><b style="color:#ef4444">-${b.totalOut}</b></td></tr>
        <tr><td>理论期末库存</td><td><b>${b.theoretical}</b></td></tr>
        <tr><td>库存表实际合计</td><td><b>${b.actualTotal}</b></td></tr>
        <tr><td>差异</td><td><b>${b.diff}</b></td></tr>
        <tr><td>平衡状态</td><td>${b.balanced ? '<span class="balanced">平衡 ✓</span>' : '<span class="imbalanced">不平衡 ✗</span>'}</td></tr>
      </table>
    </div>`;
}

// ============ 报修登记 ============
async function renderRepair() {
  const res = await API.get('/api/repair');
  const isAdmin = currentUser.role !== 'teacher';
  document.getElementById('content').innerHTML = `
    <div class="page-title">报修登记表 <button class="btn btn-primary" onclick="showRepairForm()">+ 新增报修</button></div>
    <div class="card table-wrap"><table>
      <thead><tr><th>报修单号</th><th>报修日期</th><th>资产编号</th><th>资产名称</th><th>故障描述</th><th>报修人</th><th>部门</th><th>状态</th>${isAdmin ? '<th>处理</th>' : ''}</tr></thead>
      <tbody>${res.data.length ? res.data.map(r => `<tr>
        <td>${r.repair_no}</td><td>${r.repair_date}</td><td>${r.asset_code || ''}</td><td>${r.asset_name || ''}</td><td>${r.fault_desc || ''}</td><td>${r.reporter}</td><td>${r.department || ''}</td>
        <td><span class="status status-${r.status}">${r.status === 'pending' ? '待处理' : r.status === 'processing' ? '处理中' : '已完成'}</span></td>
        ${isAdmin ? `<td><button class="btn btn-sm btn-default" onclick="editRepair(${r.id}, '${r.status}', '${r.handler || ''}', '${r.remark || ''}')">处理</button></td>` : ''}
      </tr>`).join('') : '<tr><td colspan="9" class="empty">暂无数据</td></tr>'}</tbody>
    </table></div>`;
}

function showRepairForm() {
  const html = `<div class="form-row">
    <div class="form-group"><label>资产编号</label><input id="rp_code" /></div>
    <div class="form-group"><label>资产名称</label><input id="rp_name" /></div>
    <div class="form-group"><label>部门</label><input id="rp_dept" value="${currentUser.department || ''}" /></div>
    <div class="form-group" style="grid-column:1/-1"><label>故障描述 *</label><textarea id="rp_desc" rows="3"></textarea></div>
  </div>`;
  modal('新增报修', html, [
    { text: '取消', cls: 'btn-default', onClick: o => o.remove() },
    { text: '提交', cls: 'btn-primary', onClick: async (o) => {
      const res = await API.post('/api/repair', { asset_code: v('rp_code'), asset_name: v('rp_name'), fault_desc: v('rp_desc'), department: v('rp_dept') });
      if (res.success) { toast('报修已提交'); o.remove(); renderRepair(); } else toast(res.message, 'error');
    }}
  ]);
}

function editRepair(id, status, handler, remark) {
  const html = `<div class="form-row">
    <div class="form-group"><label>状态</label><select id="er_status"><option value="pending" ${status === 'pending' ? 'selected' : ''}>待处理</option><option value="processing" ${status === 'processing' ? 'selected' : ''}>处理中</option><option value="done" ${status === 'done' ? 'selected' : ''}>已完成</option></select></div>
    <div class="form-group"><label>处理人</label><input id="er_handler" value="${handler}" /></div>
    <div class="form-group" style="grid-column:1/-1"><label>备注</label><textarea id="er_remark" rows="2">${remark}</textarea></div>
  </div>`;
  modal('处理报修', html, [
    { text: '取消', cls: 'btn-default', onClick: o => o.remove() },
    { text: '保存', cls: 'btn-primary', onClick: async (o) => {
      const res = await API.put(`/api/repair/${id}`, { status: v('er_status'), handler: v('er_handler'), remark: v('er_remark') });
      if (res.success) { toast('已更新'); o.remove(); renderRepair(); } else toast(res.message, 'error');
    }}
  ]);
}

// ============ 采购申请 ============
async function renderPurchase() {
  const res = await API.get('/api/purchase');
  const isAdmin = currentUser.role !== 'teacher';
  document.getElementById('content').innerHTML = `
    <div class="page-title">采购申请登记表 <button class="btn btn-primary" onclick="showPurchaseForm()">+ 新增采购申请</button></div>
    <div class="card table-wrap"><table>
      <thead><tr><th>采购申请单号</th><th>申请日期</th><th>物品名称</th><th>类别</th><th>数量</th><th>单位</th><th>预算单价</th><th>预算金额</th><th>用途</th><th>申请人</th><th>部门</th><th>状态</th>${isAdmin ? '<th>操作</th>' : ''}</tr></thead>
      <tbody>${res.data.length ? res.data.map(r => `<tr>
        <td>${r.purchase_no}</td><td>${r.apply_date}</td><td>${r.item_name}</td><td>${r.category || ''}</td><td>${r.qty}</td><td>${r.unit || ''}</td><td>${r.budget_price}</td><td>${r.budget_amount.toFixed(2)}</td><td>${r.purpose || ''}</td><td>${r.applicant}</td><td>${r.department || ''}</td>
        <td><span class="status status-${r.status}">${r.status === 'pending' ? '待审核' : r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '已驳回' : r.status}</span></td>
        ${isAdmin ? `<td>${r.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="reviewPurchase(${r.id},'approved')">通过</button> <button class="btn btn-danger btn-sm" onclick="reviewPurchase(${r.id},'rejected')">驳回</button>` : '-'}</td>` : ''}
      </tr>`).join('') : '<tr><td colspan="13" class="empty">暂无数据</td></tr>'}</tbody>
    </table></div>`;
}

function showPurchaseForm() {
  const cats = ['电子设备', '教学设备', '家具用具', '办公设备', '实验器材', '图书资料', '体育器材', '其他'];
  const units = ['台', '套', '个', '把', '张', '件', '本'];
  const html = `<div class="form-row">
    <div class="form-group"><label>物品名称 *</label><input id="pu_name" /></div>
    <div class="form-group"><label>类别</label><select id="pu_cat">${cats.map(c => `<option>${c}</option>`).join('')}</select></div>
    <div class="form-group"><label>数量</label><input id="pu_qty" type="number" /></div>
    <div class="form-group"><label>单位</label><select id="pu_unit">${units.map(u => `<option>${u}</option>`).join('')}</select></div>
    <div class="form-group"><label>预算单价</label><input id="pu_price" type="number" step="0.01" /></div>
    <div class="form-group"><label>部门</label><input id="pu_dept" value="${currentUser.department || ''}" /></div>
    <div class="form-group" style="grid-column:1/-1"><label>用途说明</label><textarea id="pu_purpose" rows="2"></textarea></div>
  </div>`;
  modal('新增采购申请', html, [
    { text: '取消', cls: 'btn-default', onClick: o => o.remove() },
    { text: '提交', cls: 'btn-primary', onClick: async (o) => {
      const res = await API.post('/api/purchase', { item_name: v('pu_name'), category: v('pu_cat'), qty: +v('pu_qty'), unit: v('pu_unit'), budget_price: +v('pu_price') || 0, purpose: v('pu_purpose'), department: v('pu_dept') });
      if (res.success) { toast('采购申请已提交'); o.remove(); renderPurchase(); } else toast(res.message, 'error');
    }}
  ]);
}

async function reviewPurchase(id, status) {
  const res = await API.put(`/api/purchase/${id}`, { status });
  if (res.success) { toast('已更新'); renderPurchase(); } else toast(res.message, 'error');
}

// ============ 用户管理 ============
async function renderUsers() {
  const res = await API.get('/api/users');
  document.getElementById('content').innerHTML = `
    <div class="page-title">用户管理 <button class="btn btn-primary" onclick="showUserForm()">+ 新增用户</button></div>
    <div class="card table-wrap"><table>
      <thead><tr><th>用户名</th><th>姓名</th><th>角色</th><th>部门</th><th>状态</th><th>创建日期</th><th>操作</th></tr></thead>
      <tbody>${res.data.map(r => `<tr>
        <td>${r.username}</td><td>${r.name || ''}</td><td><span class="role-tag role-${r.role}">${roleName[r.role]}</span></td><td>${r.department || ''}</td>
        <td><span class="status status-${r.status === 'enabled' ? 'approved' : 'rejected'}">${r.status === 'enabled' ? '启用' : '禁用'}</span></td>
        <td>${r.created_date}</td>
        <td><button class="btn btn-sm btn-default" onclick="editUser(${r.id}, '${r.username}', '${r.role}', '${r.name || ''}', '${r.department || ''}', '${r.status}')">编辑</button> ${r.username !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="delUser(${r.id})">删除</button>` : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

function showUserForm() {
  const html = `<div class="form-row">
    <div class="form-group"><label>用户名 *</label><input id="u_user" /></div>
    <div class="form-group"><label>密码 *</label><input id="u_pwd" value="123456" /></div>
    <div class="form-group"><label>姓名</label><input id="u_name" /></div>
    <div class="form-group"><label>角色</label><select id="u_role"><option value="teacher">教师</option><option value="admin">管理员</option><option value="superadmin">超级管理员</option></select></div>
    <div class="form-group"><label>部门</label><input id="u_dept" /></div>
  </div>`;
  modal('新增用户', html, [
    { text: '取消', cls: 'btn-default', onClick: o => o.remove() },
    { text: '保存', cls: 'btn-primary', onClick: async (o) => {
      const res = await API.post('/api/users', { username: v('u_user'), password: v('u_pwd'), role: v('u_role'), name: v('u_name'), department: v('u_dept') });
      if (res.success) { toast('用户已创建'); o.remove(); renderUsers(); } else toast(res.message, 'error');
    }}
  ]);
}

function editUser(id, username, role, name, department, status) {
  const html = `<div class="form-row">
    <div class="form-group"><label>用户名</label><input value="${username}" disabled /></div>
    <div class="form-group"><label>新密码(留空不修改)</label><input id="eu_pwd" /></div>
    <div class="form-group"><label>姓名</label><input id="eu_name" value="${name}" /></div>
    <div class="form-group"><label>角色</label><select id="eu_role"><option value="teacher" ${role === 'teacher' ? 'selected' : ''}>教师</option><option value="admin" ${role === 'admin' ? 'selected' : ''}>管理员</option><option value="superadmin" ${role === 'superadmin' ? 'selected' : ''}>超级管理员</option></select></div>
    <div class="form-group"><label>部门</label><input id="eu_dept" value="${department}" /></div>
    <div class="form-group"><label>状态</label><select id="eu_status"><option value="enabled" ${status === 'enabled' ? 'selected' : ''}>启用</option><option value="disabled" ${status === 'disabled' ? 'selected' : ''}>禁用</option></select></div>
  </div>`;
  modal('编辑用户', html, [
    { text: '取消', cls: 'btn-default', onClick: o => o.remove() },
    { text: '保存', cls: 'btn-primary', onClick: async (o) => {
      const res = await API.put(`/api/users/${id}`, { password: v('eu_pwd'), role: v('eu_role'), name: v('eu_name'), department: v('eu_dept'), status: v('eu_status') });
      if (res.success) { toast('已更新'); o.remove(); renderUsers(); } else toast(res.message, 'error');
    }}
  ]);
}

async function delUser(id) {
  if (!confirm('确认删除该用户？')) return;
  const res = await API.del(`/api/users/${id}`);
  if (res.success) { toast('已删除'); renderUsers(); } else toast(res.message, 'error');
}

// ============ 参数设置 ============
async function renderSettings() {
  const res = await API.get('/api/settings');
  const groups = {};
  res.data.forEach(s => { (groups[s.type] = groups[s.type] || []).push(s); });
  const typeNames = { category: '资产类别', unit: '单位', location: '存放位置', department: '部门' };
  document.getElementById('content').innerHTML = `
    <div class="page-title">参数设置 <button class="btn btn-primary" onclick="showSettingForm()">+ 新增参数</button></div>
    ${Object.keys(groups).map(t => `<div class="card">
      <h3 style="margin-bottom:12px;">${typeNames[t] || t}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${groups[t].map(s => `<span class="status status-approved" style="padding:6px 12px;font-size:13px;">${s.value} <span style="cursor:pointer;color:#ef4444;margin-left:6px;" onclick="delSetting(${s.id})">×</span></span>`).join('')}
      </div>
    </div>`).join('')}`;
}

function showSettingForm() {
  const html = `<div class="form-row">
    <div class="form-group"><label>类型</label><select id="st_type"><option value="category">资产类别</option><option value="unit">单位</option><option value="location">存放位置</option><option value="department">部门</option></select></div>
    <div class="form-group"><label>值</label><input id="st_value" /></div>
  </div>`;
  modal('新增参数', html, [
    { text: '取消', cls: 'btn-default', onClick: o => o.remove() },
    { text: '保存', cls: 'btn-primary', onClick: async (o) => {
      const res = await API.post('/api/settings', { type: v('st_type'), value: v('st_value') });
      if (res.success) { toast('已添加'); o.remove(); renderSettings(); } else toast(res.message, 'error');
    }}
  ]);
}

async function delSetting(id) {
  if (!confirm('确认删除？')) return;
  const res = await API.del(`/api/settings/${id}`);
  if (res.success) { toast('已删除'); renderSettings(); } else toast(res.message, 'error');
}

init();
