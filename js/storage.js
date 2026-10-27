/*
 * storage.js — guardar, ler, exportar e importar os dados.
 *
 * É o único arquivo que mexe no localStorage e em download/upload de arquivos.
 * Se um dia os dados forem para um banco online, só este arquivo muda.
 */
const Store = (() => {
  'use strict';

  const KEY = CONFIG.STORAGE_KEY;
  const APP_ID = 'ranking-the-souza';

  // Testa se o navegador realmente consegue salvar (janela anônima, bloqueios etc.)
  let available = true;
  try {
    localStorage.setItem('__teste', '1');
    localStorage.removeItem('__teste');
  } catch (e) {
    available = false;
  }

  const emptyState = () => ({ cfg: { ...CONFIG.DEFAULTS }, clients: [], lastBackup: null });

  const demoState = () => ({
    cfg: { ...CONFIG.DEFAULTS },
    lastBackup: null,
    clients: [
      ['Rafael', 'Lima', '(21) 98888-1001', 42],
      ['Bruno', 'Martins', '(21) 97777-2002', 38],
      ['Thiago', 'Silva', '(21) 96666-3003', 31],
      ['Lucas', 'Pereira', '(21) 95555-4004', 27],
      ['Diego', 'Alves', '(21) 94444-5005', 24],
    ].map(([nome, sobrenome, celular, pontos], i) => ({ id: 'demo' + i, nome, sobrenome, celular, pontos })),
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const state = Ranking.sanitizeState(JSON.parse(raw), CONFIG.DEFAULTS);
        if (state) return state;
      }
    } catch (e) { /* dados ilegíveis: começa do zero */ }
    return CONFIG.DEMO_MODE ? demoState() : emptyState();
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- download / upload ----------
  function today() {
    return new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no horário local
  }

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Cópia de segurança completa (dá para restaurar). Devolve a data/hora gravada.
  function exportBackup(state) {
    const now = new Date().toISOString();
    const payload = {
      app: APP_ID,
      version: 1,
      exportedAt: now,
      data: { cfg: state.cfg, clients: state.clients, lastBackup: now },
    };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `backup-ranking-the-souza-${today()}.json`);
    return now;
  }

  // Lê um arquivo de backup e devolve o estado validado (ou rejeita com mensagem clara).
  function readBackupFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result));
          if (!payload || payload.app !== APP_ID) throw new Error();
          const state = Ranking.sanitizeState(payload.data, CONFIG.DEFAULTS);
          if (!state) throw new Error();
          resolve(state);
        } catch (e) {
          reject(new Error('Esse arquivo não é uma cópia de segurança do Ranking The Souza.'));
        }
      };
      reader.readAsText(file);
    });
  }

  // Planilha para abrir no Excel (só leitura, não serve para restaurar)
  function exportCsv(rankedClients) {
    const rows = [['Posição', 'Nome', 'Sobrenome', 'Celular', 'Pontos'],
      ...rankedClients.map(c => [c.pos, c.nome, c.sobrenome, c.celular, c.pontos])];
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `ranking-the-souza-${today()}.csv`);
  }

  return { available, load, save, demoState, exportBackup, readBackupFile, exportCsv };
})();
