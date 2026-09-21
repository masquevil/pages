// 无锡周末去哪儿玩 —— 前端逻辑（手写维护）：筛选 / 排序 / 渲染
// 依赖 assets/data.js 提供的 window.PLACES 与 window.CITY_GROUPS
(function () {
  const PLACES = window.PLACES || [];
  const CITY_GROUPS = window.CITY_GROUPS || [];
  const MONTH_NAMES = ['1 月','2 月','3 月','4 月','5 月','6 月','7 月','8 月','9 月','10 月','11 月','12 月'];
  const DRIVE_BUCKETS = [
    { k: 'all', label: '全部', f: () => true },
    { k: 'le1', label: '≤1 小时', f: (h) => h <= 1 },
    { k: '1-2', label: '1–2 小时', f: (h) => h > 1 && h <= 2 },
    { k: '2-3', label: '2–3 小时', f: (h) => h > 2 && h <= 3 },
    { k: 'gt3', label: '3 小时以上', f: (h) => h > 3 }
  ];
  const STAY_BUCKETS = [
    { k: 'all', label: '全部', f: () => true },
    { k: 'half', label: '半日', f: (h) => h <= 6 },
    { k: 'day', label: '1 天', f: (h) => h > 6 && h <= 12 },
    { k: 'night', label: '过夜 1–2 天', f: (h) => h > 12 && h <= 36 },
    { k: 'multi', label: '2 天以上', f: (h) => h > 36 }
  ];
  const SORTS = [
    { k: 'drive', label: '车程（近→远）' },
    { k: 'month', label: '月份（最早可去）' },
    { k: 'stay', label: '时长（短→长）' },
    { k: 'province', label: '省份' },
    { k: 'city', label: '城市' },
    { k: 'place', label: '地点' },
    { k: 'theme', label: '主题' }
  ];

  // 状态只存在内存里：刷新页面即重置，不做本地持久化
  const state = { provinces: [], city: '', months: [], themes: [], drive: 'all', stay: 'all', q: '', sort: 'drive', dir: 1 };

  const $ = (id) => document.getElementById(id);
  const uniqSorted = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, 'zh'));
  // 多值单元格（省份 / 城市 / 主题）按行渲染，避免「江苏·浙江」「露营 · 观星」并排挤在一行
  const lines = (arr) => (arr || []).map((v) => '<span class="ln">' + v + '</span>').join('');
  // 省份顺序取分组顺序（江苏/上海/浙江/安徽/江西），兜底补上未分组的省
  const PROVINCES = (() => {
    const listed = CITY_GROUPS.map((g) => g.province);
    const rest = uniqSorted(PLACES.flatMap((p) => p.provinces)).filter((v) => listed.indexOf(v) < 0);
    return listed.concat(rest);
  })();
  const THEMES = uniqSorted(PLACES.flatMap((p) => p.themes));

  function chipGroup(host, items, isOn, onPick) {
    host.innerHTML = '';
    items.forEach((it) => {
      const b = document.createElement('button');
      b.className = 'chip' + (isOn(it) ? ' on' : '');
      b.textContent = it.label;
      b.title = it.label;
      b.onclick = () => { onPick(it); render(); };
      host.appendChild(b);
    });
  }

  function toggle(list, v) {
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
    else list.push(v);
  }

  function earliestMonth(p) {
    return Math.min.apply(null, p.months);
  }

  function sortValue(p, key) {
    switch (key) {
      case 'drive': return p.driveHours;
      case 'stay': return p.stayHours;
      case 'month': return earliestMonth(p);
      case 'province': return p.provinceLabel;
      case 'city': return p.cityLabel;
      case 'theme': return p.theme;
      default: return p.place;
    }
  }

  function pass(p) {
    if (state.provinces.length && !state.provinces.some((v) => p.provinces.includes(v))) return false;
    if (state.city && p.cities.indexOf(state.city) < 0) return false;
    if (state.months.length && !state.months.some((m) => p.months.includes(m))) return false;
    if (state.themes.length && !state.themes.some((t) => p.themes.includes(t))) return false;
    if (!DRIVE_BUCKETS.find((b) => b.k === state.drive).f(p.driveHours)) return false;
    if (!STAY_BUCKETS.find((b) => b.k === state.stay).f(p.stayHours)) return false;
    if (state.q) {
      const hay = [p.place, p.cityLabel, p.provinceLabel, p.hl, p.note, p.theme, p.monthLabel, p.source]
        .join(' ').toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function monthCell(p) {
    if (p.months.length === 12) return '全年';
    return '<div>' + p.monthLabel + '</div>' +
      p.months.map((m) => '<span class="mb">' + m + '</span>').join('');
  }

  function noteCell(p) {
    let html = p.note;
    if (p.source) {
      html += ' ' + (p.link
        ? '<a href="' + p.link + '" target="_blank" rel="noopener">' + p.source + '</a>'
        : '<span style="opacity:.75">' + p.source + '</span>');
    }
    if (p.seconds && p.seconds.length) {
      html += '<div style="opacity:.75">画面出现：' + p.seconds.map((s) => s + 's').join('、') + '</div>';
    }
    return html;
  }

  function renderCitySelect() {
    const sel = $('citySelect');
    // 选了省份时，下拉只列这些省的城市；城市与省份冲突则自动清空
    const groups = state.provinces.length
      ? CITY_GROUPS.filter((g) => state.provinces.indexOf(g.province) >= 0)
      : CITY_GROUPS;
    const cities = groups.reduce((acc, g) => acc.concat(g.cities), []);
    if (state.city && cities.indexOf(state.city) < 0) state.city = '';
    const html = ['<option value="">全部城市</option>'].concat(groups.map((g) =>
      '<optgroup label="' + g.province + '">' +
      g.cities.slice().sort((a, b) => a.localeCompare(b, 'zh'))
        .map((c) => '<option value="' + c + '">' + c + '</option>').join('') +
      '</optgroup>')).join('');
    if (sel.dataset.sig !== html) {
      sel.innerHTML = html;
      sel.dataset.sig = html;
    }
    sel.value = state.city;
  }

  function render() {
    chipGroup($('provinceChips'), PROVINCES.map((v) => ({ label: v, v: v })),
      (it) => state.provinces.includes(it.v), (it) => toggle(state.provinces, it.v));
    renderCitySelect();
    chipGroup($('monthChips'), MONTH_NAMES.map((label, i) => ({ label: label, m: i + 1 })),
      (it) => state.months.includes(it.m), (it) => toggle(state.months, it.m));
    chipGroup($('stayChips'), STAY_BUCKETS, (it) => state.stay === it.k, (it) => { state.stay = it.k; });
    chipGroup($('driveChips'), DRIVE_BUCKETS, (it) => state.drive === it.k, (it) => { state.drive = it.k; });
    chipGroup($('themeChips'), THEMES.map((t) => ({ label: t, t: t })),
      (it) => state.themes.includes(it.t), (it) => toggle(state.themes, it.t));

    const sel = $('sortKey');
    if (sel.options.length !== SORTS.length) {
      sel.innerHTML = SORTS.map((s) => '<option value="' + s.k + '">' + s.label + '</option>').join('');
    }
    sel.value = state.sort;
    $('sortDir').textContent = state.dir > 0 ? '升序 ↑' : '降序 ↓';
    if ($('q').value !== state.q) $('q').value = state.q;

    const rows = PLACES.filter(pass).sort((a, b) => {
      const va = sortValue(a, state.sort), vb = sortValue(b, state.sort);
      let c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'zh');
      if (c === 0) c = a.driveHours - b.driveHours;
      return c * state.dir;
    });

    $('tbody').innerHTML = rows.map((p) => '<tr>' +
      '<td class="prov">' + lines(p.provinces) + '</td>' +
      '<td class="city">' + lines(p.cities) + '</td>' +
      '<td class="place">' + p.place + '</td>' +
      '<td class="month">' + monthCell(p) + '</td>' +
      '<td class="theme-cell">' + lines(p.themes) + '</td>' +
      '<td class="drive">' + p.driveLabel + '</td>' +
      '<td class="stay">' + p.stayLabel + '</td>' +
      '<td class="hl">' + p.hl + '</td>' +
      '<td class="note">' + noteCell(p) + '</td>' +
      '</tr>').join('');

    $('total').textContent = PLACES.length;
    $('filtered').textContent = rows.length === PLACES.length ? '' : '（筛出 ' + rows.length + ' 个）';
    $('empty').hidden = rows.length > 0;
    $('tbl').style.display = rows.length ? '' : 'none';

    document.querySelectorAll('thead th.sortable').forEach((th) => {
      const on = th.dataset.key === state.sort;
      th.classList.toggle('sorted', on);
      const arw = th.querySelector('.arw');
      if (arw) arw.textContent = on ? (state.dir > 0 ? '↑' : '↓') : '↕';
    });
  }

  // 点表头排序（仅可排序列；亮点/备注不参与）
  document.querySelectorAll('thead th.sortable').forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.key;
      if (state.sort === k) state.dir = -state.dir;
      else { state.sort = k; state.dir = 1; }
      render();
    };
  });

  $('sortKey').onchange = (e) => { state.sort = e.target.value; render(); };
  $('sortDir').onclick = () => { state.dir = -state.dir; render(); };
  $('citySelect').onchange = (e) => { state.city = e.target.value; render(); };
  $('q').oninput = (e) => { state.q = e.target.value; render(); };
  $('reset').onclick = () => {
    Object.assign(state, { provinces: [], city: '', months: [], themes: [], drive: 'all', stay: 'all', q: '', sort: 'drive', dir: 1 });
    render();
  };

  render();
})();
