document.addEventListener('DOMContentLoaded', () => {
  const plansUrl = "https://ctdiegoprado-api.onrender.com/api/plans/";
  const planModal = new bootstrap.Modal(document.getElementById('planModal'));
  const cadastroModal = new bootstrap.Modal(document.getElementById('cadastroPlanoModal'));
  const editModal = new bootstrap.Modal(document.getElementById('editPlanModal'));

  let currentPlanId = null;

  let currentPage = 1;
  const itemsPerPage = 10;

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

  // Inicialização
  function init() {
    loadPlans();

    // Configurando event listeners
    document.getElementById('btnCadastrarPlano').addEventListener('click', () => {
      cadastroModal.show();
    });

    // Event listener para o form de cadastro
    document.getElementById('cadastroPlanoForm').addEventListener('submit', handleCadastroSubmit);

    // Event listener para o form de edição
    document.getElementById('editPlanForm').addEventListener('submit', handleEditSubmit);
  }

  // Helper para formatar datas
  function formatDate(dateStr) {
    if (!dateStr) return 'Não definido';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  }

  // Helper para formatar preço
  function formatPrice(price) {
    return price ? `R$ ${parseFloat(price).toFixed(2)}` : 'Não informado';
  }

  // Carrega a lista de planos
  async function loadPlans(page = 1) {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      const url = `${plansUrl}?${params.toString()}`;
      const resp = await authFetch(url);

      const data = await resp.json();
      const ul = document.getElementById('plans-list');
      ul.innerHTML = '';

      if (data.results.length === 0) {
        const li = document.createElement('li');
        li.className = 'list-group-item text-center';
        li.textContent = 'Nenhum plano encontrado.';
        ul.append(li);
        return;
      }

      data.results.forEach(plan => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';

        // Container para informações principais
        const infoDiv = document.createElement('div');

        // Link para detalhes
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'fw-bold';
        link.textContent = plan.name;
        link.addEventListener('click', (e) => {
          e.preventDefault();
          showDetails(plan);
        });

        // Informações de preço e duração
        const info = document.createElement('div');
        info.className = 'text-muted small';
        info.textContent = `Preço: ${formatPrice(plan.price)} | Duração: ${plan.duration_months} meses`;

        infoDiv.append(link, info);

        // Data de criação
        const createdDate = document.createElement('div');
        createdDate.className = 'text-muted small';
        createdDate.textContent = `Criado em: ${formatDate(plan.created_at)}`;

        li.append(infoDiv, createdDate);
        ul.append(li);
      });

      renderPlansPagination(data, page);
    } catch (err) {
      console.error('Erro ao carregar planos:', err);
    }
  }

  function renderPlansPagination(data, page) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    const totalPages = Math.ceil(data.count / itemsPerPage);

    // Botão Anterior
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${!data.previous ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#">Anterior</a>`;
    prevLi.addEventListener('click', e => {
      e.preventDefault();
      if (data.previous) loadPlans(currentPage - 1);
    });
    pagination.appendChild(prevLi);

    // Números de páginas
    for (let i = 1; i <= totalPages; i++) {
      const li = document.createElement('li');
      li.className = `page-item ${i === currentPage ? 'active' : ''}`;
      li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      li.addEventListener('click', e => {
        e.preventDefault();
        loadPlans(i);
      });
      pagination.appendChild(li);
    }

    // Botão Próxima
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${!data.next ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#">Próxima</a>`;
    nextLi.addEventListener('click', e => {
      e.preventDefault();
      if (data.next) loadPlans(currentPage + 1);
    });
    pagination.appendChild(nextLi);
  }

  // Mostra detalhes do plano no modal
  function showDetails(plan) {
    currentPlanId = plan.id;
    const detailsList = document.getElementById('plan-details');
    detailsList.innerHTML = '';

    // Cria lista de detalhes
    const details = [
      { label: 'ID', value: plan.id },
      { label: 'Nome', value: plan.name },
      { label: 'Preço', value: formatPrice(plan.price) },
      { label: 'Duração', value: `${plan.duration_months} meses` },
      { label: 'Descrição', value: plan.description || 'Sem descrição' },
      { label: 'Criado em', value: formatDate(plan.created_at) }
    ];

    details.forEach(detail => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.textContent = `${detail.label}: ${detail.value}`;
      detailsList.append(li);
    });

    document.getElementById('planModalLabel').textContent = plan.name;

    // Configurar botões de ações
    document.getElementById('btnEditarPlano').onclick = () => {
      planModal.hide();
      populateEditForm(plan);
      editModal.show();
    };

    document.getElementById('btnExcluirPlano').onclick = () => {
      if (confirm(`Deseja realmente excluir o plano ${plan.name}?`)) {
        deletePlan(plan.id);
      }
    };

    planModal.show();
  }

  // Preenche o formulário de edição
  function populateEditForm(plan) {
    document.getElementById('editPlanId').value = plan.id;
    document.getElementById('editName').value = plan.name;
    document.getElementById('editDurationMonths').value = plan.duration_months;
    document.getElementById('editPrice').value = plan.price;
    document.getElementById('editDescription').value = plan.description || '';
  }

  // Manipula o envio do formulário de cadastro
  async function handleCadastroSubmit(e) {
    e.preventDefault();

    const plan = {
      name: document.getElementById('name').value,
      duration_months: parseInt(document.getElementById('durationMonths').value),
      price: parseFloat(document.getElementById('price').value),
      description: document.getElementById('description').value || ''
    };

    try {
      const res = await authFetch(plansUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan)
      });

      if (!res.ok) throw new Error('Erro ao cadastrar plano');

      const result = await res.json();
      cadastroModal.hide();

      // Limpa formulário
      document.getElementById('cadastroPlanoForm').reset();

      // Atualiza a lista
      loadPlans();

      alert('Plano cadastrado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar plano.');
    }
  }

  // Manipula o envio do formulário de edição
  async function handleEditSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('editPlanId').value;
    const plan = {
      name: document.getElementById('editName').value,
      duration_months: parseInt(document.getElementById('editDurationMonths').value),
      price: parseFloat(document.getElementById('editPrice').value),
      description: document.getElementById('editDescription').value || ''
    };

    try {
      const res = await authFetch(`${plansUrl}${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan)
      });

      if (!res.ok) throw new Error('Erro ao atualizar plano');

      editModal.hide();
      loadPlans();

      alert('Plano atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar plano.');
    }
  }

  // Função para excluir plano
  async function deletePlan(id) {
    try {
      const res = await authFetch(`${plansUrl}${id}/`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Erro ao excluir plano');

      planModal.hide();
      loadPlans();

      alert('Plano excluído com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir plano.');
    }
  }

  // Inicializa a página
  init();
});