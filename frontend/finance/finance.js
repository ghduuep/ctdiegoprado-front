// students.js

document.addEventListener('DOMContentLoaded', () => {
  (async function loadGanhosTotais() {
    const financialUrl = "https://ctdiegoprado-api-production.up.railway.app/api/financial-summary";
    const cardElem         = document.getElementById("ganhosTotais");

     // ==== Autenticação Token ==== //
  function getToken() {
    return localStorage.getItem('token');
  }

  function redirectToLogin() {
    window.location.href = '../login/login.html';
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

    try {
      const response = await authFetch(financialUrl);
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const total = data.total_mensalidades_ativas

      // Formata como moeda em pt-BR
      cardElem.textContent = total.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });

    } catch (error) {
      console.error("Falha no loadGanhosTotais:", error);
      cardElem.textContent = 'Erro ao carregar';
    }
  })();
});
