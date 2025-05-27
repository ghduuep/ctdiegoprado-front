document.addEventListener('DOMContentLoaded', () => {
  const studentsUrl = "https://ctdiegoprado-api.onrender.com/api/students/";
  const studentModalElement = document.getElementById('studentModal');
  const cadastroModalElement = document.getElementById('cadastroAlunoModal');
  const editModalElement = document.getElementById('editStudentModal');

  const studentModal = new bootstrap.Modal(studentModalElement);
  const cadastroModal = new bootstrap.Modal(cadastroModalElement);
  const editModal = new bootstrap.Modal(editModalElement);

  const itemsPerPage = 10;
  let currentPage = 1;

  let currentStudentId = null;

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

  function init() {
    // evento de busca
    const searchForm = document.querySelector('form[role="search"]');
    const searchInput = document.getElementById('searchStudent');
    if (searchForm) {
      searchForm.addEventListener('submit', e => {
        e.preventDefault();
        loadStudents(searchInput.value);
      });
    }

    const btnCadastrar = document.getElementById('btnCadastrarAluno');
    btnCadastrar?.addEventListener('click', () => {
      const registrationDateInput = document.getElementById('registrationDate');
      if (registrationDateInput) registrationDateInput.valueAsDate = new Date();
      cadastroModal.show();
    });

    document.getElementById('cadastroAlunoForm')
      ?.addEventListener('submit', handleCadastroSubmit);

    document.getElementById('editStudentForm')
      ?.addEventListener('submit', handleEditSubmit);

    // carrega todos inicialmente
    loadStudents();
  }

  // Helper para formatar datas
  function formatDate(dateStr) {
    if (!dateStr) return 'Não definido';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  }

  // Calcula idade
  function calcAge(birthDate) {
    if (!birthDate) return 'Não informado';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} anos`;
  }

  // Carrega a lista de alunos (com opção de busca)
    async function loadStudents(searchTerm = '', page = 1) {
    try {
      currentPage = page;
      let url = studentsUrl;
      if (searchTerm) {
        url += `?search=${encodeURIComponent(searchTerm)}`;
      }
      url += (url.includes('?') ? '&' : '?') + `page=${page}`;

      const resp = await authFetch(url);
      const data = await resp.json();

      const ul = document.getElementById('students-list');
      ul.innerHTML = '';

      const list = data.results ?? data;
      if (!list.length) {
        ul.innerHTML = '<li class="list-group-item text-center">Nenhum aluno encontrado.</li>';
        return;
      }

      list.forEach(student => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';

        const infoDiv = document.createElement('div');
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'fw-bold';
        link.textContent = `${student.first_name} ${student.last_name}`;
        link.addEventListener('click', e => { e.preventDefault(); showDetails(student); });

        const info = document.createElement('div');
        info.className = 'text-muted small';
        info.textContent = student.phone ? `Tel: ${student.phone}` : '';
        if (student.email) {
          info.textContent += info.textContent ? ` | Email: ${student.email}` : `Email: ${student.email}`;
        }

        infoDiv.append(link, info);

        const createdDate = document.createElement('div');
        createdDate.className = 'text-muted small';
        createdDate.textContent = `Registro: ${formatDate(student.created_at)}`;

        li.append(infoDiv, createdDate);
        ul.append(li);
      });

      renderPagination(data);

    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
      document.getElementById('students-list').innerHTML =
        '<li class="list-group-item text-center text-danger">Erro ao carregar alunos.</li>';
    }
  }

  function renderPagination(data) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    const totalPages = Math.ceil(data.count / itemsPerPage);
    const currentPage = getCurrentPageFromUrl(data);

    const prevLi = document.createElement('li');
  prevLi.className = `page-item ${!data.previous ? 'disabled' : ''}`;
  prevLi.innerHTML = `<a class="page-link" href="#">Anterior</a>`;
  prevLi.addEventListener('click', e => {
    e.preventDefault();
    if (data.previous) loadStudents('', currentPage - 1);
  });
  pagination.appendChild(prevLi);

  // Números de página
  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement('li');
    li.className = `page-item ${i === currentPage ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    li.addEventListener('click', e => {
      e.preventDefault();
      loadStudents('', i);
    });
    pagination.appendChild(li);
  }

  // Botão "Próxima"
  const nextLi = document.createElement('li');
  nextLi.className = `page-item ${!data.next ? 'disabled' : ''}`;
  nextLi.innerHTML = `<a class="page-link" href="#">Próxima</a>`;
  nextLi.addEventListener('click', e => {
    e.preventDefault();
    if (data.next) loadStudents('', currentPage + 1);
  });
  pagination.appendChild(nextLi);
  } 

  function getCurrentPageFromUrl(data) {
    const url = data.next || data.previous;
    if (!url) return data.next ? 1 : data.previous ? 2 : 1;

    const match = url.match(/page=(\d+)/);
    let pageNum = match ? parseInt(match[1]) : 1;
    return data.next ? pageNum - 1 : pageNum + 1;
  }

  // Preenche formulário de edição
  function populateEditForm(student) {
    document.getElementById('editStudentId').value = student.id;
    document.getElementById('editFirstName').value = student.first_name;
    document.getElementById('editLastName').value = student.last_name;
    document.getElementById('editPhone').value = student.phone || '';
    document.getElementById('editEmail').value = student.email || '';
    document.getElementById('editAddress').value = student.adress || '';
    document.getElementById('editBirthDate').value =
      student.birthday_date ? student.birthday_date.split('T')[0] : '';
    document.getElementById('editRegistrationDate').value =
      student.created_at ? student.created_at.split('T')[0] : '';
  }

  // Submit do cadastro
  async function handleCadastroSubmit(e) {
    e.preventDefault();
    const student = {
      first_name: document.getElementById('firstName').value,
      last_name: document.getElementById('lastName').value,
      phone: document.getElementById('phone').value || null,
      email: document.getElementById('email').value || null,
      adress: document.getElementById('address').value || null,
      birthday_date: document.getElementById('birthDate').value || null,
      created_at: document.getElementById('registrationDate').value
    };
    try {
      const res = await authFetch(studentsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
      });
      await res.json();
      cadastroModal.hide();
      e.target.reset();
      loadStudents();
      alert('Aluno cadastrado com sucesso!');
    } catch (err) {
      console.error('Erro ao cadastrar aluno:', err);
      alert('Erro ao cadastrar aluno. Verifique os dados e tente novamente.');
    }
  }

  // Submit da edição
  async function handleEditSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editStudentId').value;
    const student = {
      first_name: document.getElementById('editFirstName').value,
      last_name: document.getElementById('editLastName').value,
      phone: document.getElementById('editPhone').value || null,
      email: document.getElementById('editEmail').value || null,
      adress: document.getElementById('editAddress').value || null,
      birthday_date: document.getElementById('editBirthDate').value || null,
      created_at: document.getElementById('editRegistrationDate').value
    };
    try {
      const res = await authFetch(`${studentsUrl}${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
      });
      if (!res.ok) throw new Error(`Erro ao atualizar aluno: ${res.status}`);
      editModal.hide();
      loadStudents();
      alert('Aluno atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar aluno:', err);
      alert(`Erro ao atualizar aluno: ${err.message}`);
    }
  }

  // Exclui aluno
  async function deleteStudent(id) {
    try {
      const res = await authFetch(`${studentsUrl}${id}/`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Erro ao excluir aluno: ${res.status}`);
      studentModal.hide();
      loadStudents();
      alert('Aluno excluído com sucesso!');
    } catch (err) {
      console.error('Erro ao excluir aluno:', err);
      alert('Erro ao excluir aluno. Tente novamente.');
    }
  }

  init();
});
