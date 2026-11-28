/**
 * PC 管理画面 — 翌日アサイン決めタブ
 * window.PcAssign.mount(container, callApi) で使う。
 * pc-admin.html が「アサイン」タブとして読み込む（pc-master.js と同じ構成）。
 *
 * callApi(body): Promise<object>  ← pc-admin.html の callApi と同じシグネチャ
 */
(function(global) {
  'use strict';

  // ── テスト可能な純粋関数 ──────────────────────────────────────────────────────

  /**
   * buildAssignRows_: getScheduleRange の items と未保存選択から saveAssignments 用の行配列を作る。
   *
   * saveAssignments はその日の全行を送った内容で丸ごと置き換えるため、
   * selections に含まれない物件（変更なし）も items の全件から生成して返す。
   * board.html の changeScheduleStaff が dateData.items の全件を rows にするのと同じ作り。
   *
   * @param {Array}  items      - dateData.items の全件 [{ propertyName, uid, staff, order }]
   * @param {Object} selections - 画面での未保存選択 { [propertyName]: staff }
   * @returns {Array} - rows [{ propertyName, uid, staff, order }]
   */
  function buildAssignRows_(items, selections) {
    return items.map(function(item) {
      var staff = Object.prototype.hasOwnProperty.call(selections, item.propertyName)
        ? selections[item.propertyName]
        : (item.staff || '');
      return {
        propertyName: item.propertyName,
        uid:          item.uid   || '',
        staff:        staff,
        order:        item.order || 0
      };
    });
  }

  // ── Node.js テスト用エクスポート ─────────────────────────────────────────────
  if (typeof module !== 'undefined') {
    module.exports = { buildAssignRows_: buildAssignRows_ };
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 以下はブラウザ専用コード
  // ─────────────────────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function tomorrowJst() {
    var d   = new Date();
    var jst = new Date(d.getTime() + 9 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────

  var CSS = [
    '.pa-wrap { font-size: 14px; }',

    '.pa-toolbar {',
    '  display: flex; gap: 0.5rem; margin-bottom: 0.75rem;',
    '  flex-wrap: wrap; align-items: center; }',
    '.pa-toolbar label { font-size: 0.82rem; color: #888; white-space: nowrap; }',
    '.pa-toolbar input[type=date] {',
    '  padding: 0.35rem 0.5rem; border: 1px solid #e0e0e0; border-radius: 6px;',
    '  font-size: 0.88rem; font-family: inherit; }',

    '.pa-btn {',
    '  padding: 0.4rem 0.9rem; border: 1px solid #00a84f; border-radius: 6px;',
    '  background: #fff; color: #00a84f; cursor: pointer;',
    '  font-size: 0.85rem; font-family: inherit; font-weight: bold; }',
    '.pa-btn:disabled { opacity: 0.4; cursor: not-allowed; }',
    '.pa-btn-primary { background: #00a84f; color: #fff; border-color: #00a84f; }',
    '.pa-btn-primary:hover:not(:disabled) { background: #008a3f; }',

    '.pa-err { color: #c00; font-size: 0.88rem; padding: 0.4rem 0; }',
    '.pa-loading { color: #888; padding: 1.5rem 0; text-align: center; }',
    '.pa-info {',
    '  font-size: 0.82rem; background: #e8f5e9; border: 1px solid #a5d6a7;',
    '  border-radius: 6px; padding: 0.4rem 0.75rem; margin-bottom: 0.6rem; color: #2e7d32; }',
    '.pa-warn {',
    '  font-size: 0.82rem; background: #fff3cd; border: 1px solid #ffc107;',
    '  border-radius: 6px; padding: 0.4rem 0.75rem; margin-bottom: 0.6rem; color: #856404; }',

    '.pa-tbl-wrap { overflow-x: auto; }',
    '.pa-tbl {',
    '  border-collapse: collapse; background: #fff;',
    '  border-radius: 8px; overflow: hidden;',
    '  box-shadow: 0 1px 3px rgba(0,0,0,0.08); font-size: 0.85rem; }',
    '.pa-tbl th {',
    '  background: #f5f7fa; padding: 0.5rem 0.6rem; text-align: center;',
    '  white-space: nowrap; font-size: 0.78rem; color: #888;',
    '  border-bottom: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0;',
    '  min-width: 72px; }',
    '.pa-tbl th.pa-prop-col { text-align: left; min-width: 180px; }',
    '.pa-tbl td {',
    '  padding: 0.4rem 0.6rem; border-bottom: 1px solid #f0f0f0;',
    '  border-right: 1px solid #f0f0f0; vertical-align: middle; }',
    '.pa-tbl tr:last-child td { border-bottom: none; }',
    '.pa-tbl td.pa-prop-cell {',
    '  font-size: 0.88rem; white-space: nowrap;',
    '  max-width: 220px; overflow: hidden; text-overflow: ellipsis; }',
    '.pa-tbl tr:hover td { background: #fafafa; }',

    '.pa-cell { text-align: center; cursor: pointer; user-select: none; }',
    '.pa-cell:hover { background: #f0faf5 !important; }',

    '.pa-dot {',
    '  display: inline-block; width: 18px; height: 18px; border-radius: 50%;',
    '  border: 2px solid #ccc; background: transparent; vertical-align: middle;',
    '  transition: background 0.1s; }',
    '.pa-dot.selected { background: #00a84f; border-color: #00a84f; }',
    '.pa-dot.conflict { background: #ff6d00; border-color: #ff6d00; }',

    '.pa-conflict-row td { background: #fff8e1 !important; }',

    '.pa-unsaved-badge {',
    '  display: inline-block; font-size: 0.7rem; background: #fff3e0;',
    '  color: #e65100; border: 1px solid #ffcc80; border-radius: 4px;',
    '  padding: 0.1rem 0.3rem; margin-left: 0.3rem; vertical-align: middle; }',

    '.pa-area-tag {',
    '  color: #888; font-size: 0.72rem; margin-left: 0.3rem; vertical-align: middle; }',
    '.pa-sdi-tag {',
    '  color: #1565c0; font-size: 0.7rem; background: #e3f2fd;',
    '  border-radius: 3px; padding: 0.05rem 0.25rem; margin-left: 0.25rem;',
    '  vertical-align: middle; }',

    '.pa-cnt { font-size: 0.72rem; color: #aaa; margin-top: 0.1rem; }'
  ].join('\n');

  // ── 状態 ────────────────────────────────────────────────────────────────────

  var state = {
    date:            null,
    allItems:        [],    // dateData.items の全件（cancelled 含む）— buildAssignRows_ に渡す
    items:           [],    // 表示用（cancelled 除外済み）
    cleaners:        [],    // cleaner name の配列
    latestUpdatedAt: null,
    selections:      {},    // { [propertyName]: staff } — 未保存の選択（競合後も保持）
    conflictProps:   {},    // { [propertyName]: true } — 競合した物件
    saving:          false
  };

  var _callApi = null;
  var _root    = null;

  // ── DOM ヘルパー ─────────────────────────────────────────────────────────────

  function $(id) { return _root.querySelector('#' + id); }

  // ── レンダリング ──────────────────────────────────────────────────────────────

  function renderTable() {
    var items     = state.items;
    var cleaners  = state.cleaners;
    var sels      = state.selections;
    var conflicts = state.conflictProps;

    if (!items.length) {
      $('pa-tbl-wrap').innerHTML =
        '<div class="pa-loading">この日の清掃物件はありません</div>';
      return;
    }

    // 未保存件数を計算
    var unsavedCnt = 0;
    for (var pn in sels) {
      if (!Object.prototype.hasOwnProperty.call(sels, pn)) continue;
      var matched = null;
      for (var ii = 0; ii < items.length; ii++) {
        if (items[ii].propertyName === pn) { matched = items[ii]; break; }
      }
      if (!matched || sels[pn] !== (matched.staff || '')) unsavedCnt++;
    }

    // ヘッダー
    var hdrs = '<th class="pa-prop-col">物件（' + items.length + '件）</th>';
    for (var ci = 0; ci < cleaners.length; ci++) {
      var cname = cleaners[ci];
      var cnt = 0;
      for (var i = 0; i < items.length; i++) {
        var s = Object.prototype.hasOwnProperty.call(sels, items[i].propertyName)
          ? sels[items[i].propertyName] : (items[i].staff || '');
        if (s === cname) cnt++;
      }
      hdrs += '<th>' + esc(cname) + '<div class="pa-cnt">' + cnt + '件</div></th>';
    }
    var unassignedCnt = 0;
    for (var i = 0; i < items.length; i++) {
      var s = Object.prototype.hasOwnProperty.call(sels, items[i].propertyName)
        ? sels[items[i].propertyName] : (items[i].staff || '');
      if (!s) unassignedCnt++;
    }
    hdrs += '<th>未割当<div class="pa-cnt">' + unassignedCnt + '件</div></th>';

    // データ行
    var rows = '';
    for (var i = 0; i < items.length; i++) {
      var item    = items[i];
      var pn      = item.propertyName;
      var current = Object.prototype.hasOwnProperty.call(sels, pn) ? sels[pn] : (item.staff || '');
      var isConflict = !!conflicts[pn];
      var isUnsaved  = Object.prototype.hasOwnProperty.call(sels, pn) && sels[pn] !== (item.staff || '');

      var rowCls = isConflict ? ' class="pa-conflict-row"' : '';
      var badge  = isUnsaved ? '<span class="pa-unsaved-badge">未保存</span>' : '';
      var areaTg = item.area
        ? '<span class="pa-area-tag">' + esc(item.area) + '</span>' : '';
      var sdiTg  = item.isSameDayIn
        ? '<span class="pa-sdi-tag">同日</span>' : '';

      rows += '<tr' + rowCls + '>';
      rows += '<td class="pa-prop-cell">' + esc(pn) + areaTg + sdiTg + badge + '</td>';

      for (var ci = 0; ci < cleaners.length; ci++) {
        var cname = cleaners[ci];
        var dotCls = current === cname
          ? (isConflict ? 'pa-dot conflict' : 'pa-dot selected')
          : 'pa-dot';
        rows += '<td class="pa-cell" data-prop="' + esc(pn) + '" data-staff="' + esc(cname) + '">'
          + '<span class="' + dotCls + '"></span></td>';
      }
      // 未割当列
      var uDotCls = !current
        ? (isConflict ? 'pa-dot conflict' : 'pa-dot selected')
        : 'pa-dot';
      rows += '<td class="pa-cell" data-prop="' + esc(pn) + '" data-staff="">'
        + '<span class="' + uDotCls + '"></span></td>';
      rows += '</tr>';
    }

    $('pa-tbl-wrap').innerHTML =
      '<div class="pa-tbl-wrap">' +
      '<table class="pa-tbl"><thead><tr>' + hdrs + '</tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';

    // 保存ボタンの表示
    var saveBtn = $('pa-save-btn');
    if (saveBtn) {
      saveBtn.textContent = unsavedCnt > 0
        ? '一括保存（' + unsavedCnt + '件変更）'
        : '一括保存';
    }
  }

  function renderConflictBanner() {
    var banner = $('pa-conflict-banner');
    if (!banner) return;
    var conflictCnt = 0;
    for (var k in state.conflictProps) {
      if (Object.prototype.hasOwnProperty.call(state.conflictProps, k)) conflictCnt++;
    }
    if (conflictCnt) {
      banner.hidden = false;
      banner.textContent =
        '他の管理者が先に保存しました。競合した ' + conflictCnt +
        ' 件を橙色で表示しています。内容を確認し、再度「一括保存」してください。';
    } else {
      banner.hidden = true;
    }
  }

  // ── データ取得 ────────────────────────────────────────────────────────────────

  function loadData(preserveSelections) {
    if (!preserveSelections) {
      state.selections    = {};
      state.conflictProps = {};
    }

    $('pa-loading').hidden      = false;
    $('pa-tbl-wrap').innerHTML  = '';
    $('pa-err').hidden          = true;
    $('pa-save-info').hidden    = true;
    var saveBtn = $('pa-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '一括保存'; }

    var date = state.date;
    Promise.all([
      _callApi({ action: 'getScheduleRange', fromDate: date, toDate: date }),
      _callApi({ action: 'getCleanerList' })
    ]).then(function(results) {
      $('pa-loading').hidden = true;
      var sr = results[0];
      var cr = results[1];

      if (!sr.ok) {
        $('pa-err').textContent = 'スケジュール取得エラー: ' + (sr.error || '不明');
        $('pa-err').hidden = false;
        return;
      }
      if (!cr.ok) {
        $('pa-err').textContent = '清掃員リスト取得エラー: ' + (cr.error || '不明');
        $('pa-err').hidden = false;
        return;
      }

      var dateData = (sr.byDate || {})[date] || { items: [], latestUpdatedAt: null };
      // allItems: cancelled を含む全件（saveAssignments の全行送信に使う）
      state.allItems = dateData.items || [];
      // items: 表示用（cancelled 除外）
      state.items = state.allItems.filter(function(i) { return !i.cancelled; });
      state.latestUpdatedAt = dateData.latestUpdatedAt || null;
      state.cleaners = (cr.cleaners || []).map(function(c) {
        return typeof c === 'object' ? (c.name || '') : String(c || '');
      }).filter(function(n) { return n; });

      // 競合後の再読込み: selections と items を照合して conflictProps を再計算
      if (preserveSelections) {
        var newConflicts = {};
        for (var pn in state.selections) {
          if (!Object.prototype.hasOwnProperty.call(state.selections, pn)) continue;
          var found = null;
          for (var ii = 0; ii < state.items.length; ii++) {
            if (state.items[ii].propertyName === pn) { found = state.items[ii]; break; }
          }
          var loadedStaff = found ? (found.staff || '') : '';
          if (state.selections[pn] !== loadedStaff) newConflicts[pn] = true;
        }
        state.conflictProps = newConflicts;
        renderConflictBanner();
      }

      var saveBtn2 = $('pa-save-btn');
      if (saveBtn2) saveBtn2.disabled = false;
      renderTable();
    }).catch(function(e) {
      $('pa-loading').hidden = true;
      $('pa-err').textContent = '通信エラー: ' + (e.message || '不明');
      $('pa-err').hidden = false;
    });
  }

  // ── 保存 ─────────────────────────────────────────────────────────────────────

  function save() {
    if (state.saving) return;
    state.saving = true;

    var saveBtn = $('pa-save-btn');
    if (saveBtn) saveBtn.disabled = true;
    $('pa-save-info').hidden = true;
    $('pa-err').hidden       = true;

    var rows            = buildAssignRows_(state.allItems, state.selections);
    var oldUpdatedAt    = state.latestUpdatedAt;
    var oldSelections   = JSON.parse(JSON.stringify(state.selections));

    _callApi({
      action:         'saveAssignments',
      date:           state.date,
      rows:           rows,
      knownUpdatedAt: oldUpdatedAt || ''
    }).then(function(r) {
      state.saving = false;
      var saveBtn2 = $('pa-save-btn');
      if (saveBtn2) saveBtn2.disabled = false;

      if (r.ok) {
        if (r.latestUpdatedAt) state.latestUpdatedAt = r.latestUpdatedAt;
        // 保存成功: selections をクリアして allItems の staff を更新
        state.selections    = {};
        state.conflictProps = {};
        for (var ri = 0; ri < rows.length; ri++) {
          for (var ii = 0; ii < state.allItems.length; ii++) {
            if (state.allItems[ii].propertyName === rows[ri].propertyName) {
              state.allItems[ii].staff = rows[ri].staff;
              break;
            }
          }
        }
        $('pa-save-info').hidden = false;
        renderConflictBanner();
        renderTable();
        return;
      }

      // エラー処理
      if (r.error === 'conflict') {
        // 未保存選択を保持したまま再読込み（競合プロパティを色で示す）
        state.selections = oldSelections;
        loadData(true);
      } else {
        $('pa-err').textContent = '保存エラー: ' + (r.error || '不明');
        $('pa-err').hidden = false;
      }
    }).catch(function(e) {
      state.saving = false;
      var saveBtn3 = $('pa-save-btn');
      if (saveBtn3) saveBtn3.disabled = false;
      $('pa-err').textContent = '通信エラー: ' + (e.message || '不明');
      $('pa-err').hidden = false;
    });
  }

  // ── セルクリック ──────────────────────────────────────────────────────────────

  function onCellClick(e) {
    var el = e.target.closest('[data-prop]');
    if (!el) return;
    var pn    = el.getAttribute('data-prop');
    var staff = el.getAttribute('data-staff');
    if (pn === null || staff === null) return;
    state.selections[pn] = staff;
    delete state.conflictProps[pn];
    renderTable();
  }

  // ── mount ─────────────────────────────────────────────────────────────────────

  function mount(container, callApi) {
    _callApi = callApi;
    _root    = container;

    // スタイル注入（1回だけ）
    if (!document.getElementById('pa-style')) {
      var styleEl = document.createElement('style');
      styleEl.id  = 'pa-style';
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }

    var tomorrow = tomorrowJst();
    state.date        = tomorrow;
    state.allItems    = [];
    state.items       = [];
    state.cleaners    = [];
    state.selections  = {};
    state.conflictProps = {};
    state.saving      = false;

    container.innerHTML = [
      '<div class="pa-wrap">',
      '  <div class="pa-toolbar">',
      '    <label>日付</label>',
      '    <input type="date" id="pa-date" value="' + esc(tomorrow) + '">',
      '    <button class="pa-btn" id="pa-reload-btn">更新</button>',
      '    <button class="pa-btn pa-btn-primary" id="pa-save-btn" disabled>一括保存</button>',
      '  </div>',
      '  <div id="pa-conflict-banner" class="pa-warn" hidden></div>',
      '  <div id="pa-save-info" class="pa-info" hidden>',
      '    保存しました。反映まで最大5分かかります。',
      '  </div>',
      '  <div id="pa-err" class="pa-err" hidden></div>',
      '  <div id="pa-loading" class="pa-loading">読み込み中...</div>',
      '  <div id="pa-tbl-wrap"></div>',
      '</div>'
    ].join('\n');

    $('pa-date').addEventListener('change', function() {
      state.date = this.value;
      state.selections    = {};
      state.conflictProps = {};
      $('pa-save-info').hidden = true;
      loadData(false);
    });
    $('pa-reload-btn').addEventListener('click', function() {
      state.selections    = {};
      state.conflictProps = {};
      $('pa-save-info').hidden = true;
      loadData(false);
    });
    $('pa-save-btn').addEventListener('click', save);
    container.addEventListener('click', onCellClick);

    loadData(false);
  }

  // ── グローバルエクスポート ────────────────────────────────────────────────────
  global.PcAssign = { mount: mount, buildAssignRows_: buildAssignRows_ };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {}));
