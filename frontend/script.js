document.addEventListener('DOMContentLoaded', () => {
  console.log('index.js carregado');
  const subscriptionsUrl = "https://ctdiegoprado-api.onrender.com/api/subscriptions/";

   // ==== Autenticação Token ==== //
  function getToken() {
    return localStorage.getItem('token');
  }

  function redirectToLogin() {
    window.location.href = 'login/login.html';
  }

  function authFetch(url, options = {}) {
    const token = getToken();
    if (!token) {
      redirectToLogin();
      return Promise.reject('No token, redirecting to login');
    }
    options.headers = {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
      'Authorization': `Token ${token}`,
    };
    return fetch(url, options).then(resp => {
      if (resp.status === 401 || resp.status === 403) {
        // token inválido ou expirado
        localStorage.removeItem('token');
        redirectToLogin();
        return Promise.reject('Unauthorized');
      }
      return resp;
    });
  }

  function checkAuth() {
    if (!getToken()) {
      redirectToLogin();
    }
  }

  // Verifica autenticação ao carregar a página
  checkAuth();

  // Verifica elementos DOM
  const cardIds = ['totalClientes', 'mensalidadesAtivas', 'mensalidadesPausadas', 'mensalidadesExpiradas'];
  console.log('Elementos DOM:', cardIds.map(id => ({ id, element: document.getElementById(id) })));

  // Função para buscar e exibir os dados do dashboard
  async function loadDashboardData() {
    console.log('Iniciando carga de dados para:', subscriptionsUrl);
    // Inicializa com "..." enquanto carrega
    cardIds.forEach(id => document.getElementById(id).textContent = '...');

    try {
      // Busca os dados das inscrições
      const response = await authFetch(subscriptionsUrl);
      console.log('Resposta recebida:', { status: response.status, ok: response.ok });
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Dados recebidos:', data);

      // Lida com diferentes formatos de resposta
      const subscriptions = Array.isArray(data) ? data : data.results || [];
      console.log('Inscrições:', subscriptions);

      // Se não houver dados, exibe 0
      if (subscriptions.length === 0) {
        console.log('Nenhuma inscrição encontrada');
        cardIds.forEach(id => document.getElementById(id).textContent = '0');
        return;
      }

      // Normaliza status para evitar problemas de maiúsculas/minúsculas
      const normalizeStatus = status => status ? status.toLowerCase() : '';

      // Calcula os totais
      const totalClientes = subscriptions.filter(sub => 
        ['active', 'paused', 'expired'].includes(normalizeStatus(sub.status))
      ).length;

      const mensalidadesAtivas = subscriptions.filter(sub => 
        normalizeStatus(sub.status) === 'active'
      ).length;

      const mensalidadesPausadas = subscriptions.filter(sub => 
        normalizeStatus(sub.status) === 'paused'
      ).length;

      const mensalidadesExpiradas = subscriptions.filter(sub => 
        normalizeStatus(sub.status) === 'expired'
      ).length;

      console.log('Totais:', { totalClientes, mensalidadesAtivas, mensalidadesPausadas, mensalidadesExpiradas });

      // Atualiza os elementos HTML
      document.getElementById('totalClientes').textContent = totalClientes;
      document.getElementById('mensalidadesAtivas').textContent = mensalidadesAtivas;
      document.getElementById('mensalidadesPausadas').textContent = mensalidadesPausadas;
      document.getElementById('mensalidadesExpiradas').textContent = mensalidadesExpiradas;
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      // Exibe mensagem de erro nos cards
      cardIds.forEach(id => document.getElementById(id).textContent = 'Erro');
      // Adiciona alerta visual
      const alert = document.createElement('div');
      alert.className = 'alert alert-danger mt-3';
      alert.textContent = `Erro ao carregar dados: ${error.message}. Verifique se o servidor está ativo em ${subscriptionsUrl}.`;
      document.querySelector('.container.py-5').prepend(alert);
    }
  }

  // Chama a função ao carregar a página
  loadDashboardData();
});