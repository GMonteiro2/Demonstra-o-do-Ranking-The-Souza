/*
 * ui.js — tela: desenha a tabela e reage aos cliques.
 *
 * Não tem regra de negócio (isso fica em ranking.js) nem acesso direto
 * ao armazenamento (isso fica em storage.js). Aqui só liga uma coisa na outra.
 */
(() => {
  'use strict';

  const { DEMO_MODE, MAX_CLIENTS_DEMO, BACKUP_ALERT_DAYS, DEFAULTS } = CONFIG;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  // tira acentos e põe em minúsculas, para a busca achar "andre" em "André"
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  let state = Store.load();
  let flashId = null;
  let lastUndo = null;
  let toastTimer = null;

  function persist() {
    $('#storageWarn').hidden = Store.save(state);
  }

  // ---------- mensagens ----------
  function toast(msg, withUndo) {
    $('#toastMsg').textContent = msg;
    $('#undo').hidden = !withUndo;
    $('#toast').classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('on'), 6000);
  }

  function showErr(msg) {
    $('#err').textContent = msg;
  }

  // ---------- desenho ----------
  function renderBackup() {
    const head = $('#headStatus');
    if (DEMO_MODE) {
      head.textContent = 'Demonstração';
      return;
    }
    const st = Ranking.backupStatus(state.lastBackup, state.clients.length, BACKUP_ALERT_DAYS);
    head.textContent = st.text;
    head.classList.toggle('warn', st.level === 'warn');
    $('#backupInfo').textContent = st.text;
    $('#backupInfo').classList.toggle('warn', st.level === 'warn');
  }

  function render() {
    const q = norm($('#busca').value.trim());
    const qDigits = Ranking.phoneDigits(q);
    const all = Ranking.rankClients(state.clients);
    const list = all.filter(c => !q || norm(`${c.nome} ${c.sobrenome}`).includes(q) || (qDigits && Ranking.phoneDigits(c.celular).includes(qDigits)));

    const tbody = $('#tbody');
    tbody.replaceChildren();
    list.forEach(c => {
      const tr = el('tr', c.pos <= 3 ? 'p' + c.pos : '');
      if (c.id === flashId) tr.classList.add('flash');

      const tdPos = el('td');
      tdPos.append(el('span', 'pos', c.pos));
      const b1 = el('button', 'sm fill', `+ Indicação (+${Ranking.pointsFor(state.cfg, 'indicacao')})`);
      const b2 = el('button', 'sm out', `+ Com plano (+${Ranking.pointsFor(state.cfg, 'plano')})`);
      const bx = el('button', 'x', '✕');
      bx.title = 'Excluir cliente';
      bx.setAttribute('aria-label', `Excluir ${c.nome} ${c.sobrenome}`);
      b1.onclick = () => addPoints(c.id, 'indicacao');
      b2.onclick = () => addPoints(c.id, 'plano');
      bx.onclick = () => removeClient(c);
      const tdActs = el('td', 'acts');
      tdActs.append(b1, b2, bx);

      tr.append(tdPos, el('td', 'name', `${c.nome} ${c.sobrenome}`), el('td', 'tel', c.celular), el('td', 'pts', c.pontos), tdActs);
      tbody.append(tr);
    });

    const empty = $('#empty');
    empty.hidden = list.length > 0;
    if (!list.length) {
      empty.textContent = all.length ? 'Nenhum cliente encontrado nessa busca.' : 'Nenhum cliente ainda. Cadastre o primeiro ao lado.';
    }

    const lead = all[0];
    $('#sub').textContent = all.length
      ? `${all.length} cliente${all.length > 1 ? 's' : ''} · Líder: ${lead.nome} ${lead.sobrenome} com ${lead.pontos} pontos`
      : 'Sem clientes cadastrados';
    $('#prizeShow').textContent = state.cfg.premio.trim() || 'Prêmio a definir';
    renderBackup();
  }

  // ---------- ações ----------
  function addPoints(id, kind) {
    const c = state.clients.find(k => k.id === id);
    if (!c) return;
    const before = c.pontos;
    c.pontos = Math.min(Ranking.MAX_POINTS, c.pontos + Ranking.pointsFor(state.cfg, kind));
    const applied = c.pontos - before;
    flashId = id;
    lastUndo = { id, applied };
    persist();
    render();
    toast(`+${applied} pontos para ${c.nome} ${c.sobrenome}`, true);
  }

  function undo() {
    if (!lastUndo) return;
    const c = state.clients.find(k => k.id === lastUndo.id);
    if (c) {
      c.pontos = Math.max(0, c.pontos - lastUndo.applied);
      flashId = c.id;
    }
    lastUndo = null;
    persist();
    render();
    $('#toast').classList.remove('on');
  }

  function removeClient(c) {
    if (!confirm(`Excluir ${c.nome} ${c.sobrenome} do ranking?`)) return;
    state.clients = state.clients.filter(k => k.id !== c.id);
    if (lastUndo && lastUndo.id === c.id) lastUndo = null;
    persist();
    render();
  }

  function submitClient(e) {
    e.preventDefault();
    if (DEMO_MODE && state.clients.length >= MAX_CLIENTS_DEMO) {
      return showErr(`A demonstração aceita até ${MAX_CLIENTS_DEMO} clientes. Na versão completa não há limite.`);
    }
    const res = Ranking.validateClient(
      { nome: $('#nome').value, sobrenome: $('#sobrenome').value, celular: $('#cel').value },
      state.clients
    );
    if (!res.ok) return showErr(res.error);

    showErr('');
    const client = { id: Ranking.newId(), ...res.value, pontos: 0 };
    state.clients.push(client);
    flashId = client.id;
    persist();
    $('#form').reset();
    $('#busca').value = '';
    render();
    $('#nome').focus();
    toast(`${client.nome} ${client.sobrenome} cadastrado`, false);
  }

  // ---------- configurações (pontos e prêmio) ----------
  function bindCfg() {
    $('#cInd').value = state.cfg.ind;
    $('#cPlano').value = state.cfg.plano;
    $('#cPremio').value = state.cfg.premio;
  }

  // ---------- cópia de segurança ----------
  function doBackup() {
    state.lastBackup = Store.exportBackup(state);
    persist();
    render();
    toast('Cópia de segurança salva na pasta Downloads', false);
  }

  function doRestore(file) {
    if (!file) return;
    Store.readBackupFile(file)
      .then(restored => {
        if (!confirm(`Restaurar a cópia com ${restored.clients.length} cliente(s)? Os dados atuais serão substituídos.`)) return;
        state = restored;
        lastUndo = null;
        persist();
        bindCfg();
        render();
        toast('Cópia restaurada com sucesso', false);
      })
      .catch(err => alert(err.message))
      .finally(() => { $('#fileRestore').value = ''; });
  }

  // ---------- ligações ----------
  function init() {
    // formata o celular enquanto digita
    $('#cel').oninput = e => { e.target.value = Ranking.formatPhone(e.target.value); };
    $('#form').onsubmit = submitClient;
    $('#busca').oninput = render;
    $('#undo').onclick = undo;

    $('#cInd').onchange = e => {
      state.cfg.ind = Ranking.clampInt(e.target.value, 1, 999, DEFAULTS.ind);
      e.target.value = state.cfg.ind;
      persist(); render();
    };
    $('#cPlano').onchange = e => {
      state.cfg.plano = Ranking.clampInt(e.target.value, 0, 999, DEFAULTS.plano);
      e.target.value = state.cfg.plano;
      persist(); render();
    };
    $('#cPremio').oninput = e => {
      state.cfg.premio = e.target.value;
      persist(); render();
    };

    if (DEMO_MODE) {
      document.title += ' (Demonstração)';
      $('#demoBar').hidden = false;
      $('#demoBar').textContent = `VERSÃO DE DEMONSTRAÇÃO · dados de exemplo · até ${MAX_CLIENTS_DEMO} clientes · sem cópia de segurança`;
      $('#backupCard').hidden = true;
      $('#reset').hidden = false;
      $('#reset').textContent = 'Restaurar demonstração';
      $('#reset').onclick = () => {
        if (!confirm('Voltar para os dados de exemplo? Os clientes atuais serão apagados.')) return;
        state = Store.demoState();
        lastUndo = null;
        persist(); bindCfg(); render();
      };
    } else {
      $('#btnBackup').onclick = doBackup;
      $('#btnRestore').onclick = () => $('#fileRestore').click();
      $('#fileRestore').onchange = e => doRestore(e.target.files[0]);
      $('#btnCsv').onclick = () => Store.exportCsv(Ranking.rankClients(state.clients));
    }

    $('#storageWarn').hidden = Store.available;
    bindCfg();
    render();
  }

  init();
})();
