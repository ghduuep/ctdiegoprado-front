document.addEventListener('DOMContentLoaded', () => {
  const studentsUrl = "http://127.0.0.1:8000/api/students/";
  const studentModalElement = document.getElementById('studentModal');
  const cadastroModalElement = document.getElementById('cadastroAlunoModal');
  const editModalElement = document.getElementById('editStudentModal');

  const studentModal = new bootstrap.Modal(studentModalElement);
  const cadastroModal = new bootstrap.Modal(cadastroModalElement);
  const editModal = new bootstrap.Modal(editModalElement);

  let currentStudentId = null;

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
  async function loadStudents(searchTerm = '') {
    try {
      let url = studentsUrl;
      if (searchTerm) {
        url += `?search=${encodeURIComponent(searchTerm)}`;
      }

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Erro ao buscar alunos: ${resp.status}`);
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

    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
      document.getElementById('students-list').innerHTML =
        '<li class="list-group-item text-center text-danger">Erro ao carregar alunos.</li>';
    }
  }

  // Mostra detalhes no modal
  function showDetails(student) {
    currentStudentId = student.id;
    const detailsList = document.getElementById('student-details');
    detailsList.innerHTML = '';

    const details = [
      { label: 'ID', value: student.id },
      { label: 'Nome Completo', value: `${student.first_name} ${student.last_name}` },
      { label: 'Telefone', value: student.phone || 'Não informado' },
      { label: 'Email', value: student.email || 'Não informado' },
      { label: 'Endereço', value: student.adress || 'Não informado' },
      { label: 'Data de Nascimento', value: formatDate(student.birthday_date) },
      { label: 'Idade', value: calcAge(student.birthday_date) },
      { label: 'Data de Registro', value: formatDate(student.created_at) }
    ];

    details.forEach(d => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.textContent = `${d.label}: ${d.value}`;
      detailsList.append(li);
    });

    document.getElementById('studentModalLabel').textContent =
      `${student.first_name} ${student.last_name}`;

    document.getElementById('btnEditarAluno').onclick = () => {
      studentModal.hide();
      populateEditForm(student);
      editModal.show();
    };

    document.getElementById('btnExcluirAluno').onclick = () => {
      if (confirm(`Deseja realmente excluir o aluno ${student.first_name}?`)) {
        deleteStudent(student.id);
      }
    };

    studentModal.show();
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
      const res = await fetch(studentsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
      });
      if (!res.ok) throw new Error(`Erro ao cadastrar aluno: ${res.status}`);
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
      const res = await fetch(`${studentsUrl}${id}/`, {
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
      const res = await fetch(`${studentsUrl}${id}/`, { method: 'DELETE' });
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
