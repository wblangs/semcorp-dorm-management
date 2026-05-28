const API_BASE = '';

function qs(sel, el = document) {
  return el.querySelector(sel);
}

function qsa(sel, el = document) {
  return Array.from(el.querySelectorAll(sel));
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.detail ? `：${data.detail}` : '';
    } catch {
      // ignore
    }
    throw new Error(`${res.status} ${res.statusText}${detail}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function setActiveNav(route) {
  for (const a of qsa('header nav .nav-links a')) {
    const href = a.getAttribute('href') || '';
    a.setAttribute('aria-current', href === `#/${route}` ? 'page' : 'false');
  }
}

function render(html) {
  qs('#app').innerHTML = html;
}

function route() {
  const hash = (location.hash || '#/dashboard').replace(/^#\//, '');
  return hash.split('?')[0] || 'dashboard';
}

function parseQuery() {
  const h = location.hash || '#/dashboard';
  const idx = h.indexOf('?');
  const out = new URLSearchParams(idx >= 0 ? h.slice(idx + 1) : '');
  return out;
}

function formatDate(s) {
  if (!s) return '';
  return String(s);
}

function boolLabel(v) {
  return v ? '是' : '否';
}

function loading(title = '加载中…') {
  render(`<article aria-busy="true">${esc(title)}</article>`);
}

function errorBox(err) {
  return `<article class="card"><strong>出错了</strong><p class="muted">${esc(
    err?.message || String(err),
  )}</p></article>`;
}

async function renderDashboard() {
  setActiveNav('dashboard');
  loading('加载 Dashboard…');
  try {
    const [data, alerts] = await Promise.all([api('/api/dashboard'), api('/api/alerts')]);
    render(`
      <section>
        <h2>Dashboard</h2>
        <div class="grid-cards">
          ${card('宿舍总数', data.dormTotal)}
          ${card('房间总数', data.roomTotal)}
          ${card('总床位数', data.bedTotal)}
          ${card('当前入住人数', data.currentOccupancy)}
          ${card('空床数', data.emptyBeds)}
          ${card('风险人数(<=60天)', data.riskPeople)}
          ${card('风险 Red(<=30天)', data.riskRed)}
          ${card('风险 Yellow(31~60天)', data.riskYellow)}
          ${card('宿舍合同到期(<=30天)', data.leaseExpiring30)}
          ${card('宿舍合同到期(<=60天)', data.leaseExpiring60)}
          ${card('可用车辆数', data.availableVehicles)}
        </div>
        <p class="muted">说明：风险分级口径为 maxStayDate 距今天的剩余天数（<=30 为 Red，31~60 为 Yellow，>60 为 Green）。</p>
        <article class="card">
          <h3 style="margin-bottom:.5rem">预警清单（Phase 2）</h3>
          <div class="grid" style="gap:1rem">
            <div>
              <h4>停留风险 Red（<=30天）</h4>
              ${alerts.riskRed.length ? `
                <ul>
                  ${alerts.riskRed.slice(0, 10).map(x => `<li><span class="badge red">Red</span> ${esc(x.chineseName)}/${esc(x.englishName)} - 剩余 ${esc(x.daysLeft)} 天（${esc(x.maxStayDate)}）</li>`).join('')}
                </ul>
              ` : `<p class="muted">暂无</p>`}
            </div>
            <div>
              <h4>停留风险 Yellow（31~60天）</h4>
              ${alerts.riskYellow.length ? `
                <ul>
                  ${alerts.riskYellow.slice(0, 10).map(x => `<li><span class="badge yellow">Yellow</span> ${esc(x.chineseName)}/${esc(x.englishName)} - 剩余 ${esc(x.daysLeft)} 天（${esc(x.maxStayDate)}）</li>`).join('')}
                </ul>
              ` : `<p class="muted">暂无</p>`}
            </div>
            <div>
              <h4>宿舍合同到期（<=60天）</h4>
              ${alerts.leaseExpiring60.length ? `
                <ul>
                  ${alerts.leaseExpiring60.slice(0, 10).map(x => `<li><span class="badge yellow">Lease</span> ${esc(x.name)} - 剩余 ${esc(x.daysLeft)} 天（${esc(x.leaseEndDate)}）</li>`).join('')}
                </ul>
              ` : `<p class="muted">暂无</p>`}
            </div>
          </div>
          <p class="muted">仅展示前 10 条，可在“签证与停留”页查看完整数据并维护 Stay。</p>
        </article>
      </section>
    `);
  } catch (err) {
    render(errorBox(err));
  }
}

function card(title, value) {
  return `<div class="card"><div class="muted">${esc(title)}</div><div style="font-size:1.8rem;font-weight:700">${esc(
    value,
  )}</div></div>`;
}

async function renderDorms() {
  setActiveNav('dorms');
  loading('加载宿舍…');
  try {
    const dorms = await api('/api/dorms');
    render(`
      <section>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
          <h2>宿舍</h2>
          <button id="btnNewDorm">新增宿舍</button>
        </div>
        <article class="card">
          <div style="overflow:auto">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>名称</th><th>类型</th><th>地址</th><th>租期开始</th><th>租期结束</th><th>状态</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${dorms
                  .map(
                    (d) => `
                  <tr>
                    <td>${esc(d.id)}</td>
                    <td>${esc(d.name)}</td>
                    <td>${esc(d.type)}</td>
                    <td>${esc(d.address)}</td>
                    <td>${esc(formatDate(d.lease_start_date))}</td>
                    <td>${esc(formatDate(d.lease_end_date))}</td>
                    <td>${esc(d.status)}</td>
                    <td class="row-actions">
                      <button class="secondary" data-action="edit" data-id="${esc(d.id)}">编辑</button>
                      <button class="contrast" data-action="delete" data-id="${esc(d.id)}">删除</button>
                    </td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      ${dormModal()}
    `);

    qs('#btnNewDorm').addEventListener('click', () => openDormModal());
    qs('#dormModalClose').addEventListener('click', closeDormModal);
    qs('#dormForm').addEventListener('submit', submitDormForm);

    qs('#app').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (action === 'edit') {
        const dorm = dorms.find((x) => String(x.id) === String(id));
        openDormModal(dorm);
      } else if (action === 'delete') {
        if (!confirm('确认删除该宿舍？（会级联删除房间）')) return;
        await api(`/api/dorms/${id}`, { method: 'DELETE' });
        await renderDorms();
      }
    });
  } catch (err) {
    render(errorBox(err));
  }
}

function dormModal() {
  return `
  <dialog id="dormModal">
    <article>
      <header>
        <button aria-label="Close" rel="prev" id="dormModalClose"></button>
        <h3 id="dormModalTitle">新增宿舍</h3>
      </header>
      <form id="dormForm">
        <input type="hidden" id="dormId" />
        <label>名称 <input id="dormName" required /></label>
        <label>类型 <input id="dormType" required placeholder="Apartment/House/Hotel..." /></label>
        <label>地址 <input id="dormAddress" required /></label>
        <label>租期开始 <input id="dormLeaseStart" type="date" /></label>
        <label>租期结束 <input id="dormLeaseEnd" type="date" /></label>
        <label>状态
          <select id="dormStatus">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </label>
        <footer style="display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap">
          <button type="button" class="secondary" id="dormCancel">取消</button>
          <button type="submit" id="dormSubmit">保存</button>
        </footer>
      </form>
    </article>
  </dialog>`;
}

function openDormModal(dorm) {
  const dlg = qs('#dormModal');
  qs('#dormModalTitle').textContent = dorm ? `编辑宿舍 #${dorm.id}` : '新增宿舍';
  qs('#dormId').value = dorm?.id ?? '';
  qs('#dormName').value = dorm?.name ?? '';
  qs('#dormType').value = dorm?.type ?? '';
  qs('#dormAddress').value = dorm?.address ?? '';
  qs('#dormLeaseStart').value = dorm?.lease_start_date ?? '';
  qs('#dormLeaseEnd').value = dorm?.lease_end_date ?? '';
  qs('#dormStatus').value = dorm?.status ?? 'active';
  qs('#dormCancel').onclick = closeDormModal;
  dlg.showModal();
}

function closeDormModal() {
  qs('#dormModal').close();
}

async function submitDormForm(e) {
  e.preventDefault();
  const id = qs('#dormId').value;
  const payload = {
    name: qs('#dormName').value.trim(),
    type: qs('#dormType').value.trim(),
    address: qs('#dormAddress').value.trim(),
    lease_start_date: qs('#dormLeaseStart').value || null,
    lease_end_date: qs('#dormLeaseEnd').value || null,
    status: qs('#dormStatus').value,
  };
  try {
    if (id) {
      await api(`/api/dorms/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/dorms', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeDormModal();
    await renderDorms();
  } catch (err) {
    alert(err.message || String(err));
  }
}

async function renderRooms() {
  setActiveNav('rooms');
  loading('加载房间…');
  try {
    const [rooms, dorms] = await Promise.all([api('/api/rooms'), api('/api/dorms')]);
    const dormMap = new Map(dorms.map((d) => [d.id, d]));
    render(`
      <section>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
          <h2>房间</h2>
          <button id="btnNewRoom">新增房间</button>
        </div>
        <article class="card">
          <div style="overflow:auto">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>宿舍</th><th>房间名</th><th>类型</th><th>床位数</th><th>性别限制</th><th>状态</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${rooms
                  .map((r) => {
                    const dorm = dormMap.get(r.dorm_id);
                    return `
                      <tr>
                        <td>${esc(r.id)}</td>
                        <td>${esc(dorm ? `${dorm.name} (#${dorm.id})` : `#${r.dorm_id}`)}</td>
                        <td>${esc(r.room_name)}</td>
                        <td>${esc(r.room_type)}</td>
                        <td>${esc(r.bed_count)}</td>
                        <td>${esc(r.gender_limit)}</td>
                        <td>${esc(r.status)}</td>
                        <td class="row-actions">
                          <button class="secondary" data-action="edit" data-id="${esc(r.id)}">编辑</button>
                          <button class="contrast" data-action="delete" data-id="${esc(r.id)}">删除</button>
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      ${roomModal(dorms)}
    `);

    qs('#btnNewRoom').addEventListener('click', () => openRoomModal(null, dorms));
    qs('#roomModalClose').addEventListener('click', closeRoomModal);
    qs('#roomForm').addEventListener('submit', (e) => submitRoomForm(e, dorms));

    qs('#app').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const room = rooms.find((x) => String(x.id) === String(id));
      if (action === 'edit') {
        openRoomModal(room, dorms);
      } else if (action === 'delete') {
        if (!confirm('确认删除该房间？')) return;
        await api(`/api/rooms/${id}`, { method: 'DELETE' });
        await renderRooms();
      }
    });
  } catch (err) {
    render(errorBox(err));
  }
}

function roomModal(dorms) {
  const opts = dorms
    .map((d) => `<option value="${esc(d.id)}">${esc(d.name)} (#${esc(d.id)})</option>`)
    .join('');
  return `
  <dialog id="roomModal">
    <article>
      <header>
        <button aria-label="Close" rel="prev" id="roomModalClose"></button>
        <h3 id="roomModalTitle">新增房间</h3>
      </header>
      <form id="roomForm">
        <input type="hidden" id="roomId" />
        <label>宿舍
          <select id="roomDormId" required>${opts}</select>
        </label>
        <label>房间名 <input id="roomName" required placeholder="101 / A-1..." /></label>
        <label>类型 <input id="roomType" required placeholder="Single/Double..." /></label>
        <label>床位数 <input id="roomBedCount" type="number" min="1" required /></label>
        <label>性别限制
          <select id="roomGender">
            <option value="Any">Any</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </label>
        <label>状态
          <select id="roomStatus">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </label>
        <footer style="display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap">
          <button type="button" class="secondary" id="roomCancel">取消</button>
          <button type="submit">保存</button>
        </footer>
      </form>
    </article>
  </dialog>`;
}

function openRoomModal(room, dorms) {
  const dlg = qs('#roomModal');
  qs('#roomModalTitle').textContent = room ? `编辑房间 #${room.id}` : '新增房间';
  qs('#roomId').value = room?.id ?? '';
  qs('#roomDormId').value = room?.dorm_id ?? (dorms[0]?.id ?? '');
  qs('#roomName').value = room?.room_name ?? '';
  qs('#roomType').value = room?.room_type ?? '';
  qs('#roomBedCount').value = room?.bed_count ?? 1;
  qs('#roomGender').value = room?.gender_limit ?? 'Any';
  qs('#roomStatus').value = room?.status ?? 'active';
  qs('#roomCancel').onclick = closeRoomModal;
  dlg.showModal();
}

function closeRoomModal() {
  qs('#roomModal').close();
}

async function submitRoomForm(e, dorms) {
  e.preventDefault();
  const id = qs('#roomId').value;
  const payload = {
    dorm_id: Number(qs('#roomDormId').value),
    room_name: qs('#roomName').value.trim(),
    room_type: qs('#roomType').value.trim(),
    bed_count: Number(qs('#roomBedCount').value),
    gender_limit: qs('#roomGender').value,
    status: qs('#roomStatus').value,
  };
  try {
    if (id) {
      await api(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/rooms', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeRoomModal();
    await renderRooms();
  } catch (err) {
    alert(err.message || String(err));
  }
}

async function renderPeople() {
  setActiveNav('people');
  loading('加载人员…');
  try {
    const people = await api('/api/people');
    render(`
      <section>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
          <h2>人员</h2>
          <button id="btnNewPerson">新增人员</button>
        </div>
        <article class="card">
          <div style="overflow:auto">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>中文名</th><th>英文名</th><th>部门</th><th>类型</th><th>性别</th><th>可驾驶</th><th>可做司机</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${people
                  .map(
                    (p) => `
                  <tr>
                    <td>${esc(p.id)}</td>
                    <td>${esc(p.chinese_name)}</td>
                    <td>${esc(p.english_name)}</td>
                    <td>${esc(p.department)}</td>
                    <td>${esc(p.person_type)}</td>
                    <td>${esc(p.gender)}</td>
                    <td>${esc(boolLabel(p.can_drive))}</td>
                    <td>${esc(boolLabel(p.can_be_driver))}</td>
                    <td class="row-actions">
                      <button class="secondary" data-action="edit" data-id="${esc(p.id)}">编辑</button>
                      <button class="contrast" data-action="delete" data-id="${esc(p.id)}">删除</button>
                    </td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      ${personModal()}
    `);

    qs('#btnNewPerson').addEventListener('click', () => openPersonModal());
    qs('#personModalClose').addEventListener('click', closePersonModal);
    qs('#personForm').addEventListener('submit', submitPersonForm);

    qs('#app').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (action === 'edit') {
        const person = people.find((x) => String(x.id) === String(id));
        openPersonModal(person);
      } else if (action === 'delete') {
        if (!confirm('确认删除该人员？（会影响入住记录）')) return;
        await api(`/api/people/${id}`, { method: 'DELETE' });
        await renderPeople();
      }
    });
  } catch (err) {
    render(errorBox(err));
  }
}

function personModal() {
  return `
  <dialog id="personModal">
    <article>
      <header>
        <button aria-label="Close" rel="prev" id="personModalClose"></button>
        <h3 id="personModalTitle">新增人员</h3>
      </header>
      <form id="personForm">
        <input type="hidden" id="personId" />
        <label>中文名 <input id="personCn" required /></label>
        <label>英文名 <input id="personEn" required /></label>
        <label>部门 <input id="personDept" required /></label>
        <label>人员类型 <input id="personType" required placeholder="外派/访客/…"/></label>
        <label>性别
          <select id="personGender" required>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </label>
        <label><input type="checkbox" id="personCanDrive" /> 可驾驶</label>
        <label><input type="checkbox" id="personCanBeDriver" /> 可做司机</label>
        <footer style="display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap">
          <button type="button" class="secondary" id="personCancel">取消</button>
          <button type="submit">保存</button>
        </footer>
      </form>
    </article>
  </dialog>`;
}

function openPersonModal(person) {
  const dlg = qs('#personModal');
  qs('#personModalTitle').textContent = person ? `编辑人员 #${person.id}` : '新增人员';
  qs('#personId').value = person?.id ?? '';
  qs('#personCn').value = person?.chinese_name ?? '';
  qs('#personEn').value = person?.english_name ?? '';
  qs('#personDept').value = person?.department ?? '';
  qs('#personType').value = person?.person_type ?? '';
  qs('#personGender').value = person?.gender ?? 'Male';
  qs('#personCanDrive').checked = !!person?.can_drive;
  qs('#personCanBeDriver').checked = !!person?.can_be_driver;
  qs('#personCancel').onclick = closePersonModal;
  dlg.showModal();
}

function closePersonModal() {
  qs('#personModal').close();
}

async function submitPersonForm(e) {
  e.preventDefault();
  const id = qs('#personId').value;
  const payload = {
    chinese_name: qs('#personCn').value.trim(),
    english_name: qs('#personEn').value.trim(),
    department: qs('#personDept').value.trim(),
    person_type: qs('#personType').value.trim(),
    gender: qs('#personGender').value,
    can_drive: qs('#personCanDrive').checked,
    can_be_driver: qs('#personCanBeDriver').checked,
  };
  try {
    if (id) {
      await api(`/api/people/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/people', { method: 'POST', body: JSON.stringify(payload) });
    }
    closePersonModal();
    await renderPeople();
  } catch (err) {
    alert(err.message || String(err));
  }
}

async function renderAllocations() {
  setActiveNav('allocations');
  loading('加载入住分配…');
  try {
    const [allocations, people, dorms, rooms] = await Promise.all([
      api('/api/allocations'),
      api('/api/people'),
      api('/api/dorms'),
      api('/api/rooms'),
    ]);
    const peopleMap = new Map(people.map((p) => [p.id, p]));
    const dormMap = new Map(dorms.map((d) => [d.id, d]));
    const roomMap = new Map(rooms.map((r) => [r.id, r]));

    render(`
      <section>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
          <h2>入住分配</h2>
          <button id="btnNewAllocation">新增入住</button>
        </div>
        <article class="card">
          <div style="overflow:auto">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>人员</th><th>宿舍</th><th>房间</th><th>入住日期</th><th>退房日期</th><th>状态</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${allocations
                  .map((a) => {
                    const p = peopleMap.get(a.person_id);
                    const d = dormMap.get(a.dorm_id);
                    const r = roomMap.get(a.room_id);
                    return `
                      <tr>
                        <td>${esc(a.id)}</td>
                        <td>${esc(p ? `${p.chinese_name}/${p.english_name} (#${p.id})` : `#${a.person_id}`)}</td>
                        <td>${esc(d ? `${d.name} (#${d.id})` : `#${a.dorm_id}`)}</td>
                        <td>${esc(r ? `${r.room_name} (#${r.id})` : `#${a.room_id}`)}</td>
                        <td>${esc(formatDate(a.check_in_date))}</td>
                        <td>${esc(formatDate(a.check_out_date))}</td>
                        <td>${esc(a.status)}</td>
                        <td class="row-actions">
                          ${
                            a.status === 'active'
                              ? `<button class="secondary" data-action="checkout" data-id="${esc(
                                  a.id,
                                )}">退房</button>`
                              : ''
                          }
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      ${allocationModal(people, dorms, rooms)}
    `);

    qs('#btnNewAllocation').addEventListener('click', () => openAllocationModal(people, dorms, rooms));
    qs('#allocationModalClose').addEventListener('click', closeAllocationModal);
    qs('#allocationCancel').addEventListener('click', closeAllocationModal);
    qs('#allocationDorm').addEventListener('change', () => refreshRoomOptions(dorms, rooms));
    qs('#allocationForm').addEventListener('submit', submitAllocationForm);

    qs('#app').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action="checkout"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const checkOutDate = prompt('请输入退房日期（YYYY-MM-DD）', new Date().toISOString().slice(0, 10));
      if (!checkOutDate) return;
      await api(`/api/allocations/${id}/checkout`, {
        method: 'POST',
        body: JSON.stringify({ check_out_date: checkOutDate }),
      });
      await renderAllocations();
    });
  } catch (err) {
    render(errorBox(err));
  }
}

function allocationModal(people, dorms, rooms) {
  const peopleOpts = people
    .map((p) => `<option value="${esc(p.id)}">${esc(p.chinese_name)}/${esc(p.english_name)} (#${esc(p.id)})</option>`)
    .join('');
  const dormOpts = dorms
    .map((d) => `<option value="${esc(d.id)}">${esc(d.name)} (#${esc(d.id)})</option>`)
    .join('');

  return `
  <dialog id="allocationModal">
    <article>
      <header>
        <button aria-label="Close" rel="prev" id="allocationModalClose"></button>
        <h3>新增入住</h3>
      </header>
      <form id="allocationForm">
        <label>人员
          <select id="allocationPerson" required>${peopleOpts}</select>
        </label>
        <label>宿舍
          <select id="allocationDorm" required>${dormOpts}</select>
        </label>
        <label>房间
          <select id="allocationRoom" required></select>
        </label>
        <label>入住日期
          <input id="allocationCheckIn" type="date" required />
        </label>
        <footer style="display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap">
          <button type="button" class="secondary" id="allocationCancel">取消</button>
          <button type="submit">保存</button>
        </footer>
      </form>
      <p class="muted">提示：创建时会校验“房间属于宿舍/不超员/性别匹配/不可重复入住”。</p>
    </article>
  </dialog>`;
}

function openAllocationModal(people, dorms, rooms) {
  const dlg = qs('#allocationModal');
  qs('#allocationCheckIn').value = new Date().toISOString().slice(0, 10);
  refreshRoomOptions(dorms, rooms);
  dlg.showModal();
}

function closeAllocationModal() {
  qs('#allocationModal').close();
}

function refreshRoomOptions(dorms, rooms) {
  const dormId = Number(qs('#allocationDorm').value);
  const roomSel = qs('#allocationRoom');
  const available = rooms.filter((r) => Number(r.dorm_id) === dormId);
  roomSel.innerHTML = available
    .map((r) => `<option value="${esc(r.id)}">${esc(r.room_name)} (#${esc(r.id)}) - bed:${esc(r.bed_count)} gender:${esc(r.gender_limit)}</option>`)
    .join('');
}

async function submitAllocationForm(e) {
  e.preventDefault();
  const payload = {
    person_id: Number(qs('#allocationPerson').value),
    dorm_id: Number(qs('#allocationDorm').value),
    room_id: Number(qs('#allocationRoom').value),
    check_in_date: qs('#allocationCheckIn').value,
  };
  try {
    await api('/api/allocations', { method: 'POST', body: JSON.stringify(payload) });
    closeAllocationModal();
    await renderAllocations();
  } catch (err) {
    alert(err.message || String(err));
  }
}

function riskBadge(daysLeft) {
  if (daysLeft <= 30) return `<span class="badge red">Red</span>`;
  if (daysLeft <= 60) return `<span class="badge yellow">Yellow</span>`;
  return `<span class="badge green">Green</span>`;
}

async function renderStay() {
  setActiveNav('stay');
  loading('加载签证与停留…');
  try {
    const [stays, people] = await Promise.all([api('/api/stay'), api('/api/people')]);
    const stayMap = new Map(stays.map((s) => [s.person_id, s]));
    const today = new Date();
    const toDaysLeft = (d) => {
      if (!d) return null;
      const dt = new Date(`${d}T00:00:00`);
      return Math.floor((dt - today) / 86400000);
    };

    render(`
      <section>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
          <h2>签证与停留（Stay）</h2>
          <button id="btnUpsertStay">新增/更新 Stay</button>
        </div>
        <article class="card">
          <div style="overflow:auto">
            <table>
              <thead>
                <tr>
                  <th>人员</th><th>部门</th><th>签证类型</th><th>到达</th><th>计划离境</th><th>最晚停留</th><th>剩余天数</th><th>风险</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${people
                  .map((p) => {
                    const s = stayMap.get(p.id);
                    const daysLeft = s ? toDaysLeft(s.max_stay_date) : null;
                    return `
                      <tr>
                        <td>${esc(p.chinese_name)}/${esc(p.english_name)} (#${esc(p.id)})</td>
                        <td>${esc(p.department)}</td>
                        <td>${esc(s?.visa_type || '')}</td>
                        <td>${esc(formatDate(s?.arrival_date || ''))}</td>
                        <td>${esc(formatDate(s?.planned_leave_date || ''))}</td>
                        <td>${esc(formatDate(s?.max_stay_date || ''))}</td>
                        <td>${daysLeft === null ? '' : esc(daysLeft)}</td>
                        <td>${daysLeft === null ? '' : riskBadge(daysLeft)}</td>
                        <td class="row-actions">
                          <button class="secondary" data-action="edit" data-id="${esc(p.id)}">编辑</button>
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      ${stayModal(people)}
    `);

    qs('#btnUpsertStay').addEventListener('click', () => openStayModal(null, people, stayMap));
    qs('#stayModalClose').addEventListener('click', closeStayModal);
    qs('#stayCancel').addEventListener('click', closeStayModal);
    qs('#stayForm').addEventListener('submit', submitStayForm);

    qs('#app').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action="edit"]');
      if (!btn) return;
      const personId = Number(btn.getAttribute('data-id'));
      const s = stayMap.get(personId) || null;
      openStayModal({ personId, stay: s }, people, stayMap);
    });
  } catch (err) {
    render(errorBox(err));
  }
}

function stayModal(people) {
  const peopleOpts = people
    .map((p) => `<option value="${esc(p.id)}">${esc(p.chinese_name)}/${esc(p.english_name)} (#${esc(p.id)})</option>`)
    .join('');
  return `
  <dialog id="stayModal">
    <article>
      <header>
        <button aria-label="Close" rel="prev" id="stayModalClose"></button>
        <h3 id="stayModalTitle">新增/更新 Stay</h3>
      </header>
      <form id="stayForm">
        <label>人员
          <select id="stayPerson" required>${peopleOpts}</select>
        </label>
        <label>签证类型 <input id="stayVisaType" required placeholder="B1/L1/H1B/..." /></label>
        <label>到达日期 <input id="stayArrival" type="date" required /></label>
        <label>计划离境 <input id="stayPlannedLeave" type="date" required /></label>
        <label>最晚停留（maxStayDate）<input id="stayMax" type="date" required /></label>
        <footer style="display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap">
          <button type="button" class="secondary" id="stayCancel">取消</button>
          <button type="submit">保存</button>
        </footer>
      </form>
      <p class="muted">保存后会覆盖该人员已有 Stay（Upsert）。风险口径：maxStayDate 距今天剩余天数。</p>
    </article>
  </dialog>`;
}

function openStayModal(ctx, people, stayMap) {
  const dlg = qs('#stayModal');
  const personId = ctx?.personId ?? Number(qs('#stayPerson').value || people[0]?.id || 0);
  const s = ctx?.stay ?? stayMap.get(personId) ?? null;
  qs('#stayModalTitle').textContent = s ? `更新 Stay（人员 #${personId}）` : '新增/更新 Stay';
  qs('#stayPerson').value = String(personId || (people[0]?.id ?? ''));
  const today = new Date().toISOString().slice(0, 10);
  qs('#stayVisaType').value = s?.visa_type ?? '';
  qs('#stayArrival').value = s?.arrival_date ?? today;
  qs('#stayPlannedLeave').value = s?.planned_leave_date ?? today;
  qs('#stayMax').value = s?.max_stay_date ?? today;
  dlg.showModal();
}

function closeStayModal() {
  qs('#stayModal').close();
}

async function submitStayForm(e) {
  e.preventDefault();
  const payload = {
    person_id: Number(qs('#stayPerson').value),
    visa_type: qs('#stayVisaType').value.trim(),
    arrival_date: qs('#stayArrival').value,
    planned_leave_date: qs('#stayPlannedLeave').value,
    max_stay_date: qs('#stayMax').value,
  };
  try {
    await api('/api/stay', { method: 'POST', body: JSON.stringify(payload) });
    closeStayModal();
    await renderStay();
  } catch (err) {
    alert(err.message || String(err));
  }
}

async function renderRoute() {
  const r = route();
  const q = parseQuery();
  void q;
  if (r === 'dashboard') return renderDashboard();
  if (r === 'dorms') return renderDorms();
  if (r === 'rooms') return renderRooms();
  if (r === 'people') return renderPeople();
  if (r === 'stay') return renderStay();
  if (r === 'allocations') return renderAllocations();
  location.hash = '#/dashboard';
}

window.addEventListener('hashchange', renderRoute);
renderRoute();

