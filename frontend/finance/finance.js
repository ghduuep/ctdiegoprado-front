// students.js

document.addEventListener('DOMContentLoaded', () => {
  (async function loadGanhosTotais() {
    const subscriptionsUrl = "http://127.0.0.1:8000/api/subscriptions/?status=active";
    const plansUrl         = "http://127.0.0.1:8000/api/plans/";
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
      console.log("→ Chamando inscrição ativa em:", subscriptionsUrl);
      console.log("→ Chamando lista de planos em:  ", plansUrl);

      const [subsRes, plansRes] = await Promise.all([
        authFetch(subscriptionsUrl),
        authFetch(plansUrl)
      ]);

      console.log("← subscriptions response:", subsRes.url, subsRes.status);
      console.log("← plans response:        ", plansRes.url, plansRes.status);

      if (!subsRes.ok) {
        throw new Error(`Erro ao buscar assinaturas: ${subsRes.status}`);
      }
      if (!plansRes.ok) {
        throw new Error(`Erro ao buscar planos: ${plansRes.status}`);
      }

      // Parse JSON
      const subsData = await subsRes.json();
      const plansData = await plansRes.json();

      // DEBUG: veja o formato completo
      console.log("subscriptions JSON:", subsData);
      console.log("plans JSON:", plansData);

      // Se vier paginado, pegue .results, senão use direto
      const subscriptions = Array.isArray(subsData)
        ? subsData
        : (Array.isArray(subsData.results) ? subsData.results : []);
      const plans = Array.isArray(plansData)
        ? plansData
        : (Array.isArray(plansData.results) ? plansData.results : []);

      // Mapeia plan.id → plan.price (Number)
      const planValueMap = new Map();
      plans.forEach(plan => {
        planValueMap.set(plan.id, parseFloat(plan.price));
      });

      // Soma os valores dos planos das assinaturas ativas
      const total = subscriptions.reduce((sum, sub) => {
        const valorPlano = planValueMap.get(sub.plan) || 0;
        return sum + valorPlano;
      }, 0);

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
