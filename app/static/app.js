
let token = localStorage.getItem("token");
let userRole = localStorage.getItem("role");
let userName = localStorage.getItem("name");

const $ = id => document.getElementById(id);
const headers = () => ({ Authorization: `Bearer ${token}` });

const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

let schoolClasses = [];
let schoolSubjects = [];
let schoolExams = [];

document.addEventListener("DOMContentLoaded", async () => {
  $("today-label").textContent = new Date().toLocaleDateString();

  if (token) {
    try {
      const response = await fetch("/api/auth/me", { headers: headers() });
      if (response.ok) {
        const me = await response.json();
        userRole = me.role;
        userName = me.full_name;
        localStorage.setItem("role", userRole);
        localStorage.setItem("name", userName);
        await showDashboard();
      } else {
        logout();
      }
    } catch {
      logout();
    }
  } else {
    showAuth();
  }
});

async function handleLogin(event) {
  event.preventDefault();
  $("auth-message").textContent = "";

  const body = new URLSearchParams({
    username: $("username").value.trim(),
    password: $("password").value
  });

  try {
    const res = await fetch("/api/auth/token", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");

    token = data.access_token;
    userRole = data.role;
    localStorage.setItem("token", token);
    localStorage.setItem("role", userRole);

    const meRes = await fetch("/api/auth/me", { headers: headers() });
    if (!meRes.ok) throw new Error("Could not load account");

    const me = await meRes.json();
    userName = me.full_name;
    localStorage.setItem("name", userName);
    await showDashboard();
  } catch (e) {
    $("auth-message").textContent = e.message || "Login failed";
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("name");
  token = null;
  userRole = null;
  userName = null;
  showAuth();
}

function showAuth() {
  $("auth-section").classList.remove("hidden");
  $("dashboard-section").classList.add("hidden");
  $("user-info").classList.add("hidden");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });

  if (res.status === 401) {
    logout();
    throw new Error("Please login again.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

function jsonOptions(data) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

async function showDashboard() {
  $("auth-section").classList.add("hidden");
  $("dashboard-section").classList.remove("hidden");
  $("user-info").classList.remove("hidden");

  $("welcome-msg").textContent = `${userName} · ${userRole}`;

  $("dashboard-title").textContent =
    userRole === "admin" ? "Admin dashboard" :
    userRole === "teacher" ? "Teacher dashboard" : "Student dashboard";

  $("admin-users").classList.toggle("hidden", userRole !== "admin");
  $("academics-admin").classList.toggle("hidden", userRole !== "admin");
  $("teacher-tools").classList.toggle(
    "hidden", !["admin", "teacher"].includes(userRole)
  );
  $("admin-tools").classList.toggle("hidden", userRole !== "admin");
  $("exam-tools").classList.toggle(
    "hidden", !["admin", "teacher"].includes(userRole)
  );

  await Promise.all([loadAttendance(), loadFees()]);

  if (["admin", "teacher"].includes(userRole)) {
    await loadStudents();
  }

  if (userRole === "admin") {
    await loadUsers();
  }

  await loadAcademicData();
  await loadMarks();
}

async function loadStudents() {
  const students = await api("/api/users/students");

  [
    "att-student-id",
    "fee-student-id",
    "enroll-student",
    "mark-student"
  ].forEach(id => {
    if ($(id)) {
      $(id).innerHTML = students.map(s =>
        `<option value="${s.id}">${safe(s.full_name)} (ID: ${s.id})</option>`
      ).join("");
    }
  });
}

async function loadUsers() {
  const users = await api("/api/users/");

  $("users-list").innerHTML = users.map(u =>
    `<tr>
      <td>${safe(u.full_name)}</td>
      <td>${safe(u.username)}</td>
      <td>${safe(u.role)}</td>
    </tr>`
  ).join("");

  $("stats").innerHTML = `
    <div class="stat"><strong>${users.length}</strong><span>Total accounts</span></div>
    <div class="stat"><strong>${users.filter(u => u.role === "teacher").length}</strong><span>Teachers</span></div>
    <div class="stat"><strong>${users.filter(u => u.role === "student").length}</strong><span>Students</span></div>`;
}

async function createUser(event) {
  event.preventDefault();
  $("create-user-message").textContent = "";

  try {
    await api("/api/users/", jsonOptions({
      full_name: $("new-full-name").value.trim(),
      username: $("new-username").value.trim(),
      password: $("new-password").value,
      role: $("new-role").value
    }));

    $("create-user-message").textContent = "Account created successfully.";
    $("create-user-form").reset();
    await loadUsers();
    await loadStudents();
  } catch (e) {
    $("create-user-message").textContent = e.message;
  }
}

async function handleAttendance(event) {
  event.preventDefault();

  try {
    await api("/api/attendance/", jsonOptions({
      student_id: Number($("att-student-id").value),
      date: $("att-date").value,
      status: $("att-status").value
    }));

    $("attendance-message").textContent = "Attendance saved.";
    await loadAttendance();
  } catch (e) {
    $("attendance-message").textContent = e.message;
  }
}

async function handleFee(event) {
  event.preventDefault();

  try {
    await api("/api/fees/", jsonOptions({
      student_id: Number($("fee-student-id").value),
      amount: Number($("fee-amount").value),
      due_date: $("fee-date").value
    }));

    $("fee-message").textContent = "Fee record created.";
    $("fee-form").reset();
    await loadFees();
  } catch (e) {
    $("fee-message").textContent = e.message;
  }
}

async function loadAttendance() {
  try {
    const rows = await api("/api/attendance/");
    $("attendance-list").innerHTML = rows.map(a =>
      `<tr>
        <td>${safe(a.date)}</td>
        <td>${a.student_id}</td>
        <td>${safe(a.status)}</td>
      </tr>`
    ).join("") || '<tr><td colspan="3">No attendance records yet.</td></tr>';
  } catch (e) {
    $("attendance-list").innerHTML =
      `<tr><td>${safe(e.message)}</td></tr>`;
  }
}

async function loadFees() {
  try {
    const rows = await api("/api/fees/");

    $("fee-list").innerHTML = rows.map(f =>
      `<tr>
        <td>${safe(f.due_date)}</td>
        <td>${f.student_id}</td>
        <td>${Number(f.amount).toFixed(2)}</td>
        <td>
          ${safe(f.status)}
          ${userRole === "admin" && f.status === "Pending"
            ? `<button onclick="markPaid(${f.id})">Mark paid</button>`
            : ""}
        </td>
      </tr>`
    ).join("") || '<tr><td colspan="4">No fee records yet.</td></tr>';
  } catch (e) {
    $("fee-list").innerHTML = `<tr><td>${safe(e.message)}</td></tr>`;
  }
}

async function markPaid(id) {
  if (!confirm("Confirm fee received?")) return;

  try {
    await api(`/api/fees/${id}/pay`, { method: "PATCH" });
    await loadFees();
  } catch (e) {
    alert(e.message);
  }
}

/* CLASSES AND SUBJECTS */

async function loadAcademicData() {
  try {
    const results = await Promise.all([
      api("/api/academics/classes"),
      api("/api/academics/subjects"),
      api("/api/academics/exams")
    ]);

    schoolClasses = results[0];
    schoolSubjects = results[1];
    schoolExams = results[2];

    const classOptions = schoolClasses.map(c =>
      `<option value="${c.id}">${safe(c.name)} (ID: ${c.id})</option>`
    ).join("");

    ["enroll-class", "assign-class", "exam-class"].forEach(id => {
      if ($(id)) $(id).innerHTML = classOptions;
    });

    const subjectOptions = schoolSubjects.map(s =>
      `<option value="${s.id}">${safe(s.name)} (ID: ${s.id})</option>`
    ).join("");

    ["assign-subject", "mark-subject"].forEach(id => {
      if ($(id)) $(id).innerHTML = subjectOptions;
    });

    if ($("mark-exam")) {
      $("mark-exam").innerHTML = schoolExams.map(e =>
        `<option value="${e.id}">${safe(e.title)} (ID: ${e.id})</option>`
      ).join("");
    }

    if ($("class-list")) {
      $("class-list").innerHTML = schoolClasses.map(c =>
        `<p>${safe(c.name)} — ID: ${c.id}</p>`
      ).join("") || "<p>No classes added yet.</p>";
    }

    if ($("subject-list")) {
      $("subject-list").innerHTML = schoolSubjects.map(s =>
        `<p>${safe(s.name)} — ID: ${s.id}</p>`
      ).join("") || "<p>No subjects added yet.</p>";
    }
  } catch (e) {
    if ($("academic-message")) {
      $("academic-message").textContent = e.message;
    }
  }
}

async function createClass(event) {
  event.preventDefault();

  try {
    await api("/api/academics/classes", jsonOptions({
      name: $("class-name").value.trim()
    }));

    $("class-name").value = "";
    $("academic-message").textContent = "Class added successfully.";
    await loadAcademicData();
  } catch (e) {
    $("academic-message").textContent = e.message;
  }
}

async function createSubject(event) {
  event.preventDefault();

  try {
    await api("/api/academics/subjects", jsonOptions({
      name: $("subject-name").value.trim()
    }));

    $("subject-name").value = "";
    $("academic-message").textContent = "Subject added successfully.";
    await loadAcademicData();
  } catch (e) {
    $("academic-message").textContent = e.message;
  }
}

async function enrollStudent(event) {
  event.preventDefault();

  try {
    await api("/api/academics/enrollments", jsonOptions({
      student_id: Number($("enroll-student").value),
      class_id: Number($("enroll-class").value)
    }));

    $("academic-message").textContent =
      "Student assigned to class successfully.";
  } catch (e) {
    $("academic-message").textContent = e.message;
  }
}

async function assignSubject(event) {
  event.preventDefault();

  try {
    await api("/api/academics/class-subjects", jsonOptions({
      class_id: Number($("assign-class").value),
      subject_id: Number($("assign-subject").value)
    }));

    $("academic-message").textContent =
      "Subject assigned to class successfully.";
  } catch (e) {
    $("academic-message").textContent = e.message;
  }
}

/* EXAMS AND RESULTS */

async function createExam(event) {
  event.preventDefault();

  try {
    await api("/api/academics/exams", jsonOptions({
      title: $("exam-title").value.trim(),
      class_id: Number($("exam-class").value),
      exam_date: $("exam-date").value
    }));

    $("exam-message").textContent = "Exam created successfully.";
    $("exam-form").reset();

    await loadAcademicData();
  } catch (e) {
    $("exam-message").textContent = e.message;
  }
}

async function saveMark(event) {
  event.preventDefault();

  try {
    await api("/api/academics/marks", jsonOptions({
      student_id: Number($("mark-student").value),
      exam_id: Number($("mark-exam").value),
      subject_id: Number($("mark-subject").value),
      obtained_marks: Number($("obtained-marks").value),
      total_marks: Number($("total-marks").value)
    }));

    $("mark-message").textContent = "Exam result saved successfully.";
    $("mark-form").reset();
    await loadMarks();
  } catch (e) {
    $("mark-message").textContent = e.message;
  }
}

async function loadMarks() {
  try {
    const rows = await api("/api/academics/marks");

    $("marks-list").innerHTML = rows.map(m => {
      const percentage = m.total_marks > 0
        ? (m.obtained_marks / m.total_marks * 100).toFixed(1)
        : "0";

      return `<tr>
        <td>${m.exam_id}</td>
        <td>${m.subject_id}</td>
        <td>${m.obtained_marks}</td>
        <td>${m.total_marks}</td>
        <td>${percentage}%</td>
      </tr>`;
    }).join("") || '<tr><td colspan="5">No exam results yet.</td></tr>';
  } catch (e) {
    $("marks-list").innerHTML =
      `<tr><td colspan="5">${safe(e.message)}</td></tr>`;
  }
}
