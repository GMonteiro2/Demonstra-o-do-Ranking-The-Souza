/*
 * config.js — único lugar com as configurações do sistema.
 *
 * DEMO_MODE:
 *   false = versão FINAL (entrega ao Gustavo)
 *   true  = versão de DEMONSTRAÇÃO (link para o cliente testar)
 *
 * Para trocar de versão, mude só a linha "const DEMO_MODE" abaixo.
 */
const CONFIG = (() => {
  const DEMO_MODE = true;

  return {
    DEMO_MODE,
    MAX_CLIENTS_DEMO: 8,      // limite de clientes na demonstração
    BACKUP_ALERT_DAYS: 7,     // depois de quantos dias avisar para fazer backup
    // Chaves diferentes: demo e versão final nunca misturam dados no mesmo navegador
    STORAGE_KEY: DEMO_MODE ? 'souza-ranking-demo' : 'souza-ranking',
    DEFAULTS: {
      ind: 10,                // pontos por indicação
      plano: 5,               // pontos extras quando o amigo fecha plano
      premio: 'R$ 1.000 no PIX ou 1 mês de corte grátis',
    },
  };
})();
