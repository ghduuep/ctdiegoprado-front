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
  let students = []; // Stores all student data
  let plans = [];    // Stores all plan data
  let currentFilters = {
    plan: '',
    status: '',
    search: ''
  };

  // ==== Authentication Token ==== //
  function getToken() {
    return localStorage.getItem('token');
  }

  function redirectToLogin() {
    window.location.href = '../login/login.html'; // Adjust path as needed
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

  checkAuth(); // Verify authentication on page load

  // Load plans for select elements
  async function loadPlans() {
    try {
      const resp = await authFetch(plansUrl);
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const data = await resp.json();
      plans = data.results || []; // Ensure plans is an array

      ['planSelect', 'editPlanSelect', 'filterPlan'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
          sel.innerHTML = '<option value="">– Selecione o Plano –</option>';
          plans.forEach(plan => {
            const opt = document.createElement('option');
            opt.value = plan.id;
            opt.textContent = plan.name;
            sel.append(opt);
          });
        }
      });
      return true;
    } catch (err) {
      console.error('Erro ao carregar planos:', err);
      // Consider showing a user-friendly error message
      return false;
    }
  }

  // Load students for select elements and global array
  async function loadStudents() {
    try {
      // Initialize Select2 with AJAX for student selection in modals
      ['studentSelect', 'editStudentSelect'].forEach(id => {
        const selectElement = $(`#${id}`);
        if (selectElement.length) { // Check if element exists
          selectElement.select2({
            placeholder: '– Selecione o Aluno –',
            allowClear: true,
            width: '100%',
            dropdownParent: id === 'studentSelect' ? $('#cadastroSubscriptionModal') : $('#editSubscriptionModal'),
            minimumInputLength: 1, // Start searching after 1 character
            ajax: {
              url: studentsUrl,
              dataType: 'json',
              delay: 250,
              beforeSend: function (xhr) {
                const token = getToken();
                if (!token) {
                  redirectToLogin();
                  return false; // Prevent request if no token
                }
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('Authorization', `Token ${token}`);
              },
              data: params => ({
                search: params.term,
                page: params.page || 1
              }),
              processResults: (data, params) => {
                params.page = params.page || 1;
                return {
                  results: (data.results || []).map(student => ({
                    id: student.id, // This ID is used as the value in Select2
                    text: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Aluno sem nome'
                  })),
                  pagination: {
                    more: !!data.next
                  }
                };
              },
              error: function (xhr, status, error) {
                if (xhr.status === 401 || xhr.status === 403) {
                  localStorage.removeItem('token');
                  redirectToLogin();
                }
                console.error('Erro na requisição AJAX do Select2:', error);
              },
              cache: true
            },
            language: {
              noResults: () => 'Nenhum aluno encontrado',
              searching: () => 'Buscando...',
              inputTooShort: args => `Digite pelo menos ${args.minimum - args.input.length} caractere(s)`,
              loadingMore: () => 'Carregando mais resultados...'
            }
          });
        }
      });

      // Load all students into the global 'students' array for getStudentName
      let allStudents = [];
      let nextUrl = studentsUrl;
      while (nextUrl) {
        const resp = await authFetch(nextUrl);
        if (!resp.ok) throw new Error(`HTTP error while fetching all students! status: ${resp.status}`);
        const data = await resp.json();
        allStudents = allStudents.concat(data.results || []);
        nextUrl = data.next;
      }
      students = allStudents;
      return true;
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
      // Consider showing a user-friendly error message
      return false;
    }
  }

  // Asynchronous initialization
  async function init() {
    // Load reference data first
    const plansLoaded = await loadPlans();
    const studentsLoaded = await loadStudents();

    if (plansLoaded && studentsLoaded) {
      // Then load subscriptions that depend on plans and students
      loadSubscriptions();
    } else {
      console.error("Falha ao carregar dados essenciais (planos ou alunos). A lista de inscrições pode não funcionar corretamente.");
      // Optionally display an error to the user
       const ul = document.getElementById('subscriptions-list');
       if(ul) {
           ul.innerHTML = '<li class="list-group-item text-center text-danger">Erro ao carregar dados. Tente recarregar a página.</li>';
       }
    }
    setupFilterButton();
  }

  // Configure filter button and logic
  function setupFilterButton() {
    const btnFiltrar = document.getElementById('btnFiltrarSubscription');
    if (btnFiltrar) {
      btnFiltrar.addEventListener('click', () => {
        filterModal.show();
      });
    }

    const applyFilterBtn = document.getElementById('applyFilter');
    if (applyFilterBtn) {
      applyFilterBtn.addEventListener('click', () => {
        currentFilters = {
          plan: document.getElementById('filterPlan').value,
          status: document.getElementById('filterStatus').value,
          search: currentFilters.search // Keep existing search term
        };
        filterModal.hide();
        loadSubscriptions(1); // Reset to page 1 with new filters
        updateFilterIndicator();
      });
    }

    const clearFilterBtn = document.getElementById('clearFilter');
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener('click', () => {
        const filterForm = document.getElementById('filterForm');
        if (filterForm) filterForm.reset();
        
        currentFilters = {
          plan: '',
          status: '',
          search: currentFilters.search // Keep existing search term unless cleared separately
        };
        // If you want to clear search on "Clear Filters" too:
        // document.getElementById('searchSubscription').value = '';
        // currentFilters.search = '';
        
        filterModal.hide(); // Optionally hide if it was open
        loadSubscriptions(1);
        updateFilterIndicator();
      });
    }
  }
  
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

  // Helper for status badges
  function statusBadge(status) {
    switch (status) {
      case 'active': return 'bg-success';
      case 'paused': return 'bg-warning text-dark'; // Added text-dark for better contrast on yellow
      case 'canceled': return 'bg-danger';
      case 'expired': return 'bg-secondary';
      default: return 'bg-light text-dark'; // Added text-dark for better contrast on light
    }
  }

  // Helper for formatting status text
  function formatStatus(status) {
    const statusMap = {
      'active': 'Ativa',
      'paused': 'Pausada',
      'canceled': 'Cancelada',
      'expired': 'Expirada'
    };
    return statusMap[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Indefinido');
  }

  // Helper for formatting dates
  function formatDate(dateStr) {
    if (!dateStr) return 'Indefinido';
    try {
      const date = new Date(dateStr);
      // Check if date is valid after parsing
      if (isNaN(date.getTime())) {
        return 'Data inválida';
      }
      return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); // Added timeZone UTC to avoid off-by-one day issues if API provides date only
    } catch (e) {
      console.error("Error formatting date:", dateStr, e);
      return 'Data inválida';
    }
  }

  // Function to find student name by ID
  function getStudentName(id) {
    if (id === null || id === undefined) return 'Desconhecido (ID não fornecido)';
    // Ensure 'id' is an integer for comparison, as subscription.student is parsed to int.
    const studentIdToFind = parseInt(id, 10);

    const student = students.find(s => {
      // Ensure s.id is also treated as an integer for comparison.
      return parseInt(s.id, 10) === studentIdToFind;
    });

    if (!student) {
      // console.warn(`Student not found for ID: ${studentIdToFind}. Available student IDs:`, students.map(s => s.id));
      return 'Desconhecido';
    }
    return `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Aluno sem nome';
  }

  // Function to find plan name by ID
  function getPlanName(id) {
    if (id === null || id === undefined) return 'Desconhecido (ID não fornecido)';
    // Ensure 'id' is an integer for comparison.
    const planIdToFind = parseInt(id, 10);

    const plan = plans.find(p => {
      // Ensure p.id is also treated as an integer for comparison.
      return parseInt(p.id, 10) === planIdToFind;
    });
    
    if (!plan) {
        // console.warn(`Plan not found for ID: ${planIdToFind}. Available plan IDs:`, plans.map(p => p.id));
        return 'Desconhecido';
    }
    return plan.name || 'Plano sem nome';
  }

  // Load the list of subscriptions
  async function loadSubscriptions(page = 1) {
    try {
      currentPage = page;
      let url = new URL(subscriptionsUrl);
      
      if (currentFilters.plan) url.searchParams.append('plan', currentFilters.plan);
      if (currentFilters.status) url.searchParams.append('status', currentFilters.status);
      if (currentFilters.search) url.searchParams.append('search', currentFilters.search);
      url.searchParams.append('page', page);
      // itemsPerPage is managed by backend pagination by default, if not, add:
      // url.searchParams.append('page_size', itemsPerPage);


      const resp = await authFetch(url.toString());
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const data = await resp.json();
      
      const ul = document.getElementById('subscriptions-list');
      if (!ul) return; // Element not found
      ul.innerHTML = '';

      if (!data.results || data.results.length === 0) {
        const li = document.createElement('li');
        li.className = 'list-group-item text-center';
        li.textContent = 'Nenhuma inscrição encontrada.';
        ul.append(li);
        renderSubscriptionsPagination(data, page); // Still render pagination for "0 results" state
        return;
      }

      data.results.forEach(subscription => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex flex-wrap justify-content-between align-items-center'; // Added flex-wrap

        const infoDiv = document.createElement('div');
        infoDiv.className = 'me-3 mb-2 mb-md-0'; // Margin for spacing

        const link = document.createElement('a');
        link.href = '#';
        link.className = 'fw-bold d-block'; // d-block for better layout
        link.textContent = `Inscrição #${subscription.id}`;
        link.addEventListener('click', (e) => {
          e.preventDefault();
          showDetails(subscription);
        });

        const studentName = getStudentName(subscription.student);
        const planName = getPlanName(subscription.plan);

        const subInfo = document.createElement('div');
        subInfo.className = 'text-muted small';
        subInfo.textContent = `Aluno: ${studentName} | Plano: ${planName}`;
        
        infoDiv.append(link, subInfo);

        const dates = document.createElement('div');
        dates.className = 'text-muted small me-3 mb-2 mb-md-0';
        dates.textContent = `${formatDate(subscription.start_date)} → ${formatDate(subscription.end_date)}`;

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
      const ul = document.getElementById('subscriptions-list');
      if (ul) {
        ul.innerHTML = '<li class="list-group-item text-center text-danger">Erro ao carregar inscrições. Tente novamente.</li>';
      }
    }
  }
  
  // Event listener for search button
  const searchButton = document.getElementById('btnSearchSubscription');
  if (searchButton) {
      searchButton.addEventListener('click', function (e) {
          e.preventDefault(); 
          const searchInput = document.getElementById('searchSubscription');
          if (searchInput) {
              currentFilters.search = searchInput.value.trim();
              loadSubscriptions(1); // Reload list with search filter, reset to page 1
          }
      });
  }
  // Optional: Add event listener for 'Enter' key on search input
  const searchInput = document.getElementById('searchSubscription');
  if (searchInput) {
      searchInput.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
              e.preventDefault();
              currentFilters.search = searchInput.value.trim();
              loadSubscriptions(1);
          }
      });
  }


  function renderSubscriptionsPagination(data, currentPage) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    pagination.innerHTML = '';
    
    // Ensure data and data.count are available
    const totalItems = data.count || 0;
    const totalPages = Math.ceil(totalItems / itemsPerPage); // itemsPerPage should match backend if backend controls page size

    if (totalPages <= 1 && totalItems === 0 && !currentFilters.search && !currentFilters.plan && !currentFilters.status) {
        // Optionally hide pagination if only one page or no results unless filters are active
        // pagination.style.display = 'none'; // Or just don't render anything
        return;
    }
    // pagination.style.display = 'flex'; // Ensure it's visible


    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${!data.previous ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.textContent = 'Anterior';
    prevLink.addEventListener('click', e => {
      e.preventDefault();
      if (data.previous) {
        // Extract page number from previous URL or decrement current page
        try {
            const prevUrl = new URL(data.previous);
            loadSubscriptions(parseInt(prevUrl.searchParams.get('page') || currentPage - 1, 10));
        } catch {
            loadSubscriptions(currentPage - 1);
        }
      }
    });
    prevLi.appendChild(prevLink);
    pagination.appendChild(prevLi);

    // Page numbers (simplified for brevity, could add ellipsis for many pages)
    // Determine start and end page numbers for display
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (currentPage <= 3) {
        endPage = Math.min(totalPages, 5);
    }
    if (currentPage > totalPages - 3) {
        startPage = Math.max(1, totalPages - 4);
    }


    if (startPage > 1) {
        const firstLi = document.createElement('li');
        firstLi.className = 'page-item';
        const firstLink = document.createElement('a');
        firstLink.className = 'page-link';
        firstLink.href = '#';
        firstLink.textContent = '1';
        firstLink.addEventListener('click', e => { e.preventDefault(); loadSubscriptions(1); });
        firstLi.appendChild(firstLink);
        pagination.appendChild(firstLi);
        if (startPage > 2) {
            const ellipsisLi = document.createElement('li');
            ellipsisLi.className = 'page-item disabled';
            ellipsisLi.innerHTML = `<span class="page-link">...</span>`;
            pagination.appendChild(ellipsisLi);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
      const li = document.createElement('li');
      li.className = `page-item ${i === currentPage ? 'active' : ''}`;
      const link = document.createElement('a');
      link.className = 'page-link';
      link.href = '#';
      link.textContent = i;
      link.addEventListener('click', (e => {
        return function(event) {
          event.preventDefault();
          loadSubscriptions(e);
        }
      })(i)); // Closure to capture correct 'i'
      li.appendChild(link);
      pagination.appendChild(li);
    }

     if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsisLi = document.createElement('li');
            ellipsisLi.className = 'page-item disabled';
            ellipsisLi.innerHTML = `<span class="page-link">...</span>`;
            pagination.appendChild(ellipsisLi);
        }
        const lastLi = document.createElement('li');
        lastLi.className = 'page-item';
        const lastLink = document.createElement('a');
        lastLink.className = 'page-link';
        lastLink.href = '#';
        lastLink.textContent = totalPages;
        lastLink.addEventListener('click', e => { e.preventDefault(); loadSubscriptions(totalPages); });
        lastLi.appendChild(lastLink);
        pagination.appendChild(lastLi);
    }

    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${!data.next ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.textContent = 'Próxima';
    nextLink.addEventListener('click', e => {
      e.preventDefault();
      if (data.next) {
        try {
            const nextUrl = new URL(data.next);
            loadSubscriptions(parseInt(nextUrl.searchParams.get('page') || currentPage + 1, 10));
        } catch {
            loadSubscriptions(currentPage + 1);
        }
      }
    });
    nextLi.appendChild(nextLink);
    pagination.appendChild(nextLi);
  }

  // Show subscription details in modal
  function showDetails(subscription) {
    currentSubscriptionId = subscription.id;
    const detailsList = document.getElementById('subscription-details');
    if (!detailsList) return;
    detailsList.innerHTML = '';

    const studentName = getStudentName(subscription.student);
    const planName = getPlanName(subscription.plan);

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
      const strong = document.createElement('strong');
      strong.textContent = `${detail.label}: `;
      li.appendChild(strong);

      if (detail.badge) {
        const badge = document.createElement('span');
        badge.className = `badge ${statusBadge(detail.value)}`;
        badge.textContent = formatStatus(detail.value);
        li.append(badge);
      } else {
        li.append(document.createTextNode(String(detail.value)));
      }
      detailsList.append(li);
    });
    
    const modalLabel = document.getElementById('subscriptionModalLabel');
    if (modalLabel) modalLabel.textContent = `Detalhes da Inscrição #${subscription.id}`;

    const btnEditar = document.getElementById('btnEditarSubscription');
    if(btnEditar) btnEditar.onclick = () => {
      subscriptionModal.hide();
      populateEditForm(subscription); // Pass the full subscription object
      editModal.show();
    };

    const btnExcluir = document.getElementById('btnExcluirSubscription');
    // Custom confirm modal logic should be implemented here instead of window.confirm
    if(btnExcluir) btnExcluir.onclick = () => {
        // Replace with a custom confirmation modal for better UX
        // For now, using a simple confirm for demonstration
        if (window.confirm(`Deseja realmente excluir a inscrição #${subscription.id}? Esta ação não pode ser desfeita.`)) {
             deleteSubscription(subscription.id);
        }
    };
    subscriptionModal.show();
  }
  
  // Pre-fill the edit form
  function populateEditForm(subscription) {
    document.getElementById('editSubId').value = subscription.id;
    
    // For Select2, you need to set the value and potentially add the option if not present
    const studentSelect = $('#editStudentSelect');
    if (studentSelect.find(`option[value='${subscription.student}']`).length) {
        studentSelect.val(subscription.student).trigger('change');
    } else {
        // If student might not be in the initial list loaded by Select2's AJAX (e.g. due to pagination)
        // Fetch student details to create an option and append it
        const studentName = getStudentName(subscription.student); // Or fetch from API if name not in global `students`
        const option = new Option(studentName || `Aluno ID ${subscription.student}`, subscription.student, true, true);
        studentSelect.append(option).trigger('change');
    }

    document.getElementById('editPlanSelect').value = subscription.plan;
    document.getElementById('editSubStatus').value = subscription.status;
    
    // Dates need to be in YYYY-MM-DD format for date inputs
    document.getElementById('editStartDate').value = subscription.start_date ? subscription.start_date.split('T')[0] : '';
    document.getElementById('editEndDate').value = subscription.end_date ? subscription.end_date.split('T')[0] : '';
  }


  // Handle new subscription form submission
  const cadastroForm = document.getElementById('cadastroSubscriptionForm');
  if (cadastroForm) {
    cadastroForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentId = document.getElementById('studentSelect').value;
      const planId = document.getElementById('planSelect').value;
      const startDate = document.getElementById('startDate').value;

      if (!studentId || !planId || !startDate) {
        // Replace alert with a more robust validation message display
        alert('Aluno, Plano e Data de Início são obrigatórios.');
        return;
      }

      const subscriptionData = {
        student: parseInt(studentId, 10),
        plan: parseInt(planId, 10),
        start_date: startDate,
        end_date: document.getElementById('endDate').value || null,
        status: document.getElementById('subStatus').value,
      };

      try {
        const res = await authFetch(subscriptionsUrl, {
          method: 'POST',
          body: JSON.stringify(subscriptionData)
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({detail: 'Erro ao cadastrar. Verifique os dados.'}));
            throw new Error(errorData.detail || `Erro HTTP ${res.status}`);
        }
        
        // const result = await res.json(); // If needed
        cadastroModal.hide();
        cadastroForm.reset();
        $('#studentSelect').val(null).trigger('change'); // Reset Select2

        loadSubscriptions(currentPage); // Reload to current page or page 1
        alert('Inscrição cadastrada com sucesso!'); // Replace with better notification
      } catch (err) {
        console.error('Erro ao cadastrar inscrição:', err);
        alert(`Erro ao cadastrar inscrição: ${err.message}`); // Replace
      }
    });
  }
  
  // Open modal for new subscription
  const btnCadastrar = document.getElementById('btnCadastrarSubscription');
  if(btnCadastrar) {
      btnCadastrar.addEventListener('click', () => {
        // Reset form before showing
        const form = document.getElementById('cadastroSubscriptionForm');
        if(form) form.reset();
        $('#studentSelect').val(null).trigger('change'); // Reset select2 field
        $('#planSelect').val("").trigger('change'); // Reset regular select
        $('#subStatus').val("active"); // Default status
        
        cadastroModal.show();
      });
  }


  // Handle edit subscription form submission
  const editForm = document.getElementById('editSubscriptionForm');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editSubId').value;
      const studentId = document.getElementById('editStudentSelect').value;
      const planId = document.getElementById('editPlanSelect').value;
      const startDate = document.getElementById('editStartDate').value;

      if (!studentId || !planId || !startDate) {
        alert('Aluno, Plano e Data de Início são obrigatórios.'); // Replace
        return;
      }

      const subscriptionData = {
        student: parseInt(studentId, 10),
        plan: parseInt(planId, 10),
        start_date: startDate,
        end_date: document.getElementById('editEndDate').value || null,
        status: document.getElementById('editSubStatus').value,
      };

      try {
        const res = await authFetch(`${subscriptionsUrl}${id}/`, {
          method: 'PUT',
          body: JSON.stringify(subscriptionData)
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({detail: 'Erro ao atualizar. Verifique os dados.'}));
            throw new Error(errorData.detail || `Erro HTTP ${res.status}`);
        }
        editModal.hide();
        loadSubscriptions(currentPage); // Stay on current page after edit
        alert('Inscrição atualizada com sucesso!'); // Replace
      } catch (err) {
        console.error('Erro ao atualizar inscrição:', err);
        alert(`Erro ao atualizar inscrição: ${err.message}`); // Replace
      }
    });
  }

  // Function to delete subscription
  async function deleteSubscription(id) {
    try {
      const res = await authFetch(`${subscriptionsUrl}${id}/`, {
        method: 'DELETE'
      });
      if (!res.ok && res.status !== 204) { // 204 No Content is a success for DELETE
         const errorData = await res.json().catch(() => ({detail: 'Erro ao excluir.'}));
         throw new Error(errorData.detail || `Erro HTTP ${res.status}`);
      }
      subscriptionModal.hide();
      loadSubscriptions(); // Reload to page 1 or current page
      alert('Inscrição excluída com sucesso!'); // Replace
    } catch (err) {
      console.error('Erro ao excluir inscrição:', err);
      alert(`Erro ao excluir inscrição: ${err.message}`); // Replace
    }
  }

  // Initial data load
  init();
});
