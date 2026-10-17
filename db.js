const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDir = process.env.DATA_DIR || '/tmp/school-asset-data';
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'school_asset.json');

// 初始数据结构
const defaultData = {
  users: [],
  assets: [],
  inbound: [],
  outbound: [],
  borrowing: [],
  ledger: [],
  repair: [],
  purchase: [],
  settings: [],
  counters: { inbound: 0, outbound: 0, borrowing: 0, repair: 0, purchase: 0 }
};

let data = null;

function load() {
  if (data) return data;
  if (fs.existsSync(dbFile)) {
    try { data = JSON.parse(fs.readFileSync(dbFile, 'utf8')); }
    catch { data = JSON.parse(JSON.stringify(defaultData)); }
  } else {
    data = JSON.parse(JSON.stringify(defaultData));
  }
  // 确保所有表存在
  Object.keys(defaultData).forEach(k => { if (data[k] === undefined) data[k] = defaultData[k]; });
  if (!data.counters) data.counters = defaultData.counters;
  return data;
}

function save() {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
}

// 自增ID
function nextId(table) {
  const t = load()[table];
  return t.length ? Math.max(...t.map(r => r.id)) + 1 : 1;
}

// 生成单号
function genNo(prefix) {
  const year = new Date().getFullYear();
  const d = load();
  const tableMap = { RK: 'inbound', CK: 'outbound', JJ: 'borrowing', BX: 'repair', CG: 'purchase' };
  const table = tableMap[prefix];
  const count = d[table].filter(r => (r[`${prefix === 'RK' ? 'inbound' : prefix === 'CK' ? 'outbound' : prefix === 'JJ' ? 'borrow' : prefix === 'BX' ? 'repair' : 'purchase'}_no`] || '').startsWith(`${prefix}-${year}-`)).length;
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

// 初始化
function init() {
  const d = load();
  if (d.users.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    const hashMgr = bcrypt.hashSync('manager123', 10);
    const hashTch = bcrypt.hashSync('123456', 10);
    d.users = [
      { id: 1, username: 'admin', password: hash, role: 'superadmin', name: '系统管理员', department: '信息中心', status: 'enabled', created_date: new Date().toISOString().slice(0, 10) },
      { id: 2, username: 'manager', password: hashMgr, role: 'admin', name: '库房管理员', department: '总务处', status: 'enabled', created_date: new Date().toISOString().slice(0, 10) },
      { id: 3, username: 'teacher', password: hashTch, role: 'teacher', name: '王老师', department: '教务处', status: 'enabled', created_date: new Date().toISOString().slice(0, 10) }
    ];
  }
  if (d.settings.length === 0) {
    const types = {
      category: ['电子设备', '教学设备', '家具用具', '办公设备', '实验器材', '图书资料', '体育器材', '医疗器材', '厨房设备', '其他'],
      unit: ['台', '套', '个', '把', '张', '件', '本'],
      location: ['教学楼A栋', '教学楼B栋', '行政楼', '实验楼', '图书馆', '体育馆', '食堂', '微机室', '实验室', '综合楼保管室'],
      department: ['教务处', '学生处', '总务处', '信息中心', '校长办公室', '副校长办公室', '图书室', '少年宫', '音乐组', '体育组', '美术组', '食堂', '实验室', '体育器材室', '教学楼保管室', '值班室', '一楼半', '广播室']
    };
    let sid = 1;
    Object.entries(types).forEach(([type, vals]) => vals.forEach(v => d.settings.push({ id: sid++, type, value: v })));
  }
  if (d.assets.length === 0) {
    d.assets = [
      { id: 1, asset_code: 'A001', name: '笔记本电脑', category: '电子设备', spec: 'ThinkPad E14', unit: '台', price: 5000, location: '教学楼A栋', initial_qty: 8, total_in: 0, total_out: 0, current_qty: 8, amount: 40000 },
      { id: 2, asset_code: 'A002', name: '投影仪', category: '教学设备', spec: 'EPSON CB-X05', unit: '台', price: 3500, location: '教学楼B栋', initial_qty: 4, total_in: 0, total_out: 0, current_qty: 4, amount: 14000 },
      { id: 3, asset_code: 'A003', name: '办公桌椅', category: '家具用具', spec: '主管桌+椅', unit: '套', price: 800, location: '行政楼', initial_qty: 15, total_in: 0, total_out: 0, current_qty: 15, amount: 12000 },
      { id: 4, asset_code: 'A004', name: '激光打印机', category: '办公设备', spec: 'HP M404', unit: '台', price: 2000, location: '行政楼', initial_qty: 3, total_in: 0, total_out: 0, current_qty: 3, amount: 6000 },
      { id: 5, asset_code: 'A005', name: '实验显微镜', category: '实验器材', spec: '奥林巴斯CX33', unit: '台', price: 8000, location: '实验楼', initial_qty: 10, total_in: 0, total_out: 0, current_qty: 10, amount: 80000 },
      { id: 6, asset_code: 'A006', name: '图书(套)', category: '图书资料', spec: '教学参考书', unit: '套', price: 150, location: '图书馆', initial_qty: 80, total_in: 0, total_out: 0, current_qty: 80, amount: 12000 }
    ];
  }
  save();
}

init();

const db = {
  load, save, nextId, genNo,
  all(table) { return load()[table]; },
  get(table, id) { return load()[table].find(r => r.id === id); },
  find(table, predicate) { return load()[table].find(predicate); },
  filter(table, predicate) { return load()[table].filter(predicate); },
  insert(table, record) {
    const d = load();
    if (!record.id) record.id = nextId(table);
    d[table].push(record);
    save();
    return record;
  },
  update(table, id, updates) {
    const d = load();
    const idx = d[table].findIndex(r => r.id === id);
    if (idx === -1) return null;
    d[table][idx] = { ...d[table][idx], ...updates };
    save();
    return d[table][idx];
  },
  delete(table, id) {
    const d = load();
    const idx = d[table].findIndex(r => r.id === id);
    if (idx === -1) return false;
    d[table].splice(idx, 1);
    save();
    return true;
  },
  deleteBy(table, predicate) {
    const d = load();
    const before = d[table].length;
    d[table] = d[table].filter(r => !predicate(r));
    save();
    return before - d[table].length;
  },
  transaction(fn) { fn(); save(); }
};

module.exports = db;
