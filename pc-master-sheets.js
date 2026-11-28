/**
 * PC 管理画面 — 周辺マスターシート共通編集
 * window.PcMasterSheets.mount(container, callApi)
 */
(function(global) {
  'use strict';

  var state = {
    sheets:     [],   // masterSheetList の結果
    sheetId:    null,
    rows:       [],
    header:     [],
    cfg:        null, // 選択中シートのクライアント側設定
    loading:    false
  };

  // クライアント側のシート設定（入力欄の type ヒントと列ラベル用）
  var CLIENT_CONFIGS = {
    area_settings:        { label: 'エリア設定',         numberCols: ['SortOrder'], boolCols: [] },
    supply_master:        { label: '備品マスター',        numberCols: ['DefaultQty','UnitPrice','UnitCost'], boolCols: ['Enabled'] },
    building_map:         { label: '物件コードマップ',    numberCols: [], boolCols: [] },
    room_list:            { label: '部屋一覧',            numberCols: [], boolCols: ['Enabled'] },
    property_defaults:    { label: '物件デフォルト',      numberCols: [], boolCols: [] },
    manual_property_list: { label: '手動追加物件リスト',  numberCols: [], boolCols: ['Enabled'] },
    master_owners:        { label: 'オーナーマスター',    numberCols: [], boolCols: [] },
    master_linen_types:   { label: 'リネン種別マスター',  numberCols: [], boolCols: [] },
    master_cleaners:      { label: '清掃員マスター',      numberCols: [], boolCols: [] },
    staff:                { label: 'スタッフ',            numberCols: [], boolCols: ['Active'],
                            editableCols: ['Name', 'Lang', 'Active', 'Role'],
                            keyCols: ['LineUserId'] }
  };

  var container_   = null;
  var callApi_     = null;

  // ── mount ──────────────────────────────────────────────────────────────────

  function mount(container, callApi) {
    container_  = container;
    callApi_    = callApi;
    container_.innerHTML = '';
    container_.appendChild(buildSkeleton_());
    loadSheetList_();
  }

  // ── UI 骨格 ────────────────────────────────────────────────────────────────

  function buildSkeleton_() {
    var wrap = el_('div');
    wrap.innerHTML =
      '<div id="ms-sheet-select" style="margin-bottom:0.75rem">' +
        '<select id="ms-sheet-sel" style="padding:0.4rem 0.6rem;border:1px solid var(--border);border-radius:6px;font-size:0.9rem;font-family:inherit;background:var(--card)">' +
          '<option value="">— シートを選んでください —</option>' +
        '</select>' +
      '</div>' +
      '<div id="ms-filter-row" class="filter-row" style="display:none">' +
        '<input type="text" id="ms-search" placeholder="検索（前方一致）" style="min-width:160px">' +
        '<button class="btn-reload" id="ms-btn-add" onclick="PcMasterSheets._addRow()" style="display:none">+ 追加</button>' +
        '<button class="btn-reload" id="ms-btn-reload" onclick="PcMasterSheets._reload()">更新</button>' +
      '</div>' +
      '<div id="ms-loading" class="loading-inline" hidden>読み込み中...</div>' +
      '<div id="ms-err" class="err-msg" hidden></div>' +
      '<div class="tbl-wrap"><table id="ms-table" hidden><thead id="ms-thead"></thead><tbody id="ms-tbody"></tbody></table></div>' +
      '<div id="ms-empty" class="msg" hidden>データがありません</div>' +
      '<div id="ms-modal-bg" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000" onclick="PcMasterSheets._closeModal()"></div>' +
      '<div id="ms-modal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--card);border-radius:10px;padding:1.25rem 1.5rem;min-width:min(96vw,460px);max-height:90vh;overflow-y:auto;z-index:1001"></div>';
    return wrap;
  }

  function esc_(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function el_(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function $_(id) { return container_.querySelector('#' + id); }

  // ── シート一覧読み込み ─────────────────────────────────────────────────────

  function loadSheetList_() {
    $_('ms-loading').hidden = false;
    callApi_({ action: 'masterSheetList' }).then(function(r) {
      $_('ms-loading').hidden = true;
      if (!r.ok) {
        if (r.error === 'unauthorized' && window.showReloginPrompt) { window.showReloginPrompt(); return; }
        showErr_('シート一覧の取得に失敗: ' + (r.error || '')); return;
      }
      state.sheets = r.sheets;
      var sel = $_('ms-sheet-sel');
      (r.sheets || []).forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.label + (s.exists ? '' : ' (未作成)');
        if (!s.exists) opt.disabled = true;
        sel.appendChild(opt);
      });
      sel.onchange = function() { selectSheet_(sel.value); };
    }).catch(function(e) { $_('ms-loading').hidden = true; showErr_('通信エラー: ' + (e.message || '')); });
  }

  function selectSheet_(sheetId) {
    state.sheetId = sheetId;
    state.rows    = [];
    state.header  = [];
    state.cfg     = CLIENT_CONFIGS[sheetId] || {};
    $_('ms-filter-row').style.display = sheetId ? '' : 'none';
    if (!sheetId) return;

    var sheet = state.sheets.find(function(s) { return s.id === sheetId; });
    var addBtn = $_('ms-btn-add');
    if (addBtn) addBtn.style.display = (sheet && sheet.canAdd) ? '' : 'none';

    loadRows_();
  }

  // ── 行一覧読み込み ─────────────────────────────────────────────────────────

  function loadRows_() {
    if (!state.sheetId) return;
    $_('ms-loading').hidden = false;
    $_('ms-err').hidden     = true;
    $_('ms-table').hidden   = true;
    $_('ms-empty').hidden   = true;

    callApi_({ action: 'masterSheetGet', sheetId: state.sheetId }).then(function(r) {
      $_('ms-loading').hidden = true;
      if (!r.ok) {
        if (r.error === 'unauthorized' && window.showReloginPrompt) { window.showReloginPrompt(); return; }
        showErr_('データ取得に失敗: ' + (r.error || '')); return;
      }
      state.rows   = r.rows   || [];
      state.header = r.header || [];
      renderTable_();
    }).catch(function(e) {
      $_('ms-loading').hidden = true;
      showErr_('通信エラー: ' + (e.message || ''));
    });
  }

  function renderTable_() {
    var search = ($_('ms-search') && $_('ms-search').value.trim().toLowerCase()) || '';
    var rows = state.rows;
    if (search) {
      rows = rows.filter(function(r) {
        return state.header.some(function(h) {
          return String(r[h] || '').toLowerCase().indexOf(search) === 0;
        });
      });
    }

    if (!rows.length) {
      $_('ms-table').hidden = true;
      $_('ms-empty').hidden = false;
      return;
    }

    var sheet = state.sheets.find(function(s) { return s.id === state.sheetId; }) || {};
    var addOnly = sheet.addOnly;

    // ヘッダー
    var thead = $_('ms-thead');
    thead.innerHTML = '<tr>' +
      state.header.map(function(h) { return '<th>' + esc_(h) + '</th>'; }).join('') +
      '<th style="width:50px"></th>' +
      '</tr>';

    // 行
    var tbody = $_('ms-tbody');
    tbody.innerHTML = '';
    rows.forEach(function(row) {
      var tr = document.createElement('tr');
      var cells = state.header.map(function(h) {
        return '<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc_(row[h]) + '</td>';
      }).join('');
      var editBtn = addOnly ? '' :
        '<button class="btn-reload" style="font-size:0.78rem;padding:0.25rem 0.5rem" ' +
        'onclick="PcMasterSheets._editRow(' + row.rowNumber + ')">編集</button>';
      tr.innerHTML = cells + '<td>' + editBtn + '</td>';
      tbody.appendChild(tr);
    });

    $_('ms-empty').hidden = true;
    $_('ms-table').hidden = false;
  }

  if (typeof document !== 'undefined') {
    document.addEventListener && document.addEventListener('input', function(e) {
      if (e.target && e.target.id === 'ms-search') renderTable_();
    });
  }

  // ── 編集モーダル ───────────────────────────────────────────────────────────

  function editRow_(rowNumber) {
    var row = state.rows.find(function(r) { return r.rowNumber === rowNumber; });
    if (!row) return;

    var cfg     = state.cfg || {};
    var keyCols = cfg.keyCols || [];
    var editCols = cfg.editableCols
      ? state.header.filter(function(h) { return cfg.editableCols.indexOf(h) >= 0; })
      : state.header.filter(function(h) { return keyCols.indexOf(h) < 0; });

    var fields = editCols.map(function(h) {
      return buildField_(h, row[h], cfg);
    }).join('');

    var readOnlyInfo = keyCols.length
      ? '<p style="font-size:0.82rem;color:var(--muted);margin-bottom:0.75rem">キー: ' +
        keyCols.map(function(k) { return esc_(k) + ' = ' + esc_(row[k]); }).join(', ') + '</p>'
      : '';

    openModal_(
      '編集',
      readOnlyInfo + '<div id="ms-fields">' + fields + '</div>',
      '<button class="btn-reload" onclick="PcMasterSheets._submitEdit(' + rowNumber + ')">保存</button>' +
      '<button class="btn-reload" onclick="PcMasterSheets._closeModal()" style="margin-left:0.5rem">キャンセル</button>'
    );
  }

  function submitEdit_(rowNumber) {
    var row = state.rows.find(function(r) { return r.rowNumber === rowNumber; });
    if (!row) return;

    var cfg     = state.cfg || {};
    var keyCols = cfg.keyCols || [];
    var editCols = cfg.editableCols
      ? state.header.filter(function(h) { return cfg.editableCols.indexOf(h) >= 0; })
      : state.header.filter(function(h) { return keyCols.indexOf(h) < 0; });

    var changes = {};
    editCols.forEach(function(h) {
      var inp = container_.querySelector('#ms-field-' + h);
      if (inp) {
        changes[h] = inp.type === 'checkbox' ? String(inp.checked).toUpperCase() : inp.value;
      }
    });

    var expectedKey = {};
    keyCols.forEach(function(k) { expectedKey[k] = row[k]; });

    // Role 変更の確認
    if (state.sheetId === 'staff' && changes.Role && changes.Role !== row.Role) {
      if (!confirm('Role を「' + esc_(row.Role) + '」→「' + esc_(changes.Role) + '」に変更します。よろしいですか？')) return;
      callApi_({
        action: 'masterSheetUpdate', sheetId: state.sheetId,
        rowNumber: rowNumber, expectedKey: expectedKey, rowToken: row.rowToken,
        changes: changes, confirmRoleChange: true
      }).then(handleSaveResult_).catch(handleSaveErr_);
      return;
    }

    callApi_({
      action: 'masterSheetUpdate', sheetId: state.sheetId,
      rowNumber: rowNumber, expectedKey: expectedKey, rowToken: row.rowToken,
      changes: changes
    }).then(handleSaveResult_).catch(handleSaveErr_);
  }

  // ── 追加モーダル ───────────────────────────────────────────────────────────

  function addRow_() {
    var sheet = state.sheets.find(function(s) { return s.id === state.sheetId; }) || {};
    if (!sheet.canAdd) return;

    var cfg = state.cfg || {};
    var fields = state.header.map(function(h) {
      return buildField_(h, '', cfg);
    }).join('');

    openModal_(
      '追加',
      '<div id="ms-fields">' + fields + '</div>',
      '<button class="btn-reload" onclick="PcMasterSheets._submitAdd()">追加</button>' +
      '<button class="btn-reload" onclick="PcMasterSheets._closeModal()" style="margin-left:0.5rem">キャンセル</button>'
    );
  }

  function submitAdd_() {
    var changes = {};
    state.header.forEach(function(h) {
      var inp = container_.querySelector('#ms-field-' + h);
      if (inp) {
        changes[h] = inp.type === 'checkbox' ? String(inp.checked).toUpperCase() : inp.value;
      }
    });

    callApi_({ action: 'masterSheetAdd', sheetId: state.sheetId, changes: changes })
      .then(function(r) {
        if (!r.ok && r.error === 'duplicate_key') {
          if (confirm('同じキーの行が既にあります。続けて追加しますか？')) {
            callApi_({ action: 'masterSheetAdd', sheetId: state.sheetId, changes: changes, confirmDuplicate: true })
              .then(handleSaveResult_).catch(handleSaveErr_);
          }
          return;
        }
        handleSaveResult_(r);
      }).catch(handleSaveErr_);
  }

  // ── フィールドビルダー ─────────────────────────────────────────────────────

  function buildField_(colName, value, cfg) {
    var id = 'ms-field-' + colName;
    var boolCols   = cfg.boolCols   || [];
    var numberCols = cfg.numberCols || [];

    var label = '<label style="display:block;font-size:0.82rem;color:var(--muted);margin-bottom:0.2rem">' + esc_(colName) + '</label>';
    var style = 'width:100%;padding:0.4rem 0.5rem;border:1px solid var(--border);border-radius:6px;font-size:0.88rem;font-family:inherit;background:var(--card);margin-bottom:0.6rem;box-sizing:border-box';

    if (boolCols.indexOf(colName) >= 0) {
      var checked = (String(value).toUpperCase() === 'TRUE') ? ' checked' : '';
      return '<div>' + label + '<input type="checkbox" id="' + id + '"' + checked + ' style="margin-bottom:0.6rem"></div>';
    }
    if (numberCols.indexOf(colName) >= 0) {
      return '<div>' + label + '<input type="number" id="' + id + '" value="' + esc_(value) + '" min="0" style="' + style + '"></div>';
    }
    if (colName === 'Role') {
      var opts = ['ADMIN', 'CLEANER'].map(function(v) {
        return '<option value="' + v + '"' + (v === value ? ' selected' : '') + '>' + v + '</option>';
      }).join('');
      return '<div>' + label + '<select id="' + id + '" style="' + style + '">' + opts + '</select></div>';
    }
    return '<div>' + label + '<input type="text" id="' + id + '" value="' + esc_(value) + '" style="' + style + '"></div>';
  }

  // ── モーダル制御 ───────────────────────────────────────────────────────────

  function openModal_(title, body, footer) {
    var modal = $_('ms-modal');
    modal.innerHTML =
      '<h3 style="margin-bottom:0.75rem;font-size:1rem">' + esc_(title) + '</h3>' +
      body +
      '<div style="margin-top:1rem;text-align:right">' + footer + '</div>';
    $_('ms-modal-bg').style.display = '';
    modal.style.display = '';
  }

  function closeModal_() {
    $_('ms-modal-bg').style.display = 'none';
    $_('ms-modal').style.display    = 'none';
  }

  // ── 保存結果 ───────────────────────────────────────────────────────────────

  function handleSaveResult_(r) {
    if (!r.ok) {
      if (r.error === 'unauthorized' && window.showReloginPrompt) { window.showReloginPrompt(); return; }
      var msg = r.error || '不明なエラー';
      if (r.details) msg += '\n' + r.details.map(function(d) { return d.column + ': ' + d.reason; }).join('\n');
      alert('保存に失敗しました: ' + msg);
      if (r.error === 'conflict') { closeModal_(); loadRows_(); }
      return;
    }
    closeModal_();
    loadRows_();
    if (window.showToast) window.showToast('保存しました');
  }

  function handleSaveErr_(e) {
    alert('通信エラー: ' + (e.message || ''));
  }

  function showErr_(msg) {
    $_('ms-err').textContent = msg;
    $_('ms-err').hidden      = false;
  }

  function reload_() { loadRows_(); }

  // ── 公開 ──────────────────────────────────────────────────────────────────

  global.PcMasterSheets = {
    mount:        mount,
    _addRow:      function() { addRow_(); },
    _editRow:     function(n) { editRow_(n); },
    _submitEdit:  function(n) { submitEdit_(n); },
    _submitAdd:   function() { submitAdd_(); },
    _closeModal:  function() { closeModal_(); },
    _reload:      function() { reload_(); }
  };

})(window);
