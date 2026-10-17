const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'school-asset-system-2026-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const today = () => new Date().toISOString().slice(0, 10);

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: '未登录' });
  next();
}
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: '未登录' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: '无权限' });
    next();
  };
}

// 认证
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.find('users', u => u.username === username && u.status === 'enabled');
  if (!user) return res.json({ success: false, message: '用户名不存在或已禁用' });
  if (!bcrypt.compareSync(password, user.password)) return res.json({ success: false, message: '密码错误' });
  req.session.user = { id: user.id, username: user.username, role: user.role, name: user.name, department: user.department };
  res.json({ success: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.session.user }));

app.post('/api/change-password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = db.get('users', req.session.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password)) return res.json({ success: false, message: '原密码错误' });
  db.update('users', user.id, { password: bcrypt.hashSync(newPassword, 10) });
  res.json({ success: true });
});

// 参数设置
app.get('/api/settings', requireAuth, (req, res) => {
  const { type } = req.query;
  const rows = type ? db.filter('settings', s => s.type === type) : db.all('settings');
  res.json({ data: rows });
});
app.post('/api/settings', requireRoles('superadmin'), (req, res) => {
  const { type, value } = req.body;
  const r = db.insert('settings', { type, value });
  res.json({ success: true, id: r.id });
});
app.delete('/api/settings/:id', requireRoles('superadmin'), (req, res) => {
  db.delete('settings', +req.params.id);
  res.json({ success: true });
});

// 用户管理
app.get('/api/users', requireRoles('superadmin'), (req, res) => {
  const rows = db.all('users').map(u => ({ ...u, password: undefined })).sort((a, b) => a.id - b.id);
  res.json({ data: rows });
});
app.post('/api/users', requireRoles('superadmin'), (req, res) => {
  const { username, password, role, name, department } = req.body;
  if (db.find('users', u => u.username === username)) return res.json({ success: false, message: '用户名已存在' });
  db.insert('users', { username, password: bcrypt.hashSync(password || '123456', 10), role, name, department, status: 'enabled', created_date: today() });
  res.json({ success: true });
});
app.put('/api/users/:id', requireRoles('superadmin'), (req, res) => {
  const { password, role, name, department, status } = req.body;
  const upd = { role, name, department, status };
  if (password) upd.password = bcrypt.hashSync(password, 10);
  db.update('users', +req.params.id, upd);
  res.json({ success: true });
});
app.delete('/api/users/:id', requireRoles('superadmin'), (req, res) => {
  const user = db.get('users', +req.params.id);
  if (user && user.username === 'admin') return res.json({ success: false, message: '超级管理员账号不可删除' });
  db.delete('users', +req.params.id);
  res.json({ success: true });
});

// 资产库存
app.get('/api/assets', requireAuth, (req, res) => {
  res.json({ data: db.all('assets').sort((a, b) => a.asset_code.localeCompare(b.asset_code)) });
});
app.get('/api/assets/:code', requireAuth, (req, res) => {
  res.json({ data: db.find('assets', a => a.asset_code === req.params.code) });
});

// 入库
app.get('/api/inbound', requireAuth, (req, res) => {
  let rows;
  if (req.session.user.role === 'teacher') rows = db.filter('inbound', r => r.created_by === req.session.user.username);
  else rows = db.all('inbound');
  res.json({ data: rows.sort((a, b) => b.id - a.id) });
});
app.post('/api/inbound', requireRoles('admin', 'superadmin'), (req, res) => {
  const { asset_code, asset_name, category, spec, qty, unit, price, location, supplier, handler, remark } = req.body;
  const amount = (Number(qty) || 0) * (Number(price) || 0);
  const inbound_no = db.genNo('RK');
  db.insert('inbound', { inbound_no, asset_code, asset_name, category, spec, qty, unit, price, amount, location, supplier, handler, remark, status: 'pending', created_by: req.session.user.username, created_time: now() });
  res.json({ success: true, inbound_no });
});
app.post('/api/inbound/:id/review', requireRoles('superadmin'), (req, res) => {
  const { action } = req.body;
  const row = db.get('inbound', +req.params.id);
  if (!row) return res.json({ success: false, message: '记录不存在' });
  if (row.status !== 'pending') return res.json({ success: false, message: '已审核' });
  if (action === 'approve') {
    const amount = (Number(row.qty) || 0) * (Number(row.price) || 0);
    db.update('inbound', row.id, { status: 'approved', inbound_date: today(), reviewer: req.session.user.username, review_time: now() });
    const asset = db.find('assets', a => a.asset_code === row.asset_code);
    if (asset) {
      db.update('assets', asset.id, { total_in: asset.total_in + row.qty, current_qty: asset.current_qty + row.qty, amount: asset.amount + amount });
    } else {
      db.insert('assets', { asset_code: row.asset_code, name: row.asset_name, category: row.category, spec: row.spec, unit: row.unit, price: row.price, location: row.location, initial_qty: 0, total_in: row.qty, total_out: 0, current_qty: row.qty, amount });
    }
    db.insert('ledger', { date: today(), change_type: '入库', doc_no: row.inbound_no, asset_code: row.asset_code, asset_name: row.asset_name, qty: row.qty, handler: req.session.user.username, remark: row.remark || '' });
    res.json({ success: true });
  } else {
    db.delete('inbound', row.id);
    res.json({ success: true });
  }
});

// 出库
app.get('/api/outbound', requireAuth, (req, res) => {
  let rows;
  if (req.session.user.role === 'teacher') rows = db.filter('outbound', r => r.created_by === req.session.user.username);
  else rows = db.all('outbound');
  res.json({ data: rows.sort((a, b) => b.id - a.id) });
});
app.post('/api/outbound', requireAuth, (req, res) => {
  const { asset_code, qty, purpose, department, outbound_type, planned_return_date } = req.body;
  const asset = db.find('assets', a => a.asset_code === asset_code);
  if (!asset) return res.json({ success: false, message: '资产编号不存在' });
  if (asset.current_qty < Number(qty)) return res.json({ success: false, message: '库存不足' });
  const outbound_no = db.genNo('CK');
  db.insert('outbound', { outbound_no, asset_code, asset_name: asset.name, category: asset.category, spec: asset.spec, qty, unit: asset.unit, purpose, applicant: req.session.user.name, department, outbound_type, planned_return_date: planned_return_date || '', status: 'pending', created_by: req.session.user.username, created_time: now() });
  res.json({ success: true, outbound_no });
});
app.post('/api/outbound/:id/review', requireRoles('admin', 'superadmin'), (req, res) => {
  const { action } = req.body;
  const row = db.get('outbound', +req.params.id);
  if (!row) return res.json({ success: false, message: '记录不存在' });
  if (row.status !== 'pending') return res.json({ success: false, message: '已审核' });
  if (action === 'approve') {
    db.update('outbound', row.id, { status: 'approved', outbound_date: today(), approver: req.session.user.username, approve_time: now() });
    const asset = db.find('assets', a => a.asset_code === row.asset_code);
    if (asset) db.update('assets', asset.id, { total_out: asset.total_out + row.qty, current_qty: asset.current_qty - row.qty });
    db.insert('ledger', { date: today(), change_type: '出库', doc_no: row.outbound_no, asset_code: row.asset_code, asset_name: row.asset_name, qty: -row.qty, handler: req.session.user.username, remark: row.purpose || '' });
    if (row.outbound_type === '借用出库') {
      const borrow_no = db.genNo('JJ');
      db.insert('borrowing', { borrow_no, borrow_date: today(), asset_code: row.asset_code, asset_name: row.asset_name, qty: row.qty, borrower: row.applicant, department: row.department, planned_return_date: row.planned_return_date, return_status: 'borrowing', linked_outbound_no: row.outbound_no, created_by: row.created_by });
    }
    res.json({ success: true });
  } else {
    db.delete('outbound', row.id);
    res.json({ success: true });
  }
});

// 借出
app.get('/api/borrowing', requireAuth, (req, res) => {
  let rows;
  if (req.session.user.role === 'teacher') rows = db.filter('borrowing', r => r.created_by === req.session.user.username);
  else rows = db.all('borrowing');
  res.json({ data: rows.sort((a, b) => b.id - a.id) });
});
app.post('/api/borrowing/:id/return', requireAuth, (req, res) => {
  const { actual_return_date } = req.body;
  const row = db.get('borrowing', +req.params.id);
  if (!row) return res.json({ success: false, message: '记录不存在' });
  if (req.session.user.role === 'teacher' && row.created_by !== req.session.user.username) return res.json({ success: false, message: '无权限' });
  db.update('borrowing', row.id, { actual_return_date: actual_return_date || today(), return_status: 'pending_return' });
  res.json({ success: true });
});
app.post('/api/borrowing/:id/review-return', requireRoles('admin', 'superadmin'), (req, res) => {
  const { action } = req.body;
  const row = db.get('borrowing', +req.params.id);
  if (!row) return res.json({ success: false, message: '记录不存在' });
  if (action === 'approve') {
    const asset = db.find('assets', a => a.asset_code === row.asset_code);
    if (asset) db.update('assets', asset.id, { total_out: asset.total_out - row.qty, current_qty: asset.current_qty + row.qty });
    db.insert('ledger', { date: today(), change_type: '归还', doc_no: row.borrow_no, asset_code: row.asset_code, asset_name: row.asset_name, qty: row.qty, handler: req.session.user.username, remark: '' });
    db.delete('borrowing', row.id);
    res.json({ success: true });
  } else {
    db.update('borrowing', row.id, { actual_return_date: '', return_status: 'borrowing' });
    res.json({ success: true });
  }
});

// 台账
app.get('/api/ledger', requireAuth, (req, res) => {
  res.json({ data: db.all('ledger').sort((a, b) => b.id - a.id) });
});

// 报修
app.get('/api/repair', requireAuth, (req, res) => {
  res.json({ data: db.all('repair').sort((a, b) => b.id - a.id) });
});
app.post('/api/repair', requireAuth, (req, res) => {
  const { asset_code, asset_name, fault_desc, department } = req.body;
  const repair_no = db.genNo('BX');
  db.insert('repair', { repair_no, repair_date: today(), asset_code, asset_name, fault_desc, reporter: req.session.user.name, department, status: 'pending', created_time: now() });
  res.json({ success: true, repair_no });
});
app.put('/api/repair/:id', requireRoles('admin', 'superadmin'), (req, res) => {
  const { status, handler, remark } = req.body;
  db.update('repair', +req.params.id, { status, handler, remark });
  res.json({ success: true });
});

// 采购
app.get('/api/purchase', requireAuth, (req, res) => {
  res.json({ data: db.all('purchase').sort((a, b) => b.id - a.id) });
});
app.post('/api/purchase', requireAuth, (req, res) => {
  const { item_name, category, qty, unit, budget_price, purpose, department } = req.body;
  const budget_amount = (Number(qty) || 0) * (Number(budget_price) || 0);
  const purchase_no = db.genNo('CG');
  db.insert('purchase', { purchase_no, apply_date: today(), item_name, category, qty, unit, budget_price, budget_amount, purpose, applicant: req.session.user.name, department, status: 'pending', created_time: now() });
  res.json({ success: true, purchase_no });
});
app.put('/api/purchase/:id', requireRoles('admin', 'superadmin'), (req, res) => {
  db.update('purchase', +req.params.id, { status: req.body.status });
  res.json({ success: true });
});

// 统计
app.get('/api/stats', requireAuth, (req, res) => {
  const assets = db.all('assets');
  const sum = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const totalQty = sum(assets, 'current_qty');
  const totalAmount = sum(assets, 'amount');
  const assetTypes = assets.length;
  const pendingIn = db.filter('inbound', r => r.status === 'pending').length;
  const pendingOut = db.filter('outbound', r => r.status === 'pending').length;
  const pendingReturn = db.filter('borrowing', r => r.return_status === 'pending_return').length;
  const borrowing = db.filter('borrowing', r => r.return_status === 'borrowing').length;
  const t = today();
  const overdue = db.filter('borrowing', r => r.return_status === 'borrowing' && r.planned_return_date && r.planned_return_date < t).length;
  const initialTotal = sum(assets, 'initial_qty');
  const totalIn = sum(db.filter('inbound', r => r.status === 'approved'), 'qty');
  const totalOut = sum(db.filter('outbound', r => r.status === 'approved'), 'qty');
  const theoretical = initialTotal + totalIn - totalOut;
  const actualTotal = totalQty;
  const diff = theoretical - actualTotal;
  res.json({ data: { totalQty, totalAmount, assetTypes, pendingIn, pendingOut, pendingReturn, borrowing, overdue, balance: { initialTotal, totalIn, totalOut, theoretical, actualTotal, diff, balanced: diff === 0 } } });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (require.main === module) {
  app.listen(PORT, () => console.log(`学校资产管理系统运行于 http://localhost:${PORT}`));
}

module.exports = app;
