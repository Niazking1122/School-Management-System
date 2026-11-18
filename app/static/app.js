let token = localStorage.getItem("token");
let userRole = localStorage.getItem("role");
let userName = localStorage.getItem("name");

const $ = id => document.getElementById(id);
const headers = () => ({Authorization:`Bearer ${token}`});

const safe = value => String(value ?? "").replace(/[&<>"']/g,c=>({
"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

document.addEventListener("DOMContentLoaded", async()=>{
  $("today-label").textContent=new Date().toLocaleDateString();

  if(token){
    const response=await fetch("/api/auth/me",{headers:headers()});
    if(response.ok){
      const me=await response.json();
      userRole=me.role;
      userName=me.full_name;
      localStorage.setItem("role",userRole);
      localStorage.setItem("name",userName);
      await showDashboard();
    }else logout();
  }else showAuth();
});

async function handleLogin(event){
  event.preventDefault();
  $("auth-message").textContent="";
  const body=new URLSearchParams({
    username:$("username").value.trim(),
    password:$("password").value
  });

  try{
    const res=await fetch("/api/auth/token",{method:"POST",body});
    const data=await res.json();
    if(!res.ok)throw new Error(data.detail||"Login failed");

    token=data.access_token;
    userRole=data.role;
    localStorage.setItem("token",token);
    localStorage.setItem("role",userRole);

    const meRes=await fetch("/api/auth/me",{headers:headers()});
    if(!meRes.ok)throw new Error("Could not load account");

    const me=await meRes.json();
    userName=me.full_name;
    localStorage.setItem("name",userName);
    await showDashboard();
  }catch(e){
    $("auth-message").textContent=e.message||"Login failed";
  }
}

function logout(){
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("name");
  token=null;
  userRole=null;
  userName=null;
  showAuth();
}

function showAuth(){
  $("auth-section").classList.remove("hidden");
  $("dashboard-section").classList.add("hidden");
  $("user-info").classList.add("hidden");
}

async function api(path,options={}){
  const res=await fetch(path,{
    ...options,
    headers:{...headers(),...(options.headers||{})}
  });
  if(res.status===401){
    logout();
    throw new Error("Please login again.");
  }
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.detail||"Request failed");
  return data;
}

async function showDashboard(){
  $("auth-section").classList.add("hidden");
  $("dashboard-section").classList.remove("hidden");
  $("user-info").classList.remove("hidden");

  $("welcome-msg").textContent=`${userName} · ${userRole}`;
  $("dashboard-title").textContent=
    userRole==="admin"?"Admin dashboard":
    userRole==="teacher"?"Teacher dashboard":"Student dashboard";

  $("admin-users").classList.toggle("hidden",userRole!=="admin");
  $("teacher-tools").classList.toggle("hidden",!["admin","teacher"].includes(userRole));
  $("admin-tools").classList.toggle("hidden",userRole!=="admin");

  await Promise.all([loadAttendance(),loadFees()]);

  if(["admin","teacher"].includes(userRole))await loadStudents();
  if(userRole==="admin")await loadUsers();
}

async function loadStudents(){
  const students=await api("/api/users/students");
  ["att-student-id","fee-student-id"].forEach(id=>{
    if($(id))$(id).innerHTML=students.map(s=>
      `<option value="${s.id}">${safe(s.full_name)}</option>`
    ).join("");
  });
}

async function loadUsers(){
  const users=await api("/api/users/");
  $("users-list").innerHTML=users.map(u=>
    `<tr><td>${safe(u.full_name)}</td><td>${safe(u.username)}</td><td>${safe(u.role)}</td></tr>`
  ).join("");

  $("stats").innerHTML=`
  <div class="stat"><strong>${users.length}</strong><span>Total accounts</span></div>
  <div class="stat"><strong>${users.filter(u=>u.role==="teacher").length}</strong><span>Teachers</span></div>
  <div class="stat"><strong>${users.filter(u=>u.role==="student").length}</strong><span>Students</span></div>`;
}

async function createUser(event){
  event.preventDefault();
  $("create-user-message").textContent="";
  try{
    await api("/api/users/",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        full_name:$("new-full-name").value.trim(),
        username:$("new-username").value.trim(),
        password:$("new-password").value,
        role:$("new-role").value
      })
    });
    $("create-user-message").textContent="Account created successfully.";
    $("create-user-form").reset();
    await loadUsers();
    await loadStudents();
  }catch(e){
    $("create-user-message").textContent=e.message;
  }
}

async function handleAttendance(event){
  event.preventDefault();
  try{
    await api("/api/attendance/",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        student_id:Number($("att-student-id").value),
        date:$("att-date").value,
        status:$("att-status").value
      })
    });
    $("attendance-message").textContent="Attendance saved.";
    await loadAttendance();
  }catch(e){
    $("attendance-message").textContent=e.message;
  }
}

async function handleFee(event){
  event.preventDefault();
  try{
    await api("/api/fees/",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        student_id:Number($("fee-student-id").value),
        amount:Number($("fee-amount").value),
        due_date:$("fee-date").value
      })
    });
    $("fee-message").textContent="Fee record created.";
    $("fee-form").reset();
    await loadFees();
  }catch(e){
    $("fee-message").textContent=e.message;
  }
}

async function loadAttendance(){
  try{
    const rows=await api("/api/attendance/");
    $("attendance-list").innerHTML=rows.map(a=>
      `<tr><td>${safe(a.date)}</td><td>${a.student_id}</td><td>${safe(a.status)}</td></tr>`
    ).join("")||'<tr><td colspan="3">No attendance records yet.</td></tr>';
  }catch(e){
    $("attendance-list").innerHTML=`<tr><td>${safe(e.message)}</td></tr>`;
  }
}

async function loadFees(){
  try{
    const rows=await api("/api/fees/");
    $("fee-list").innerHTML=rows.map(f=>
      `<tr><td>${safe(f.due_date)}</td><td>${f.student_id}</td><td>${Number(f.amount).toFixed(2)}</td><td>${safe(f.status)}
      ${userRole==="admin"&&f.status==="Pending"?
      `<button onclick="markPaid(${f.id})">Mark paid</button>`:""}</td></tr>`
    ).join("")||'<tr><td colspan="4">No fee records yet.</td></tr>';
  }catch(e){
    $("fee-list").innerHTML=`<tr><td>${safe(e.message)}</td></tr>`;
  }
}

async function markPaid(id){
  if(!confirm("Confirm fee received?"))return;
  try{
    await api(`/api/fees/${id}/pay`,{method:"PATCH"});
    await loadFees();
  }catch(e){
    alert(e.message);
  }
}
