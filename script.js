(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = "focusflow_fixed_v1";
  const today = new Date().toISOString().slice(0, 10);
  const starter = {
    tasks: [
      {id:"sample-1", name:"Review today's lecture notes", category:"Study", priority:"high", due:today, done:false},
      {id:"sample-2", name:"Practice 3 Java problems", category:"Revision", priority:"medium", due:today, done:false},
      {id:"sample-3", name:"Prepare project presentation", category:"Project", priority:"medium", due:today, done:true}
    ],
    goals: [
      {id:"goal-1", name:"Build a consistent study habit", target:10, progress:3},
      {id:"goal-2", name:"Improve programming skills", target:12, progress:5}
    ],
    focusMinutes: 0
  };
  let state = loadState();
  let timer = {duration:25*60, remaining:25*60, running:false, interval:null, mode:"focus", endAt:0};
  let toastTimeout;

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.tasks) && Array.isArray(parsed.goals)) return parsed;
      }
    } catch (e) { console.warn("FocusFlow could not read saved data:", e); }
    return JSON.parse(JSON.stringify(starter));
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { showToast("Browser storage is unavailable. Your changes may not persist."); }
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function showToast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function niceDate() {
    return new Intl.DateTimeFormat(undefined, {weekday:"short", month:"short", day:"numeric"}).format(new Date());
  }
  function render() {
    renderTasks();
    renderGoals();
    renderStats();
    $("#todayLabel").textContent = niceDate();
    $("#navTaskCount").textContent = state.tasks.filter(t => !t.done).length;
  }
  function taskHTML(task) {
    const priority = ["high","medium","low"].includes(task.priority) ? task.priority : "medium";
    const due = task.due ? new Date(task.due + "T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"}) : "No due date";
    return `<div class="task-row ${task.done ? "is-done" : ""}" data-task-row="${escapeHTML(task.id)}">
      <input class="task-check" type="checkbox" aria-label="Complete ${escapeHTML(task.name)}" data-task-check="${escapeHTML(task.id)}" ${task.done ? "checked" : ""}>
      <div class="task-copy"><div class="task-title">${escapeHTML(task.name)}</div><div class="task-meta"><span class="category-tag">${escapeHTML(task.category || "Study")}</span><span><i class="priority-dot priority-${priority}"></i>${priority[0].toUpperCase()+priority.slice(1)} priority</span><span>${escapeHTML(due)}</span></div></div>
      <button class="task-delete" data-task-delete="${escapeHTML(task.id)}" title="Delete task" aria-label="Delete task">×</button></div>`;
  }
  function emptyHTML(title, message) {
    return `<div class="empty-state"><span>✦</span><strong>${title}</strong><p>${message}</p></div>`;
  }
  function renderTasks() {
    const open = state.tasks.filter(t => !t.done);
    const sorted = [...state.tasks].sort((a,b) => Number(a.done)-Number(b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
    $("#overviewTasks").innerHTML = open.length ? sorted.slice(0,4).map(taskHTML).join("") : emptyHTML("A little breathing room","You're all caught up. Add a task whenever you're ready.");
    const search = ($("#taskSearch")?.value || "").trim().toLowerCase();
    const filter = $("#taskFilter")?.value || "all";
    const filtered = sorted.filter(t => (!search || t.name.toLowerCase().includes(search) || (t.category||"").toLowerCase().includes(search)) && (filter==="all" || (filter==="active"&&!t.done) || (filter==="done"&&t.done)));
    $("#allTasks").innerHTML = filtered.length ? filtered.map(taskHTML).join("") : emptyHTML("Nothing here just yet", search ? "Try another search term." : "Add your first task and give your day some direction.");
  }
  function goalHTML(goal, card = false) {
    const target = Math.max(1, Number(goal.target) || 1);
    const progress = Math.min(target, Math.max(0, Number(goal.progress) || 0));
    const percent = Math.round(progress / target * 100);
    if (card) return `<article class="goal-card"><div class="goal-card-head"><div class="goal-card-icon">◎</div><span class="category-tag">${percent===100?"Completed":"In progress"}</span></div><h3>${escapeHTML(goal.name)}</h3><p>Every small step moves you forward.</p><div class="goal-progress"><span style="width:${percent}%"></span></div><div class="goal-foot"><span>${progress} of ${target} steps</span><strong>${percent}%</strong></div><div class="goal-card-actions"><button class="tiny-action" data-goal-minus="${escapeHTML(goal.id)}" ${progress<=0?"disabled":""}>− Step</button><button class="tiny-action" data-goal-plus="${escapeHTML(goal.id)}" ${progress>=target?"disabled":""}>+ Step</button><button class="tiny-action" data-goal-delete="${escapeHTML(goal.id)}">Delete</button></div></article>`;
    return `<div class="goal-item"><div class="goal-top"><strong>${escapeHTML(goal.name)}</strong><span>${percent}%</span></div><div class="goal-progress"><span style="width:${percent}%"></span></div><div class="goal-foot"><span>${progress} / ${target} steps completed</span><span class="goal-controls"><button class="tiny-action" data-goal-minus="${escapeHTML(goal.id)}" ${progress<=0?"disabled":""}>−</button><button class="tiny-action" data-goal-plus="${escapeHTML(goal.id)}" ${progress>=target?"disabled":""}>+</button></span></div></div>`;
  }
  function renderGoals() {
    const goals = state.goals;
    $("#overviewGoals").innerHTML = goals.length ? goals.slice(0,3).map(g => goalHTML(g)).join("") : emptyHTML("Give a dream a direction","Create a goal and turn it into small steps.");
    $("#allGoals").innerHTML = goals.length ? goals.map(g => goalHTML(g,true)).join("") : emptyHTML("Your next goal starts here","Add a goal you care about, then take one small step.");
  }
  function renderStats() {
    const total = state.tasks.length, completed = state.tasks.filter(t=>t.done).length;
    const percent = total ? Math.round(completed/total*100) : 0;
    $("#completedStat").textContent = completed;
    $("#taskTotalLabel").textContent = `of ${total} task${total===1?"":"s"}`;
    $("#taskProgressBar").style.width = percent+"%";
    $("#taskProgressText").textContent = total ? `${percent}% of your tasks completed` : "Start with one small task";
    $("#focusStat").textContent = state.focusMinutes || 0;
    $("#goalStat").textContent = goalsActive();
    $("#focusPageMinutes").textContent = state.focusMinutes || 0;
    $("#focusPageBar").style.width = Math.min(100, (state.focusMinutes||0)/120*100)+"%";
    $("#insightCompleted").textContent = completed;
    $("#insightFocus").textContent = state.focusMinutes || 0;
    $("#insightGoals").textContent = state.goals.length;
  }
  function goalsActive() { return state.goals.filter(g => Number(g.progress) < Number(g.target)).length; }
  function openTaskDialog(id) {
    const task = state.tasks.find(t=>t.id===id);
    $("#taskForm").reset();
    $("#taskId").value = task ? task.id : "";
    $("#taskDialogTitle").textContent = task ? "Edit task" : "Add a task";
    if (task) {
      $("#taskName").value = task.name;
      $("#taskCategory").value = task.category || "Study";
      $("#taskPriority").value = task.priority || "medium";
      $("#taskDue").value = task.due || "";
    }
    $("#taskDialog").showModal();
    setTimeout(()=>$("#taskName").focus(), 40);
  }
  function openGoalDialog() {
    $("#goalForm").reset();
    $("#goalTarget").value = 10;
    $("#goalDialog").showModal();
    setTimeout(()=>$("#goalName").focus(), 40);
  }
  function navigate(view) {
    if (!$("#view-"+view)) return;
    $$(".view").forEach(el=>el.classList.toggle("active",el.id==="view-"+view));
    $$(".nav-item[data-view]").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
    const titles = {overview:"Overview",tasks:"My tasks",focus:"Focus room",goals:"Goals",insights:"Insights"};
    $("#breadcrumbTitle").textContent = titles[view] || "Overview";
    $("#sidebar").classList.remove("open");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function stopTimer() { if (timer.interval) clearInterval(timer.interval); timer.interval=null; timer.running=false; }
  function setTimerMode(mode, minutes) {
    stopTimer(); timer.mode=mode; timer.duration=minutes*60; timer.remaining=timer.duration;
    $$(".mode-button").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
    $("#timerModeLabel").textContent = mode==="focus" ? "TIME TO FOCUS" : "TIME TO REST";
    $("#timerStart").innerHTML = 'Start session <span>→</span>';
    $("#timerHelper").textContent = mode==="focus" ? "Your phone can wait. This time is yours." : "A real break helps your mind reset.";
    updateTimerDisplay();
  }
  function updateTimerDisplay() {
    const min = Math.floor(timer.remaining/60), sec = timer.remaining%60;
    $("#timerDisplay").textContent = `${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    const progress = timer.duration ? (timer.duration-timer.remaining)/timer.duration : 0;
    $("#timerRing").style.background = `conic-gradient(var(--purple) ${progress*360}deg,#efedf8 ${progress*360}deg)`;
    document.title = timer.running ? `${$("#timerDisplay").textContent} · FocusFlow` : "FocusFlow — Your study space";
  }
  function startTimer() {
    if (timer.running) { stopTimer(); $("#timerStart").innerHTML='Resume session <span>→</span>'; $("#timerHelper").textContent="Paused. Resume whenever you're ready."; return; }
    timer.running=true; timer.endAt=Date.now()+timer.remaining*1000;
    $("#timerStart").innerHTML="Pause session Ⅱ";
    timer.interval=setInterval(()=>{
      timer.remaining=Math.max(0,Math.ceil((timer.endAt-Date.now())/1000));
      updateTimerDisplay();
      if(timer.remaining<=0){
        const completedMode=timer.mode; stopTimer();
        if(completedMode==="focus"){state.focusMinutes=(state.focusMinutes||0)+Math.round(timer.duration/60);saveState();render();$("#timerHelper").textContent="Beautiful work. You completed a focus session.";showToast("Focus session complete — well done!");}
        else {$("#timerHelper").textContent="Break finished. Ready when you are.";showToast("Break complete. Welcome back!");}
        $("#timerStart").innerHTML='Start again <span>→</span>'; 
      }
    },250);
  }

  document.addEventListener("click", e => {
    const nav = e.target.closest("[data-view]");
    if(nav){navigate(nav.dataset.view);return;}
    const openView = e.target.closest("[data-open-view]");
    if(openView){navigate(openView.dataset.openView);return;}
    const close = e.target.closest("[data-close]");
    if(close){$("#"+close.dataset.close).close();return;}
    const check = e.target.closest("[data-task-check]");
    if(check){
      const task=state.tasks.find(t=>t.id===check.dataset.taskCheck);
      if(task){task.done=check.checked;saveState();render();showToast(task.done?"Task completed. Nice work!":"Task moved back to your list.");}
      return;
    }
    const del = e.target.closest("[data-task-delete]");
    if(del){state.tasks=state.tasks.filter(t=>t.id!==del.dataset.taskDelete);saveState();render();showToast("Task removed.");return;}
    const plus = e.target.closest("[data-goal-plus]");
    if(plus){const g=state.goals.find(x=>x.id===plus.dataset.goalPlus);if(g)g.progress=Math.min(Number(g.target),Number(g.progress)+1);saveState();render();showToast("A small step forward!");return;}
    const minus = e.target.closest("[data-goal-minus]");
    if(minus){const g=state.goals.find(x=>x.id===minus.dataset.goalMinus);if(g)g.progress=Math.max(0,Number(g.progress)-1);saveState();render();return;}
    const goalDel=e.target.closest("[data-goal-delete]");
    if(goalDel){state.goals=state.goals.filter(g=>g.id!==goalDel.dataset.goalDelete);saveState();render();showToast("Goal removed.");return;}
    const mode=e.target.closest("[data-minutes]");
    if(mode){setTimerMode(mode.dataset.mode,Number(mode.dataset.minutes));return;}
  });
  $("#taskForm").addEventListener("submit", e => {
    e.preventDefault();
    const name=$("#taskName").value.trim(); if(!name){$("#taskName").focus();return;}
    const id=$("#taskId").value;
    const data={name,category:$("#taskCategory").value,priority:$("#taskPriority").value,due:$("#taskDue").value,done:false};
    if(id){const existing=state.tasks.find(t=>t.id===id);if(existing)Object.assign(existing,data,{done:existing.done});showToast("Task updated.");}
    else {state.tasks.unshift({...data,id:uid()});showToast("Task added to your plan.");}
    saveState();render();$("#taskDialog").close();
  });
  $("#goalForm").addEventListener("submit", e => {
    e.preventDefault();const name=$("#goalName").value.trim();const target=Number($("#goalTarget").value);
    if(!name||!Number.isFinite(target)||target<1)return;
    state.goals.push({id:uid(),name,target:Math.min(100,target),progress:0});saveState();render();$("#goalDialog").close();showToast("Your new goal is in motion.");
  });
  $("#tasksAddBtn").addEventListener("click",()=>openTaskDialog());
  $("#quickAddBtn").addEventListener("click",()=>openTaskDialog());
  $("#overviewAddBtn").addEventListener("click",()=>openTaskDialog());
  $("#goalsAddBtn").addEventListener("click",openGoalDialog);
  $("#overviewGoalBtn").addEventListener("click",openGoalDialog);
  $("#taskSearch").addEventListener("input",renderTasks);
  $("#taskFilter").addEventListener("change",renderTasks);
  $("#timerStart").addEventListener("click",startTimer);
  $("#timerReset").addEventListener("click",()=>{stopTimer();timer.remaining=timer.duration;updateTimerDisplay();$("#timerStart").innerHTML='Start session <span>→</span>';$("#timerHelper").textContent="Timer reset. Start when you're ready.";});
  $("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#themeToggle").addEventListener("click",()=>{document.body.classList.toggle("dark");try{localStorage.setItem("focusflow_theme",document.body.classList.contains("dark")?"dark":"light");}catch(e){}});
  $("#exportBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...state},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="focusflow-backup.json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast("Your data backup is ready.");
  });
  $$("[data-close]").forEach(btn=>btn.addEventListener("click",()=>{const d=$("#"+btn.dataset.close);if(d?.open)d.close();}));
  try { if(localStorage.getItem("focusflow_theme")==="dark")document.body.classList.add("dark"); } catch(e){}
  const hour=new Date().getHours();
  $("#greeting").innerHTML=(hour<12?"Good morning":hour<17?"Make today count":"Good evening")+'<span>.</span>';
  render();updateTimerDisplay();
})();