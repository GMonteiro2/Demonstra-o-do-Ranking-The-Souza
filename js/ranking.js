/*
 * ranking.js — regras do sistema (lógica pura).
 *
 * Aqui não existe tela nem navegador: só funções que recebem dados e
 * devolvem resultados. Por isso dá para testar tudo com `node tests/ranking.test.js`.
 */
const Ranking = (() => {
  'use strict';

  const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  const NAME_RE = /^\p{L}[\p{L}'’ -]*$/u;
  const MAX_POINTS = 99999;

  // ---------- utilidades ----------
  function clampInt(v, min, max, fallback) {
    if (v === '' || v == null) return fallback;
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function newId() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ---------- celular ----------
  function phoneDigits(v) {
    return String(v == null ? '' : v).replace(/\D/g, '');
  }

  function formatPhone(v) {
    const d = phoneDigits(v).slice(0, 11);
    if (d.length < 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  // Celular brasileiro: DDD (11 a 99) + 9 + 8 dígitos = 11 dígitos
  function isValidPhone(v) {
    const d = phoneDigits(v);
    return d.length === 11 && d[2] === '9' && Number(d.slice(0, 2)) >= 11;
  }

  // ---------- nomes ----------
  // keepLeadingParticle: no sobrenome, "da Silva" mantém o "da" minúsculo mesmo na primeira palavra
  function titleCase(s, keepLeadingParticle = false) {
    return String(s)
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .split(' ')
      .map((w, i) => ((i > 0 || keepLeadingParticle) && PARTICLES.has(w) ? w : w.replace(/(^|[-'’])\p{L}/gu, m => m.toUpperCase())))
      .join(' ');
  }

  // ---------- cadastro ----------
  function validateClient(input, clients) {
    const nomeRaw = String(input.nome || '').trim();
    const sobreRaw = String(input.sobrenome || '').trim();

    if (!nomeRaw || !sobreRaw) return { ok: false, error: 'Preencha nome e sobrenome.' };
    if (!NAME_RE.test(nomeRaw) || !NAME_RE.test(sobreRaw)) {
      return { ok: false, error: 'Use apenas letras no nome e no sobrenome.' };
    }
    if (nomeRaw.length > 30 || sobreRaw.length > 40) {
      return { ok: false, error: 'Nome ou sobrenome muito longo.' };
    }
    if (!isValidPhone(input.celular)) {
      return { ok: false, error: 'Celular inválido. Use DDD + 9 + número (11 dígitos).' };
    }
    const d = phoneDigits(input.celular);
    if (clients.some(c => phoneDigits(c.celular) === d)) {
      return { ok: false, error: 'Esse celular já está cadastrado.' };
    }
    return {
      ok: true,
      value: { nome: titleCase(nomeRaw), sobrenome: titleCase(sobreRaw, true), celular: formatPhone(d) },
    };
  }

  // ---------- pontos e ranking ----------
  function pointsFor(cfg, kind) {
    return kind === 'plano' ? cfg.ind + cfg.plano : cfg.ind;
  }

  // Ordena por pontos (maior primeiro), desempata por nome.
  // Quem tem a mesma pontuação fica na mesma posição (1, 2, 2, 4).
  function rankClients(clients) {
    const sorted = [...clients].sort(
      (a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR')
    );
    let pos = 0;
    return sorted.map((c, i) => {
      if (i === 0 || c.pontos !== sorted[i - 1].pontos) pos = i + 1;
      return { ...c, pos };
    });
  }

  // ---------- validação de dados guardados / importados ----------
  function sanitizeState(raw, defaults) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.clients)) return null;

    const seen = new Set();
    const clients = [];
    for (const c of raw.clients) {
      if (!c || typeof c !== 'object') continue;
      const nome = String(c.nome || '').trim().slice(0, 30);
      const sobrenome = String(c.sobrenome || '').trim().slice(0, 40);
      const d = phoneDigits(c.celular);
      if (!nome || !sobrenome || d.length !== 11 || seen.has(d)) continue;
      seen.add(d);
      clients.push({
        id: String(c.id || newId()).slice(0, 40),
        nome,
        sobrenome,
        celular: formatPhone(d),
        pontos: clampInt(c.pontos, 0, MAX_POINTS, 0),
      });
    }

    const cfgIn = raw.cfg && typeof raw.cfg === 'object' ? raw.cfg : {};
    const cfg = {
      ind: clampInt(cfgIn.ind, 1, 999, defaults.ind),
      plano: clampInt(cfgIn.plano, 0, 999, defaults.plano),
      premio: String(cfgIn.premio || defaults.premio).slice(0, 60),
    };
    const lastBackup =
      typeof raw.lastBackup === 'string' && !Number.isNaN(Date.parse(raw.lastBackup)) ? raw.lastBackup : null;

    return { cfg, clients, lastBackup };
  }

  // ---------- backup ----------
  function daysSince(iso, now = new Date()) {
    const a = new Date(iso);
    const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((day(now) - day(a)) / 86400000);
  }

  function backupStatus(lastBackup, clientCount, alertDays, now = new Date()) {
    if (clientCount === 0) return { text: 'Nenhum dado para salvar ainda', level: 'none' };
    if (!lastBackup) return { text: 'Cópia de segurança: ainda não feita', level: 'warn' };
    const n = daysSince(lastBackup, now);
    const text = n <= 0 ? 'Última cópia: hoje' : n === 1 ? 'Última cópia: ontem' : `Última cópia: há ${n} dias`;
    return { text, level: n >= alertDays ? 'warn' : 'ok' };
  }

  const api = {
    MAX_POINTS, clampInt, newId, phoneDigits, formatPhone, isValidPhone, titleCase,
    validateClient, pointsFor, rankClients, sanitizeState, daysSince, backupStatus,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
