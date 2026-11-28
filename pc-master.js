/**
 * PC 管理画面 — 物件マスター管理タブ
 * window.PcMaster.mount(container, callApi) で使う。
 * pc-admin.html が「物件」タブとして読み込む（P-A2 が main に入ってから組み込む）。
 *
 * callApi(body): Promise<object>  ← pc-admin.html の callApi と同じシグネチャ
 */
(function(global) {
  'use strict';

  // esc は pc-admin.html と同じ実装だが独立して持つ
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var BOOL_COLS   = ['CalendarSyncEnabled', 'NotifyEnabled', 'AlbumRequired', 'Active', 'AnomalyMuted'];
  var AMOUNT_COLS = ['CleaningUnitPrice', 'ExtraFee', 'FixedCleaningCost'];
  var URL_COLS    = ['iCalURL', 'ManualUrl'];

  // cleaninghub コード.js と同じ判定: 空欄は有効、ON/TRUE/1/YES/ACTIVE は有効、それ以外は無効
  function isActive_(v) {
    var s = String(v == null ? '' : v).trim().toUpperCase();
    if (!s) return true;
    return s === 'ON' || s === 'TRUE' || s === '1' || s === 'YES' || s === 'ACTIVE';
  }

  // 列のグループ定義（編集フォームで使う）
  var COL_GROUPS = [
    {
      label: '基本情報',
      cols: ['PropertyName', 'DisplayName', 'Source', 'Area', 'Active']
    },
    {
      label: 'URL',
      cols: ['iCalURL', 'ManualUrl', 'ManualShortUrl']
    },
    {
      label: '清掃設定',
      cols: ['CheckinTime', 'CleanHours', 'DefaultCleaner', 'LinenType']
    },
    {
      label: 'オーナー',
      cols: ['Owner', 'OwnerLineId']
    },
    {
      label: 'カレンダー',
      cols: ['CalendarId', 'CalendarSyncEnabled', 'AirhostListingCore']
    },
    {
      label: '通知・アルバム',
      cols: ['NotifyEnabled', 'AlbumRequired', 'AnomalyMuted', 'OtherTags']
    },
    {
      label: '請求',
      cols: ['CleaningUnitPrice', 'ExtraFee', 'FixedCleaningCost', 'BillingTo', 'DefaultInvoiceDate', 'DefaultPaidDate']
    },
    {
      label: 'パスワード',
      cols: ['Password']
    }
  ];

  // ── CSS ─────────────────────────────────────────────────────────────────────

  var CSS = [
    '.pm-wrap { font-size: 14px; }',
    '.pm-toolbar { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; align-items: center; }',
    '.pm-toolbar input[type=text] { padding: 0.35rem 0.6rem; border: 1px solid #e0e0e0; border-radius: 6px;',
    '  font-size: 0.88rem; font-family: inherit; min-width: 180px; }',
    '.pm-toolbar select { padding: 0.35rem 0.5rem; border: 1px solid #e0e0e0; border-radius: 6px;',
    '  font-size: 0.88rem; font-family: inherit; }',
    '.pm-btn { padding: 0.4rem 0.9rem; border: 1px solid #00a84f; border-radius: 6px;',
    '  background: #fff; color: #00a84f; cursor: pointer; font-size: 0.85rem; font-family: inherit; font-weight: bold; }',
    '.pm-btn:disabled { opacity: 0.4; cursor: not-allowed; }',
    '.pm-btn-primary { background: #00a84f; color: #fff; }',
    '.pm-btn-primary:hover:not(:disabled) { background: #008a3f; }',
    '.pm-tbl-wrap { overflow-x: auto; }',
    '.pm-tbl { width: 100%; border-collapse: collapse; min-width: 600px; background: #fff;',
    '  border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }',
    '.pm-tbl th { background: #f5f7fa; padding: 0.5rem 0.75rem; text-align: left;',
    '  font-size: 0.8rem; color: #888; border-bottom: 1px solid #e0e0e0; white-space: nowrap; }',
    '.pm-tbl td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #e0e0e0; font-size: 0.88rem; vertical-align: middle; }',
    '.pm-tbl tr:last-child td { border-bottom: none; }',
    '.pm-tbl tr:hover td { background: #fafafa; }',
    '.pm-badge-active   { display:inline-block; padding:0.15rem 0.5rem; border-radius:4px;',
    '  background:#d4edda; color:#155724; font-size:0.78rem; font-weight:bold; }',
    '.pm-badge-inactive { display:inline-block; padding:0.15rem 0.5rem; border-radius:4px;',
    '  background:#f0f0f0; color:#888; font-size:0.78rem; }',
    '.pm-link { color: #00a84f; cursor: pointer; text-decoration: underline; border: none;',
    '  background: none; font-size: 0.88rem; font-family: inherit; padding: 0; }',
    '.pm-err  { color: #c00; font-size: 0.88rem; padding: 0.5rem 0; }',
    '.pm-loading { color: #888; padding: 1rem; text-align: center; }',
    '.pm-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex;',
    '  align-items: flex-start; justify-content: center; z-index: 1000; padding-top: 2rem; overflow-y: auto; }',
    '.pm-modal { background: #fff; border-radius: 10px; padding: 1.5rem; width: 100%; max-width: 540px;',
    '  box-shadow: 0 4px 24px rgba(0,0,0,0.15); margin: 0 1rem 2rem; }',
    '.pm-modal h2 { font-size: 1.1rem; margin-bottom: 1rem; }',
    '.pm-group-label { font-size: 0.78rem; font-weight: bold; color: #666; margin: 1rem 0 0.5rem;',
    '  text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.25rem; }',
    '.pm-field { margin-bottom: 0.75rem; }',
    '.pm-field label { display: block; font-size: 0.82rem; color: #555; margin-bottom: 0.2rem; }',
    '.pm-field input, .pm-field select, .pm-field textarea { width: 100%; padding: 0.4rem 0.6rem;',
    '  border: 1px solid #ccc; border-radius: 6px; font-size: 0.88rem; font-family: inherit; }',
    '.pm-field input:focus, .pm-field select:focus { outline: 2px solid #00a84f; outline-offset: 1px; }',
    '.pm-field-err { color: #c00; font-size: 0.8rem; margin-top: 0.2rem; }',
    '.pm-modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem; }',
    '.pm-url-diff { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 0.75rem;',
    '  font-size: 0.82rem; word-break: break-all; margin-bottom: 0.75rem; }',
    '.pm-url-diff .pm-url-label { color: #888; font-size: 0.75rem; margin-bottom: 0.25rem; }',
    '.pm-url-diff .pm-url-val { font-family: monospace; word-break: break-all; }'
  ].join('\n');

  // ── 状態 ──────────────────────────────────────────────────────────────────────

  var state = {
    properties: [],
    choices: { owners: [], linenTypes: [], cleaners: [], areas: [] },
    loading: false,
    err: '',
    searchText: '',
    filterActive: 'TRUE',
    editTarget: null,    // { mode: 'edit'|'add', prop: {...} }
    confirmUrl: null     // { rowNumber, expectedPropertyName, rowToken, oldUrl, newUrl, pendingChanges }
  };

  var container;
  var callApiFn;

  // ── mount ─────────────────────────────────────────────────────────────────────

  function mount(el, callApi) {
    container = el;
    callApiFn = callApi;
    injectStyles();
    render();
    loadProperties();
  }

  function injectStyles() {
    if (document.getElementById('pm-styles')) return;
    var style = document.createElement('style');
    style.id = 'pm-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ── render ────────────────────────────────────────────────────────────────────

  function render() {
    if (!container) return;
    container.innerHTML = buildHtml();
    bindEvents();
  }

  function buildHtml() {
    var rows = filteredProperties();
    var html = '<div class="pm-wrap">';

    // ツールバー
    html += '<div class="pm-toolbar">' +
      '<input type="text" id="pm-search" placeholder="物件名・表示名・オーナー・エリアで検索" value="' + esc(state.searchText) + '">' +
      '<select id="pm-filter-active">' +
        '<option value="">すべて</option>' +
        '<option value="TRUE"' + (state.filterActive === 'TRUE' ? ' selected' : '') + '>有効のみ</option>' +
        '<option value="FALSE"' + (state.filterActive === 'FALSE' ? ' selected' : '') + '>無効のみ</option>' +
      '</select>' +
      '<button class="pm-btn pm-btn-primary" id="pm-btn-add">＋ 新規追加</button>' +
      '<button class="pm-btn" id="pm-btn-reload"' + (state.loading ? ' disabled' : '') + '>更新</button>' +
    '</div>';

    if (state.err) {
      html += '<div class="pm-err">' + esc(state.err) + '</div>';
    }
    if (state.loading) {
      html += '<div class="pm-loading">読み込み中...</div>';
    }

    // 一覧テーブル
    html += '<div class="pm-tbl-wrap"><table class="pm-tbl"><thead><tr>' +
      '<th>#</th><th>物件名</th><th>表示名</th><th>エリア</th><th>オーナー</th>' +
      '<th>状態</th><th>Source</th><th></th>' +
    '</tr></thead><tbody>';

    if (!state.loading && rows.length === 0) {
      html += '<tr><td colspan="8" style="text-align:center;color:#888;padding:1.5rem">該当する物件がありません</td></tr>';
    }

    rows.forEach(function(p) {
      var active = isActive_(p.Active);
      html += '<tr>' +
        '<td>' + esc(p.rowNumber) + '</td>' +
        '<td>' + esc(p.PropertyName) + '</td>' +
        '<td>' + esc(p.DisplayName || '') + '</td>' +
        '<td>' + esc(p.Area || '') + '</td>' +
        '<td>' + esc(p.Owner || '') + '</td>' +
        '<td>' + (active
          ? '<span class="pm-badge-active">有効</span>'
          : '<span class="pm-badge-inactive">無効</span>') + '</td>' +
        '<td>' + esc(p.Source || '') + '</td>' +
        '<td><button class="pm-link" data-action="edit" data-row="' + esc(p.rowNumber) + '">編集</button></td>' +
      '</tr>';
    });

    html += '</tbody></table></div></div>';
    return html;
  }

  function filteredProperties() {
    var q = state.searchText.toLowerCase();
    return state.properties.filter(function(p) {
      if (state.filterActive === 'TRUE'  && !isActive_(p.Active)) return false;
      if (state.filterActive === 'FALSE' &&  isActive_(p.Active)) return false;
      if (!q) return true;
      return (p.PropertyName || '').toLowerCase().includes(q) ||
             (p.DisplayName  || '').toLowerCase().includes(q) ||
             (p.Owner        || '').toLowerCase().includes(q) ||
             (p.Area         || '').toLowerCase().includes(q);
    });
  }

  function bindEvents() {
    var searchEl = document.getElementById('pm-search');
    if (searchEl) searchEl.addEventListener('input', function() {
      state.searchText = searchEl.value;
      render();
    });

    var filterEl = document.getElementById('pm-filter-active');
    if (filterEl) filterEl.addEventListener('change', function() {
      state.filterActive = filterEl.value;
      render();
    });

    var addBtn = document.getElementById('pm-btn-add');
    if (addBtn) addBtn.addEventListener('click', function() {
      openAddModal();
    });

    var reloadBtn = document.getElementById('pm-btn-reload');
    if (reloadBtn) reloadBtn.addEventListener('click', function() {
      loadProperties();
    });

    container.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'edit') {
        var rowNum = Number(btn.dataset.row);
        var prop = state.properties.find(function(p) { return p.rowNumber === rowNum; });
        if (prop) openEditModal(prop);
      }
    });
  }

  // ── API ───────────────────────────────────────────────────────────────────────

  function loadProperties() {
    state.loading = true;
    state.err = '';
    render();
    callApiFn({ action: 'masterGetProperties' }).then(function(r) {
      state.loading = false;
      if (!r.ok) { state.err = 'データ取得エラー: ' + (r.error || '不明'); render(); return; }
      state.properties = r.properties || [];
      state.choices    = r.choices    || { owners: [], linenTypes: [], cleaners: [], areas: [] };
      render();
    }).catch(function(e) {
      state.loading = false;
      state.err = '通信エラー: ' + (e.message || '不明');
      render();
    });
  }

  // ── 編集モーダル ───────────────────────────────────────────────────────────────

  function openEditModal(prop) {
    state.editTarget = { mode: 'edit', prop: prop, changes: {}, fieldErr: {} };
    renderModal();
  }

  function openAddModal() {
    state.editTarget = { mode: 'add', prop: {}, changes: { Active: 'TRUE' }, fieldErr: {} };
    renderModal();
  }

  function renderModal() {
    var t = state.editTarget;
    if (!t) return;

    var isAdd  = t.mode === 'add';
    var title  = isAdd ? '物件を新規追加' : '物件を編集: ' + esc(t.prop.PropertyName || '');

    var html = '<div class="pm-modal-bg" id="pm-modal-bg">' +
      '<div class="pm-modal">' +
      '<h2>' + title + '</h2>';

    COL_GROUPS.forEach(function(grp) {
      html += '<div class="pm-group-label">' + esc(grp.label) + '</div>';
      grp.cols.forEach(function(col) {
        // 既存行では PropertyName は変更不可
        var readOnly = (!isAdd && col === 'PropertyName');
        html += buildField(col, t, readOnly);
      });
    });

    html += '<div id="pm-modal-err" class="pm-err"' + (t.saveErr ? '' : ' hidden') + '>' +
      esc(t.saveErr || '') + '</div>';
    html += '<div class="pm-modal-actions">' +
      '<button class="pm-btn" id="pm-modal-cancel">キャンセル</button>' +
      '<button class="pm-btn pm-btn-primary" id="pm-modal-save">' + (isAdd ? '追加' : '保存') + '</button>' +
    '</div></div></div>';

    var existing = document.getElementById('pm-modal-bg');
    if (existing) existing.remove();

    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstElementChild);

    document.getElementById('pm-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('pm-modal-save').addEventListener('click', handleSave);
    document.getElementById('pm-modal-bg').addEventListener('click', function(e) {
      if (e.target.id === 'pm-modal-bg') closeModal();
    });

    // 入力変更を監視
    var modal = document.getElementById('pm-modal-bg');
    modal.querySelectorAll('[data-col]').forEach(function(el) {
      el.addEventListener('change', function() {
        t.changes[el.dataset.col] = el.value;
        // エリアが既存にない新しい値の場合は console.warn（画面での確認）
        if (el.dataset.col === 'Area' && el.value && state.choices.areas.indexOf(el.value) < 0) {
          el.style.borderColor = '#f0a000';
        } else {
          el.style.borderColor = '';
        }
      });
      el.addEventListener('input', function() {
        t.changes[el.dataset.col] = el.value;
      });
    });
  }

  function buildField(col, t, readOnly) {
    var isAdd = t.mode === 'add';
    var currentVal = isAdd
      ? (t.changes[col] !== undefined ? t.changes[col] : '')
      : (t.changes[col] !== undefined ? t.changes[col] : String(t.prop[col] == null ? '' : t.prop[col]));

    var fieldErr = (t.fieldErr && t.fieldErr[col]) ? t.fieldErr[col] : '';
    var html = '<div class="pm-field">' +
      '<label>' + esc(col) + (readOnly ? ' <span style="color:#aaa;font-size:0.75rem">(変更不可)</span>' : '') + '</label>';

    if (readOnly) {
      html += '<input type="text" value="' + esc(currentVal) + '" disabled>';
    } else if (BOOL_COLS.indexOf(col) >= 0) {
      html += '<select data-col="' + esc(col) + '">' +
        ['', 'TRUE', 'FALSE'].map(function(v) {
          return '<option value="' + esc(v) + '"' + (currentVal === v ? ' selected' : '') + '>' + (v || '—') + '</option>';
        }).join('') +
      '</select>';
    } else if (col === 'Owner') {
      html += buildSelectOrText(col, currentVal, state.choices.owners);
    } else if (col === 'LinenType') {
      html += buildSelectOrText(col, currentVal, state.choices.linenTypes);
    } else if (col === 'DefaultCleaner') {
      html += buildSelectOrText(col, currentVal, state.choices.cleaners);
    } else if (col === 'Password') {
      html += '<input type="password" data-col="' + esc(col) + '" value="' + esc(currentVal) + '" autocomplete="new-password">';
    } else if (AMOUNT_COLS.indexOf(col) >= 0) {
      html += '<input type="number" min="0" step="1" data-col="' + esc(col) + '" value="' + esc(currentVal) + '">';
    } else if (col === 'CleanHours') {
      html += '<input type="number" min="0" step="0.5" data-col="' + esc(col) + '" value="' + esc(currentVal) + '">';
    } else if (col === 'CheckinTime') {
      html += '<input type="text" placeholder="HH:mm" data-col="' + esc(col) + '" value="' + esc(currentVal) + '">';
    } else if (URL_COLS.indexOf(col) >= 0) {
      html += '<input type="url" placeholder="https://..." data-col="' + esc(col) + '" value="' + esc(currentVal) + '">';
    } else {
      html += '<input type="text" data-col="' + esc(col) + '" value="' + esc(currentVal) + '">';
    }

    if (fieldErr) html += '<div class="pm-field-err">' + esc(fieldErr) + '</div>';
    html += '</div>';
    return html;
  }

  function buildSelectOrText(col, currentVal, options) {
    var html = '<select data-col="' + esc(col) + '">';
    html += '<option value="">—</option>';
    var found = false;
    options.forEach(function(o) {
      var sel = currentVal === o ? ' selected' : '';
      if (sel) found = true;
      html += '<option value="' + esc(o) + '"' + sel + '>' + esc(o) + '</option>';
    });
    // 現在の値がマスターにない場合は選択肢に追加
    if (currentVal && !found) {
      html += '<option value="' + esc(currentVal) + '" selected>' + esc(currentVal) + '</option>';
    }
    html += '</select>';
    return html;
  }

  function closeModal() {
    state.editTarget = null;
    state.confirmUrl = null;
    var el = document.getElementById('pm-modal-bg');
    if (el) el.remove();
  }

  // ── 保存処理 ──────────────────────────────────────────────────────────────────

  function handleSave() {
    var t = state.editTarget;
    if (!t) return;

    // 未変更の changes（空文字も含む）を整理（入力が一度もされていない項目は送らない）
    var changes = Object.assign({}, t.changes);

    if (t.mode === 'add') {
      doAdd(changes);
    } else {
      doUpdate(t.prop, changes, false);
    }
  }

  function doUpdate(prop, changes, confirmUrlChange, confirmDuplicate) {
    // 変更なしの列は除去（現在値と同じなら送らない）
    var actualChanges = {};
    Object.keys(changes).forEach(function(col) {
      if (col === 'PropertyName') return;
      var newVal = String(changes[col] == null ? '' : changes[col]);
      var oldVal = String(prop[col] == null ? '' : prop[col]);
      if (newVal !== oldVal) actualChanges[col] = newVal;
    });

    if (Object.keys(actualChanges).length === 0) {
      closeModal();
      return;
    }

    // iCalURL が変わる場合、confirmUrlChange がなければ確認モーダルを出す
    if (actualChanges.iCalURL && !confirmUrlChange) {
      showUrlConfirm(prop, actualChanges);
      return;
    }

    var saveBtn = document.getElementById('pm-modal-save');
    var errEl   = document.getElementById('pm-modal-err');
    if (saveBtn) saveBtn.disabled = true;
    if (errEl)   errEl.hidden = true;

    callApiFn({
      action:               'masterUpdateProperty',
      rowNumber:            prop.rowNumber,
      expectedPropertyName: prop.PropertyName,
      rowToken:             prop.rowToken,
      changes:              actualChanges,
      confirmUrlChange:     confirmUrlChange === true
    }).then(function(r) {
      if (saveBtn) saveBtn.disabled = false;
      if (!r.ok) {
        var msg = buildErrMsg(r);
        if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
        return;
      }
      closeModal();
      loadProperties();
    }).catch(function(e) {
      if (saveBtn) saveBtn.disabled = false;
      if (errEl) { errEl.textContent = '通信エラー: ' + (e.message || '不明'); errEl.hidden = false; }
    });
  }

  function doAdd(changes, confirmDuplicate) {
    var saveBtn = document.getElementById('pm-modal-save');
    var errEl   = document.getElementById('pm-modal-err');
    if (saveBtn) saveBtn.disabled = true;
    if (errEl)   errEl.hidden = true;

    callApiFn({
      action:           'masterAddProperty',
      changes:          changes,
      confirmDuplicate: confirmDuplicate === true
    }).then(function(r) {
      if (saveBtn) saveBtn.disabled = false;
      if (!r.ok) {
        if (r.error === 'duplicate_property' && r.warning) {
          if (window.confirm('同名の物件がすでに存在します。続けて追加しますか？\n（Airbnb と Beds24 の2本の iCal を同名で持つ場合など）')) {
            doAdd(changes, true);
          }
          return;
        }
        var msg = buildErrMsg(r);
        if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
        return;
      }
      closeModal();
      loadProperties();
    }).catch(function(e) {
      if (saveBtn) saveBtn.disabled = false;
      if (errEl) { errEl.textContent = '通信エラー: ' + (e.message || '不明'); errEl.hidden = false; }
    });
  }

  // ── iCalURL 変更確認ダイアログ ───────────────────────────────────────────────

  function showUrlConfirm(prop, changes) {
    var oldUrl = String(prop.iCalURL || '');
    var newUrl = String(changes.iCalURL || '');

    var existing = document.getElementById('pm-modal-bg');
    if (existing) existing.remove();

    var html = '<div class="pm-modal-bg" id="pm-modal-bg">' +
      '<div class="pm-modal">' +
      '<h2>iCalURL の変更確認</h2>' +
      '<p style="margin-bottom:0.75rem;font-size:0.88rem">iCalURL を変更すると、カレンダー取り込みに影響します。内容を確認してください。</p>' +
      '<div class="pm-url-diff">' +
        '<div class="pm-url-label">変更前</div>' +
        '<div class="pm-url-val">' + esc(oldUrl || '（空）') + '</div>' +
      '</div>' +
      '<div class="pm-url-diff">' +
        '<div class="pm-url-label">変更後</div>' +
        '<div class="pm-url-val">' + esc(newUrl || '（空）') + '</div>' +
      '</div>' +
      '<div id="pm-url-confirm-err" class="pm-err" hidden></div>' +
      '<div class="pm-modal-actions">' +
        '<button class="pm-btn" id="pm-url-cancel">戻る</button>' +
        '<button class="pm-btn pm-btn-primary" id="pm-url-confirm">この変更で保存</button>' +
      '</div>' +
      '</div></div>';

    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstElementChild);

    document.getElementById('pm-url-cancel').addEventListener('click', function() {
      var el = document.getElementById('pm-modal-bg');
      if (el) el.remove();
      // 編集モーダルを再表示
      renderModal();
    });

    document.getElementById('pm-url-confirm').addEventListener('click', function() {
      var el = document.getElementById('pm-modal-bg');
      if (el) el.remove();
      doUpdate(prop, changes, true);
    });
  }

  function buildErrMsg(r) {
    var base = r.error || '不明なエラー';
    if (r.detail)  base += ': ' + r.detail;
    if (r.column)  base += ' (列: ' + r.column + ')';
    if (r.current) base += ' (現在の物件名: ' + r.current + ')';
    if (r.details && Array.isArray(r.details)) {
      base += ' — ' + r.details.map(function(d) { return d.column + '(' + d.reason + ')'; }).join(', ');
    }
    return base;
  }

  // ── 公開 ──────────────────────────────────────────────────────────────────────

  global.PcMaster = { mount: mount };

})(window);
