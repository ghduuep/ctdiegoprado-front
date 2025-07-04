document.addEventListener('DOMContentLoaded', () => {
  console.log('index.js carregado');
  const dashboardUrl = "https://ctdiegoprado-api-production.up.railway.app/api/dashboard-status/";

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
    console.log('Iniciando carga de dados para:', dashboardUrl);
    // Inicializa com "..." enquanto carrega
    cardIds.forEach(id => document.getElementById(id).textContent = '...');

    try {
      // Busca os dados das inscrições
      const response = await authFetch(dashboardUrl);
      console.log('Resposta recebida:', { status: response.status, ok: response.ok });
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Dados recebidos:', data);
      totalClientes = data.totalClientes
      mensalidadesAtivas = data.mensalidadesAtivas
      mensalidadesPausadas = data.mensalidadesPausadas
      mensalidadesExpiradas = data.mensalidadesExpiradas

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