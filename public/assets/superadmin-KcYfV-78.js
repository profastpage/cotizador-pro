import{o as N,g as q,d as l,a as i,S as R,b as S,c as g,e as p,u as D,q as y,w as b,f as w,s as F,h as T,i as k}from"./firebase-config-B0PS33Fd.js";let E=[],P=null;N(S,async t=>{if(!t){Q();return}const n=await q(l(i,"users",t.uid));if(!n.exists()||n.data().role!=="superadmin"){j();return}P=n.data(),document.getElementById("admin-name").textContent=P.name,document.getElementById("setting-admin-email").value=R,$().then(()=>{I()})});function Q(){const t=document.querySelector(".main-content");t&&(t.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;">
        <h2>Inicia sesión como administrador</h2>
        <p>Ve a <a href="index.html">Iniciar Sesión</a> primero</p>
      </div>
    `)}function j(){const t=document.querySelector(".main-content");t&&(t.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;">
        <h2>No autorizado</h2>
        <p>No tienes permisos de administrador</p>
        <a href="index.html" class="btn btn-primary">Volver al inicio</a>
      </div>
    `)}document.addEventListener("click",t=>{var e;const n=t.target.closest("[data-tab]");if(n){const a=n.dataset.tab;document.querySelectorAll(".nav-item").forEach(d=>d.classList.remove("active")),n.classList.add("active"),document.querySelectorAll(".tab-content").forEach(d=>d.classList.remove("active")),(e=document.getElementById(`tab-${a}`))==null||e.classList.add("active");const o={dashboard:"Dashboard",clients:"Clientes",plans:"Planes",settings:"Configuración"};document.getElementById("page-title").textContent=o[a]||"Dashboard"}t.target.hasAttribute("data-close-modal")&&document.querySelectorAll(".modal").forEach(a=>a.classList.add("hidden"))});async function $(){try{const t=await g(p(i,"users")),n=[];let e=0,a=0,o=0,d=0,m=0,s=0,r=0,x=0;t.forEach(u=>{const h={id:u.id,...u.data()};h.role!=="superadmin"&&(n.push(h),h.isActive&&(a++,m+=h.quotesUsedThisMonth||0,h.plan==="free"?o++:h.plan==="basic"?(s++,e+=35):h.plan==="business"?(r++,e+=59):h.plan==="pro"?(x++,e+=99):d++))}),E=n,document.getElementById("stat-total-users").textContent=E.length,document.getElementById("stat-active-users").textContent=a,document.getElementById("stat-free-users").textContent=o,document.getElementById("stat-paid-users").textContent=s+r+x,document.getElementById("stat-monthly-revenue").textContent=`S/ ${e}`;const v=document.getElementById("stat-basic-users"),A=document.getElementById("stat-business-users"),f=document.getElementById("stat-pro-users"),L=document.getElementById("stat-total-quotes");v&&(v.textContent=s),A&&(A.textContent=r),f&&(f.textContent=x),L&&(L.textContent=m);const H=E.sort((u,h)=>new Date(h.createdAt)-new Date(u.createdAt)).slice(0,10),M=document.getElementById("recent-users-tbody");M&&(M.innerHTML=H.map(u=>`
        <tr>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td>${u.phone||"-"}</td>
          <td><span class="badge badge-${u.plan}">${U(u.plan)}</span></td>
          <td>${C(u.createdAt)}</td>
          <td><span class="badge ${u.isActive?"badge-active":"badge-inactive"}">${u.isActive?"Activo":"Inactivo"}</span></td>
          <td>
            <button class="btn btn-xs btn-primary" onclick="window.quickPlan('${u.id}','basic')" title="Plan Básico">Básico</button>
            <button class="btn btn-xs btn-success" onclick="window.quickPlan('${u.id}','business')" title="Plan Business">Business</button>
            <button class="btn btn-xs btn-warning" onclick="window.quickPlan('${u.id}','pro')" title="Plan Pro">Pro</button>
          </td>
        </tr>
      `).join(""))}catch(t){console.error("Error loading dashboard:",t)}}function I(){O(E)}function O(t){const n=document.getElementById("clients-tbody");if(n){if(t.length===0){n.innerHTML='<tr><td colspan="8" style="text-align:center;padding:2rem;">No hay clientes registrados</td></tr>';return}n.innerHTML=t.map(e=>{const a=e.planEndDate?new Date(e.planEndDate):null,o=a&&a<new Date&&e.licenseDuration!==0;return`
      <tr>
        <td>
          <strong>${e.name}</strong>
          <br><small style="color:var(--color-gray-500);word-break:break-all">${e.email}</small>
          ${e.phone?`<br><small>📱 ${e.phone}</small>`:""}
          ${e.company?`<br><small>🏢 ${e.company}</small>`:""}
        </td>
        <td><span class="badge badge-${e.plan}">${U(e.plan)}</span></td>
        <td>${e.licenseDuration===0?"∞ Ilimitado":a&&!o?_(a):o?"Vencido":"Gratis"}</td>
        <td>${e.quotesUsedThisMonth||0} / ${V(e.plan)}</td>
        <td><span class="badge ${e.isActive&&!o?"badge-active":"badge-inactive"}">${e.isActive?"Activo":"Inactivo"}</span></td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="btn btn-xs btn-primary" onclick="window.quickPlan('${e.id}','basic')" title="Activar Básico">B</button>
            <button class="btn btn-xs btn-success" onclick="window.quickPlan('${e.id}','business')" title="Activar Business">Bu</button>
            <button class="btn btn-xs btn-warning" onclick="window.quickPlan('${e.id}','pro')" title="Activar Pro">P</button>
            <button class="btn btn-xs btn-info" onclick="window.applyCoupon('${e.id}')" title="Aplicar Cupón">🎁</button>
            <button class="btn btn-xs btn-secondary" onclick="window.editClient('${e.id}')" title="Editar">✏️</button>
            <button class="btn btn-xs ${e.isActive?"btn-danger":"btn-success"}" onclick="window.toggleClient('${e.id}', ${!e.isActive})" title="${e.isActive?"Desactivar":"Activar"}">${e.isActive?"⏸️":"▶️"}</button>
            <button class="btn btn-xs btn-danger" onclick="window.resetClientData('${e.id}')" title="Eliminar datos">🗑️</button>
          </div>
        </td>
      </tr>
    `}).join("")}}document.addEventListener("input",t=>{if(t.target.id==="search-clients"){const n=t.target.value.toLowerCase();O(E.filter(e=>e.name.toLowerCase().includes(n)||e.email.toLowerCase().includes(n)||e.company&&e.company.toLowerCase().includes(n)))}});window.editClient=function(t){const n=E.find(e=>e.id===t);n&&(document.getElementById("edit-client-id").value=t,document.getElementById("edit-client-name").value=n.name,document.getElementById("edit-client-email").value=n.email,document.getElementById("edit-client-plan").value=n.plan,document.getElementById("edit-client-active").value=n.isActive.toString(),document.getElementById("edit-client-quotes-used").value=n.quotesUsedThisMonth||0,document.getElementById("edit-client-duration").value=n.licenseDuration||0,document.getElementById("modal-edit-client").classList.remove("hidden"))};document.addEventListener("submit",async t=>{if(t.target.id==="form-edit-client"){t.preventDefault();const n=document.getElementById("edit-client-id").value,e=document.getElementById("edit-client-plan").value,a=parseInt(document.getElementById("edit-client-duration").value)||0,o=document.getElementById("edit-client-active").value==="true",d=parseInt(document.getElementById("edit-client-quotes-used").value)||0,m=new Date,s=a>0?new Date(m.setMonth(m.getMonth()+a)).toISOString():null;try{await D(l(i,"users",n),{plan:e,isActive:o,licenseDuration:a,planStartDate:new Date().toISOString(),planEndDate:s,quotesUsedThisMonth:d,lastQuoteReset:new Date().toISOString(),updatedAt:new Date().toISOString()}),c("Cliente actualizado ✅"),document.getElementById("modal-edit-client").classList.add("hidden"),$(),I()}catch{c("Error al actualizar","error")}}});document.addEventListener("click",async t=>{if(t.target.id==="btn-reset-quotes"){const n=document.getElementById("edit-client-id").value;try{await D(l(i,"users",n),{quotesUsedThisMonth:0,lastQuoteReset:new Date().toISOString()}),document.getElementById("edit-client-quotes-used").value=0,c("Cotizaciones reseteadas")}catch{c("Error al resetear","error")}}});window.toggleClient=async function(t,n){try{await D(l(i,"users",t),{isActive:n,updatedAt:new Date().toISOString()}),c(`Cliente ${n?"activado":"desactivado"}`),$(),I()}catch{c("Error","error")}};window.quickPlan=async function(t,n){const e=E.find(o=>o.id===t);if(!e)return;const a={basic:"Básico",business:"Business",pro:"Pro"};if(confirm(`¿Activar plan ${a[n]} para ${e.name}?`))try{await D(l(i,"users",t),{plan:n,isActive:!0,licenseDuration:1,planStartDate:new Date().toISOString(),planEndDate:new Date(Date.now()+720*60*60*1e3).toISOString(),quotesUsedThisMonth:0,lastQuoteReset:new Date().toISOString(),updatedAt:new Date().toISOString()}),c(`✅ Plan ${a[n]} activado para ${e.name}`),$(),I()}catch{c("Error al activar plan","error")}};window.applyCoupon=async function(t){const n=E.find(o=>o.id===t);if(!n)return;const e=prompt(`Descuento para ${n.name} (%):`,"20");if(!e||isNaN(e))return;const a=prompt("Meses de descuento:","1");if(!(!a||isNaN(a)))try{const o=new Date,d=new Date(o.getTime()+parseInt(a)*30*24*60*60*1e3);await D(l(i,"users",t),{isActive:!0,licenseDuration:parseInt(a),planStartDate:o.toISOString(),planEndDate:d.toISOString(),discountPercent:parseInt(e),quotesUsedThisMonth:0,lastQuoteReset:o.toISOString(),updatedAt:o.toISOString()}),c(`🎁 Cupón ${e}% por ${a} mes(es) aplicado a ${n.name}`),$(),I()}catch{c("Error al aplicar cupón","error")}};window.resetClientData=async function(t){const n=E.find(e=>e.id===t);if(n&&confirm(`¿Eliminar TODOS los datos de ${n.name}?
Se borrarán cotizaciones y clientes.`))try{const e=p(i,"quotes"),a=y(e,b("userId","==",t)),d=(await g(a)).docs.map(v=>w(l(i,"quotes",v.id)));await Promise.all(d);const m=p(i,"clients"),s=y(m,b("userId","==",t)),x=(await g(s)).docs.map(v=>w(l(i,"clients",v.id)));await Promise.all(x),await D(l(i,"users",t),{quotesUsedThisMonth:0,lastQuoteReset:new Date().toISOString(),updatedAt:new Date().toISOString()}),c(`🗑️ Datos de ${n.name} eliminados`),$(),I()}catch(e){c("Error al eliminar datos","error"),console.error(e)}};function U(t){return{free:"🆓 Gratis",basic:"📋 Básico",business:"💼 Business",pro:"🚀 Pro"}[t]||t}function V(t){return{free:3,basic:60,business:200,pro:-1}[t]||3}function C(t){return t?new Date(t).toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"}):"-"}function _(t){return t.toLocaleDateString("es-PE",{day:"2-digit",month:"short"})}function c(t,n="success"){const e=document.getElementById("toast-container");if(!e)return;const a=document.createElement("div");a.className=`toast toast-${n}`,a.innerHTML=`<span>${n==="success"?"✅":"❌"}</span><span>${t}</span>`,e.appendChild(a),setTimeout(()=>{a.style.opacity="0",setTimeout(()=>a.remove(),300)},3e3)}let B=!1;window.logout=async function(){if(!B){B=!0;try{localStorage.removeItem("cotizapro_session"),localStorage.removeItem("redirectAfterLogin"),sessionStorage.clear(),await F(S),c("Sesión cerrada correctamente","info"),await new Promise(t=>setTimeout(t,300)),window.location.href="/index.html"}catch(t){console.error("Logout error:",t),sessionStorage.clear(),window.location.href="/index.html"}finally{B=!1}}};window.searchOrphanedData=async function(){const t=document.getElementById("migration-search-email").value.trim().toLowerCase(),n=document.getElementById("orphaned-data-result");if(!t){c("Ingresa un email","error");return}n.innerHTML='<p style="color:var(--color-gray-500);">Buscando...</p>';try{const e=p(i,"users"),a=y(e,b("email","==",t)),o=await g(a),d=[];if(o.forEach(s=>d.push({id:s.id,...s.data()})),d.length===0){n.innerHTML=`
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;">
          <p style="margin:0;color:#0369a1;">No se encontraron datos para este email en Firestore.</p>
        </div>
      `;return}let m='<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;">';m+=`<p style="margin:0 0 8px;color:#0369a1;font-weight:500;">Se encontraron ${d.length} documento(s) de usuario:</p>`;for(const s of d){let r=0,x=0,v=0;try{const f=y(p(i,"quotes"),b("userId","==",s.id));r=(await g(f)).size}catch{}try{const f=y(p(i,"clients"),b("userId","==",s.id));x=(await g(f)).size}catch{}try{const f=y(p(i,"companies"),b("userId","==",s.id));v=(await g(f)).size}catch{}const A=S.currentUser&&s.id===S.currentUser.uid;m+=`
        <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;">
          <p style="margin:0;font-weight:600;">${s.name} ${A?"(TU CUENTA ACTUAL)":""}</p>
          <p style="margin:4px 0 0;font-size:0.8rem;color:var(--color-gray-500);">
            UID: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:0.75rem;">${s.id}</code>
          </p>
          <p style="margin:4px 0 0;font-size:0.8rem;color:var(--color-gray-500);">
            Rol: <strong>${s.role}</strong> | Plan: <strong>${s.plan}</strong> | Activo: ${s.isActive?"Sí":"No"}
          </p>
          <p style="margin:4px 0 0;font-size:0.8rem;color:var(--color-gray-500);">
            📄 ${r} cotizaciones | 👥 ${x} clientes | 🏢 ${v} empresas
          </p>
          <p style="margin:4px 0 0;font-size:0.75rem;color:var(--color-gray-400);">
            Creado: ${C(s.createdAt)} | Actualizado: ${C(s.updatedAt)}
          </p>
          ${A?"":`
            <div style="margin-top:8px;">
              <input type="text" id="migrate-target-${s.id}" placeholder="UID destino (nueva cuenta)" 
                style="width:70%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:4px;font-size:0.8rem;margin-right:4px;">
              <button class="btn btn-xs btn-primary" onclick="window.migrateToUid('${s.id}')">Migrar</button>
            </div>
          `}
        </div>
      `}m+="</div>",n.innerHTML=m}catch(e){console.error("Search error:",e),n.innerHTML=`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">
      <p style="margin:0;color:#dc2626;">Error: ${e.message}</p>
      <p style="margin:8px 0 0;font-size:0.8rem;color:#991b1b;">
        Es posible que necesites crear un índice compuesto en Firebase Console para la búsqueda por email.
      </p>
    </div>`}};window.migrateToUid=async function(t){const n=document.getElementById(`migrate-target-${t}`),e=n==null?void 0:n.value.trim();if(!e){c("Ingresa el UID destino","error");return}if(e===t){c("El UID destino debe ser diferente","error");return}if(confirm(`¿Migrar datos de ${t.substring(0,8)}... a ${e.substring(0,8)}...?`)){c("Migrando datos...","info");try{const a=await z(t,e);a.success?(c(`✅ Migración exitosa: ${a.quotes} cotizaciones, ${a.clients} clientes, ${a.companies} empresas`,"success"),document.getElementById("migration-search-email").value="",document.getElementById("orphaned-data-result").innerHTML="",$(),I()):c("Error en la migración: "+(a.message||"Error desconocido"),"error")}catch(a){c("Error: "+a.message,"error")}}};window.manualMigrate=async function(){var a;const t=document.getElementById("migration-old-uid").value.trim(),n=document.getElementById("migration-new-uid").value.trim(),e=document.getElementById("manual-migration-result");if(!t||!n){c("Ingresa ambos UIDs","error");return}if(t===n){c("Los UIDs deben ser diferentes","error");return}if(confirm(`¿Migrar TODOS los datos de ${t} a ${n}?`)){e.innerHTML='<p style="color:var(--color-gray-500);">Migrando...</p>',c("Migrando datos...","info");try{const o=await z(t,n);o.success?(e.innerHTML=`
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;">
          <p style="margin:0;color:#166534;font-weight:500;">✅ Migración exitosa</p>
          <p style="margin:4px 0 0;color:#166534;font-size:0.85rem;">
            📄 ${o.quotes} cotizaciones | 👥 ${o.clients} clientes | 🏢 ${o.companies} empresas
          </p>
        </div>
      `,c("Migración exitosa","success"),$(),I()):e.innerHTML=`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">
        <p style="margin:0;color:#dc2626;">Error: ${o.message||"Error desconocido"}</p>
        ${((a=o.errors)==null?void 0:a.length)>0?`<p style="margin:8px 0 0;font-size:0.8rem;color:#991b1b;">${o.errors.join("<br>")}</p>`:""}
      </div>`}catch(o){e.innerHTML=`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">
      <p style="margin:0;color:#dc2626;">Error: ${o.message}</p>
    </div>`,c("Error: "+o.message,"error")}}};async function z(t,n){const e={quotes:0,clients:0,companies:0,errors:[],success:!0};try{const a=await q(l(i,"users",t));if(a.exists()){const s=a.data(),r=await q(l(i,"users",n));r.exists()?await D(l(i,"users",n),{name:s.name||r.data().name,company:s.company||r.data().company,phone:s.phone||r.data().phone||"",plan:s.plan||r.data().plan,licenseDuration:s.licenseDuration||0,planStartDate:s.planStartDate||null,planEndDate:s.planEndDate||null,quotesUsedThisMonth:s.quotesUsedThisMonth||0,role:s.role==="superadmin"?"superadmin":r.data().role,migratedFrom:t,migratedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}):await T(l(i,"users",n),{...s,id:n,migratedFrom:t,migratedAt:new Date().toISOString(),updatedAt:new Date().toISOString()})}const o=await g(y(p(i,"quotes"),b("userId","==",t)));for(const s of o.docs)try{const r=s.data();r.userId=n,r.migratedFrom=t,r.migratedAt=new Date().toISOString(),await k(p(i,"quotes"),r),e.quotes++}catch(r){e.errors.push(`Quote ${s.id}: ${r.message}`)}const d=await g(y(p(i,"clients"),b("userId","==",t)));for(const s of d.docs)try{const r=s.data();r.userId=n,r.migratedFrom=t,r.migratedAt=new Date().toISOString(),await k(p(i,"clients"),r),e.clients++}catch(r){e.errors.push(`Client ${s.id}: ${r.message}`)}const m=await g(y(p(i,"companies"),b("userId","==",t)));for(const s of m.docs)try{const r=s.data();r.userId=n,r.migratedFrom=t,r.migratedAt=new Date().toISOString(),await T(l(i,"companies",n),r),e.companies++}catch(r){e.errors.push(`Company ${s.id}: ${r.message}`)}if(e.errors.length===0){for(const s of o.docs)try{await w(l(i,"quotes",s.id))}catch{}for(const s of d.docs)try{await w(l(i,"clients",s.id))}catch{}for(const s of m.docs)try{await w(l(i,"companies",s.id))}catch{}try{await w(l(i,"users",t))}catch{}}e.errors.length>0&&(e.success=!1)}catch(a){e.success=!1,e.errors.push(a.message)}return e}window.scanOrphanedUsers=async function(){const t=document.getElementById("orphaned-scan-result");t.innerHTML='<p style="color:var(--color-gray-500);">Escaneando documentos de usuarios...</p>';try{const n=await g(p(i,"users")),e=[];if(n.forEach(o=>e.push({id:o.id,...o.data()})),e.length===0){t.innerHTML='<p style="color:var(--color-gray-500);">No se encontraron documentos de usuario.</p>';return}let a=`
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:12px;">
        <p style="margin:0;color:#92400e;font-weight:500;">📋 Documentos de usuario encontrados: ${e.length}</p>
        <p style="margin:4px 0 0;font-size:0.8rem;color:#a16207;">
          Los documentos marcados pueden corresponder a cuentas eliminadas de Firebase Auth.
          Verifica manualmente si el UID tiene una cuenta Auth activa en Firebase Console.
        </p>
      </div>
    `;a+='<div style="max-height:300px;overflow-y:auto;">',a+='<table class="table" style="font-size:0.85rem;"><thead><tr><th>UID</th><th>Email</th><th>Nombre</th><th>Rol</th><th>Plan</th><th>Acciones</th></tr></thead><tbody>';for(const o of e){const d=S.currentUser&&o.id===S.currentUser.uid;a+=`
        <tr style="${d?"background:#f0fdf4;":""}">
          <td><code style="font-size:0.7rem;">${o.id.substring(0,12)}...</code></td>
          <td>${o.email}</td>
          <td>${o.name||"-"}</td>
          <td>${o.role}</td>
          <td>${o.plan}</td>
          <td>
            ${d?'<small style="color:var(--color-gray-400);">Actual</small>':`
              <button class="btn btn-xs btn-danger" onclick="window.deleteUserDoc('${o.id}')" title="Eliminar documento">🗑️</button>
            `}
          </td>
        </tr>
      `}a+="</tbody></table></div>",t.innerHTML=a}catch(n){t.innerHTML=`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">
      <p style="margin:0;color:#dc2626;">Error: ${n.message}</p>
    </div>`}};window.deleteUserDoc=async function(t){if(confirm(`¿Eliminar el documento de usuario ${t.substring(0,8)}...?

Esto NO elimina la cuenta Firebase Auth, solo el documento Firestore.
Asegúrate de que el usuario tenga una copia de sus datos.`)&&confirm("⚠️ ESTA ACCIÓN ES IRREVERSIBLE. ¿Estás seguro?"))try{const n=await g(y(p(i,"quotes"),b("userId","==",t)));for(const a of n.docs)await w(l(i,"quotes",a.id));const e=await g(y(p(i,"clients"),b("userId","==",t)));for(const a of e.docs)await w(l(i,"clients",a.id));try{await w(l(i,"companies",t))}catch{}await w(l(i,"users",t)),c("Documento de usuario eliminado"),document.getElementById("orphaned-scan-result").innerHTML="",$(),I()}catch(n){c("Error: "+n.message,"error")}};
