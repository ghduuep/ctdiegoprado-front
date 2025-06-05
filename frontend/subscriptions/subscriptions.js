document.addEventListener('DOMContentLoaded', () => {
  const subscriptionsUrl = "https://ctdiegoprado-api-production.up.railway.app/api/subscriptions/";
  const plansUrl = "https://ctdiegoprado-api-production.up.railway.app/api/plans/";
  const studentsUrl = "https://ctdiegoprado-api-production.up.railway.app/api/students/";
  const subscriptionModal = new bootstrap.Modal(document.getElementById('subscriptionModal'));
  const cadastroModal = new bootstrap.Modal(document.getElementById('cadastroSubscriptionModal'));
  const editModal = new bootstrap.Modal(document.getElementById('editSubscriptionModal'));
  const filterModal = new bootstrap.Modal(document.getElementById('filterModal'));

  const itemsPerPage = 10;
  let currentPage = 1;
  let currentSubscriptionId = null;
  let students = [];
  let plans = [];
  let currentFilters = {
    plan: '',
    status: '',
    search: ''
  };

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

  // Carrega planos para o select
  async function loadPlans() {
    try {
      const resp = await authFetch(plansUrl);
      const data = await resp.json();
      plans = data.results;

      // Popula os selects de planos
      ['planSelect', 'editPlanSelect', 'filterPlan'].forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '<option value="">– Selecione o Plano –</option>';
        plans.forEach(plan => {
          const opt = document.createElement('option');
          opt.value = plan.id;
          opt.textContent = plan.name;
          sel.append(opt);
        });
      });
      return true;
    } catch (err) {
      console.error('Erro ao carregar planos:', err);
      return false;
    }
  }

  // Carrega alunos para o select
  // Carrega alunos para o select
  async function loadStudents() {
    try {
      // Inicializar Select2 com AJAX apenas para studentSelect e editStudentSelect
      ['studentSelect', 'editStudentSelect'].forEach(id => {
        $(`#${id}`).select2({
          placeholder: '– Selecione o Aluno –',
          allowClear: true,
          width: '100%',
          dropdownParent: id === 'studentSelect' ? $('#cadastroSubscriptionModal') : $('#editSubscriptionModal'),
          minimumResultsForSearch: 1,
          ajax: {
            url: studentsUrl,
            dataType: 'json',
            delay: 250, // Atraso para evitar muitas requisições
            // Configuração dos headers com token de autenticação
            beforeSend: function (xhr) {
              const token = getToken();
              if (!token) {
                redirectToLogin();
                return false;
              }
              xhr.setRequestHeader('Content-Type', 'application/json');
              xhr.setRequestHeader('Authorization', `Token ${token}`);
            },
            data: params => ({
              search: params.term, // Termo de busca digitado
              page: params.page || 1 // Página para paginação
            }),
            processResults: (data, params) => {
              params.page = params.page || 1;
              return {
                results: data.results.map(student => ({
                  id: student.id,
                  text: `${student.first_name || ''} ${student.last_name || ''}`
                })),
                pagination: {
                  more: !!data.next // Indica se há mais páginas
                }
              };
            },
            // Tratamento de erro para casos de token inválido
            error: function (xhr, status, error) {
              if (xhr.status === 401 || xhr.status === 403) {
                localStorage.removeItem('token');
                redirectToLogin();
              }
              console.error('Erro na requisição AJAX:', error);
            },
            cache: true
          },
          language: {
            noResults: () => 'Nenhum aluno encontrado',
            searching: () => 'Buscando...',
            inputTooShort: () => 'Digite pelo menos 1 caractere',
            loadingMore: () => 'Carregando mais resultados...'
          }
        });
      });

      // Carregar alunos na variável global apenas para outras funções, se necessário
      let allStudents = [];
      let nextUrl = studentsUrl;
      while (nextUrl) {
        const resp = await authFetch(nextUrl);
        const data = await resp.json();
        allStudents = allStudents.concat(data.results);
        nextUrl = data.next;
      }
      students = allStudents;
      return true;
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
      return false;
    }
  }

  // Inicialização assíncrona
  async function init() {
    // Carrega os dados de referência primeiro
    await Promise.all([loadPlans(), loadStudents()]);

    // Depois carrega as inscrições
    loadSubscriptions();

    // Configurar o botão de filtro
    setupFilterButton();
  }

  // Configurar o botão de filtro e lógica de filtragem
  function setupFilterButton() {
    // Botão para abrir o modal de filtro
    const btnFiltrar = document.getElementById('btnFiltrarSubscription');
    if (btnFiltrar) {
      btnFiltrar.addEventListener('click', () => {
        filterModal.show();
      });
    }

    // Botão para aplicar o filtro
    const applyFilterBtn = document.getElementById('applyFilter');
    if (applyFilterBtn) {
      applyFilterBtn.addEventListener('click', () => {
        // Capturar valores do formulário
        currentFilters = {
          plan: document.getElementById('filterPlan').value,
          status: document.getElementById('filterStatus').value
        };

        // Fechar o modal e carregar inscrições filtradas
        filterModal.hide();
        loadSubscriptions();

        // Exibir um indicador de filtros ativos
        updateFilterIndicator();
      });
    }

    // Botão para limpar filtros (opcional)
    const clearFilterBtn = document.getElementById('clearFilter');
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener('click', () => {
        // Limpar o formulário de filtro
        document.getElementById('filterForm').reset();

        // Limpar filtros ativos
        currentFilters = {
          plan: '',
          status: ''
        };

        // Recarregar inscrições sem filtro
        loadSubscriptions();

        // Atualizar indicador de filtros
        updateFilterIndicator();
      });
    }
  }

  // Atualiza o indicador visual de filtros ativos
  function updateFilterIndicator() {
    const hasActiveFilters = currentFilters.plan || currentFilters.status;
    const btnFiltrar = document.getElementById('btnFiltrarSubscription');

    if (btnFiltrar) {
      if (hasActiveFilters) {
        btnFiltrar.classList.remove('btn-secondary');
        btnFiltrar.classList.add('btn-primary');
        btnFiltrar.textContent = 'Filtros Ativos';
      } else {
        btnFiltrar.classList.remove('btn-primary');
        btnFiltrar.classList.add('btn-secondary');
        btnFiltrar.textContent = 'Filtrar';
      }
    }
  }

  // Helper para mostrar badges de status
  function statusBadge(status) {
    switch (status) {
      case 'active': return 'bg-success';
      case 'paused': return 'bg-warning';
      case 'canceled': return 'bg-danger';
      case 'expired': return 'bg-secondary';
      default: return 'bg-light';
    }
  }

  // Helper para formatar texto de status
  function formatStatus(status) {
    const statusMap = {
      'active': 'Ativa',
      'paused': 'Pausada',
      'canceled': 'Cancelada',
      'expired': 'Expirada'
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Helper para formatar datas
  function formatDate(dateStr) {
    if (!dateStr) return 'Indefinido';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  }

  // Função para encontrar nome do aluno pelo ID
  async function getStudentNameAsync(id) {
  let student = students.find(s => s.id === id);
  if (student) {
    return `${student.first_name || ''} ${student.last_name || ''}`;
  }
  // Busca extra se não encontrar localmente
  try {
    const resp = await authFetch(`${studentsUrl}${id}/`);
    if (!resp.ok) return 'Desconhecido';
    student = await resp.json();
    // Opcional: adicionar ao array global para cache futuro
    students.push(student);
    return `${student.first_name || ''} ${student.last_name || ''}`;
  } catch {
    return 'Desconhecido';
  }
}

  // Função para encontrar nome do plano pelo ID
  function getPlanName(id) {
    const plan = plans.find(p => p.id === id);
    return plan ? plan.name : 'Desconhecido';
  }

  // Carrega a lista de inscrições
  async function loadSubscriptions(page = 1) {
    try {
      currentPage = page;
      // Construir URL com parâmetros de filtro
      let url = subscriptionsUrl;
      const params = new URLSearchParams();

      if (currentFilters.plan) params.append('plan', currentFilters.plan);
      if (currentFilters.status) params.append('status', currentFilters.status);
      if (currentFilters.search) params.append('search', currentFilters.search);

      params.append('page', page);
      // Adicionar parâmetros à URL se houver filtros
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const resp = await authFetch(url);
      const data = await resp.json();
      const ul = document.getElementById('subscriptions-list');
      ul.innerHTML = '';

      if (data.results.length === 0) {
        const li = document.createElement('li');
        li.className = 'list-group-item text-center';
        li.textContent = 'Nenhuma inscrição encontrada.';
        ul.append(li);
        return;
      }

      data.results.forEach(subscription => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';

        // Container para informações principais
        const infoDiv = document.createElement('div');

        // Link para detalhes
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'fw-bold';
        link.textContent = `Inscrição #${subscription.id}`;
        link.addEventListener('click', (e) => {
          e.preventDefault();
          showDetails(subscription);
        });

        // Informações do aluno e plano
        const studentName = getStudentNameAsync(subscription.student);
        const planName = getPlanName(subscription.plan);

        const info = document.createElement('div');
        info.className = 'text-muted small';
        info.textContent = `Aluno: ${studentName} | Plano: ${planName}`;

        infoDiv.append(link, info);

        // Datas
        const dates = document.createElement('div');
        dates.className = 'text-muted small';
        dates.textContent = `${formatDate(subscription.start_date)} → ${formatDate(subscription.end_date)}`;

        // Badge de status
        const statusDiv = document.createElement('div');
        const badge = document.createElement('span');
        badge.className = `badge ${statusBadge(subscription.status)}`;
        badge.textContent = formatStatus(subscription.status);
        statusDiv.append(badge);

        li.append(infoDiv, dates, statusDiv);
        ul.append(li);
      });

      renderSubscriptionsPagination(data, page);
    } catch (err) {
      console.error('Erro ao carregar inscrições:', err);
    }

    document.getElementById('btnSearchSubscription').addEventListener('click', function (e) {
      e.preventDefault(); // Impede que o formulário recarregue a página

      const searchValue = document.getElementById('searchSubscription').value.trim();
      currentFilters.search = searchValue; // Atualiza o filtro global

      loadSubscriptions(1); // Recarrega a lista com o filtro aplicado
    });

  }

  function renderSubscriptionsPagination(data, page) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    const totalPages = Math.ceil(data.count / itemsPerPage);

    // Botão anterior
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${!data.previous ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#">Anterior</a>`;
    prevLi.addEventListener('click', e => {
      e.preventDefault();
      if (data.previous) loadSubscriptions(currentPage - 1);
    });
    pagination.appendChild(prevLi);

    // Páginas
    for (let i = 1; i <= totalPages; i++) {
      const li = document.createElement('li');
      li.className = `page-item ${i === currentPage ? 'active' : ''}`;
      li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      li.addEventListener('click', e => {
        e.preventDefault();
        loadSubscriptions(i);
      });
      pagination.appendChild(li);
    }

    // Botão próxima
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${!data.next ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#">Próxima</a>`;
    nextLi.addEventListener('click', e => {
      e.preventDefault();
      if (data.next) loadSubscriptions(currentPage + 1);
    });
    pagination.appendChild(nextLi);
  }

  // Mostra detalhes da inscrição no modal
  function showDetails(subscription) {
    currentSubscriptionId = subscription.id;
    const detailsList = document.getElementById('subscription-details');
    detailsList.innerHTML = '';

    // Obtém nomes do aluno e plano
    const studentName = getStudentNameAsync(subscription.student);
    const planName = getPlanName(subscription.plan);

    // Cria lista de detalhes
    const details = [
      { label: 'ID', value: subscription.id },
      { label: 'Aluno', value: studentName },
      { label: 'Plano', value: planName },
      { label: 'Data de início', value: formatDate(subscription.start_date) },
      { label: 'Data de fim', value: formatDate(subscription.end_date) },
      { label: 'Status', value: subscription.status, badge: true }
    ];

    details.forEach(detail => {
      const li = document.createElement('li');
      li.className = 'list-group-item';

      if (detail.badge) {
        li.textContent = `${detail.label}: `;
        const badge = document.createElement('span');
        badge.className = `badge ${statusBadge(detail.value)}`;
        badge.textContent = formatStatus(detail.value);
        li.append(badge);
      } else {
        li.textContent = `${detail.label}: ${detail.value}`;
      }

      detailsList.append(li);
    });

    document.getElementById('subscriptionModalLabel').textContent = `Inscrição #${subscription.id}`;

    // Configurar botões de ações
    document.getElementById('btnEditarSubscription').onclick = () => {
      subscriptionModal.hide();
      populateEditForm(subscription);
      editModal.show();
    };

    document.getElementById('btnExcluirSubscription').onclick = () => {
      if (confirm(`Deseja realmente excluir a inscrição #${subscription.id}?`)) {
        deleteSubscription(subscription.id);
      }
    };

    subscriptionModal.show();
  }

  // Preenche o formulário de edição
  function populateEditForm(subscription) {
    document.getElementById('editSubId').value = subscription.id;
    document.getElementById('editStudentSelect').value = subscription.student;
    document.getElementById('editPlanSelect').value = subscription.plan;
    document.getElementById('editSubStatus').value = subscription.status;
    document.getElementById('editStartDate').value = subscription.start_date;
    document.getElementById('editEndDate').value = subscription.end_date || '';
  }

  // Cadastro de nova inscrição
  document.getElementById('btnCadastrarSubscription').addEventListener('click', () => {
    cadastroModal.show();
  });

  // Envio do formulário de cadastro
  document.getElementById('cadastroSubscriptionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const subscription = {
      student: parseInt(document.getElementById('studentSelect').value),
      plan: parseInt(document.getElementById('planSelect').value),
      start_date: document.getElementById('startDate').value,
      end_date: document.getElementById('endDate').value || null,
      status: document.getElementById('subStatus').value,
    };

    try {
      const res = await authFetch(subscriptionsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      if (!res.ok) throw new Error('Erro ao cadastrar inscrição');

      const result = await res.json();
      cadastroModal.hide();

      // Limpa formulário
      document.getElementById('cadastroSubscriptionForm').reset();

      // Atualiza a lista
      loadSubscriptions();

      alert('Inscrição cadastrada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar inscrição.');
    }
  });

  // Envio do formulário de edição
  document.getElementById('editSubscriptionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('editSubId').value;
    const subscription = {
      student: parseInt(document.getElementById('editStudentSelect').value),
      plan: parseInt(document.getElementById('editPlanSelect').value),
      start_date: document.getElementById('editStartDate').value,
      end_date: document.getElementById('editEndDate').value || null,
      status: document.getElementById('editSubStatus').value,
    };

    try {
      const res = await authFetch(`${subscriptionsUrl}${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      if (!res.ok) throw new Error('Erro ao atualizar inscrição');

      editModal.hide();
      loadSubscriptions();

      alert('Inscrição atualizada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar inscrição.');
    }
  });

  // Função para excluir inscrição
  async function deleteSubscription(id) {
    try {
      const res = await authFetch(`${subscriptionsUrl}${id}/`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Erro ao excluir inscrição');

      subscriptionModal.hide();
      loadSubscriptions();

      alert('Inscrição excluída com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir inscrição.');
    }
  }

  // Carrega dados iniciais
  init();
});