document.addEventListener('DOMContentLoaded', () => {
  const subscriptionsUrl = "http://127.0.0.1:8000/api/subscriptions/";
  const plansUrl = "http://127.0.0.1:8000/api/plans/";
  const studentsUrl = "http://127.0.0.1:8000/api/students/";
  const subscriptionModal = new bootstrap.Modal(document.getElementById('subscriptionModal'));
  const cadastroModal = new bootstrap.Modal(document.getElementById('cadastroSubscriptionModal'));
  const editModal = new bootstrap.Modal(document.getElementById('editSubscriptionModal'));
  const filterModal = new bootstrap.Modal(document.getElementById('filterModal'));

  let currentSubscriptionId = null;
  let students = [];
  let plans = [];
  let currentFilters = {
    plan: '',
    status: ''
  };

  // Carrega planos para o select
  async function loadPlans() {
    try {
      const resp = await fetch(plansUrl);
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
  async function loadStudents() {
    try {
      const resp = await fetch(studentsUrl);
      const data = await resp.json();
      students = data.results;

      // Popula os selects de alunos
      ['studentSelect', 'editStudentSelect', 'filterStudent'].forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '<option value="">– Selecione o Aluno –</option>';
        students.forEach(student => {
          const opt = document.createElement('option');
          opt.value = student.id;
          opt.textContent = `${student.first_name || ''} ${student.last_name || ''}`;
          sel.append(opt);
        });
      });
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
      'active': 'Ativo',
      'paused': 'Pausado',
      'canceled': 'Cancelado',
      'expired': 'Expirado'
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
  function getStudentName(id) {
    const student = students.find(s => s.id === id);
    return student ? `${student.first_name || ''} ${student.last_name || ''}` : 'Desconhecido';
  }

  // Função para encontrar nome do plano pelo ID
  function getPlanName(id) {
    const plan = plans.find(p => p.id === id);
    return plan ? plan.name : 'Desconhecido';
  }

  // Carrega a lista de inscrições
  async function loadSubscriptions() {
    try {
      // Construir URL com parâmetros de filtro
      let url = subscriptionsUrl;
      const params = new URLSearchParams();

      if (currentFilters.plan) params.append('plan', currentFilters.plan);
      if (currentFilters.status) params.append('status', currentFilters.status);

      // Adicionar parâmetros à URL se houver filtros
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const resp = await fetch(url);
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
        const studentName = getStudentName(subscription.student);
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
    } catch (err) {
      console.error('Erro ao carregar inscrições:', err);
    }
  }

  // Mostra detalhes da inscrição no modal
  function showDetails(subscription) {
    currentSubscriptionId = subscription.id;
    const detailsList = document.getElementById('subscription-details');
    detailsList.innerHTML = '';

    // Obtém nomes do aluno e plano
    const studentName = getStudentName(subscription.student);
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
      const res = await fetch(subscriptionsUrl, {
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
      const res = await fetch(`${subscriptionsUrl}${id}/`, {
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
      const res = await fetch(`${subscriptionsUrl}${id}/`, {
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