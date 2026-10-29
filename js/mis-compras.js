(() => {
  'use strict';
  const HISTORY_KEY = 'cineprime_tickets_history_v1';
  const list = document.getElementById('purchasesList');
  const empty = document.getElementById('purchasesEmpty');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => `Bs ${Number(value || 0).toFixed(2).replace('.', ',')}`;
  function load() { try { const rows = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(rows) ? rows : []; } catch (_) { return []; } }
  function render() {
    const rows = load(); list.innerHTML = ''; empty.hidden = rows.length > 0;
    rows.forEach(item => {
      const card = document.createElement('article'); card.className = 'ticket-outer-border';
      card.innerHTML = `<div class="ticket-body p-3 p-md-4 d-flex flex-column flex-md-row justify-content-between gap-3"><div><span class="badge-valid rounded-pill px-3 py-1">COMPRA CONFIRMADA</span><h2 class="h5 text-white mt-3 mb-1">${esc(item.funcion?.pelicula || 'Ticket CinePrime')}</h2><p class="text-muted mb-1">Compra #${esc(item.id_compra)} · Código ${esc(item.codigo_ticket || 'Pendiente')}</p><p class="text-muted mb-1">${esc(item.funcion?.inicio ? new Date(item.funcion.inicio).toLocaleString('es-CL') : 'Fecha de función no disponible')}</p><p class="text-muted mb-0">Total: ${money(item.total)}</p></div><div class="d-flex flex-wrap align-items-center gap-2"><button class="btn btn-cm-secondary rounded-pill" data-action="view" data-id="${esc(item.id_compra)}">Ver / descargar ticket</button><button class="btn btn-cm-outline rounded-pill" data-action="email" data-id="${esc(item.id_compra)}">Reenviar correo (simulado)</button></div></div>`;
      list.appendChild(card);
    });
  }
  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    const item = load().find(row => String(row.id_compra) === String(button.dataset.id)); if (!item) return;
    if (button.dataset.action === 'view') { localStorage.setItem('cineprime_selected_ticket_v1', JSON.stringify(item)); window.location.href = 'confirmacion.html'; return; }
    let sent = []; try { sent = JSON.parse(localStorage.getItem('cineprime_email_simulated_v1') || '[]'); } catch (_) {}
    sent = Array.isArray(sent) ? sent : []; sent.unshift({id_compra:item.id_compra, correo:item.comprador?.correo || '', fecha:new Date().toISOString(), estado:'SIMULADO'}); localStorage.setItem('cineprime_email_simulated_v1', JSON.stringify(sent.slice(0,50)));
    window.alert(`Simulación de reenvío: el ticket quedó preparado para ${item.comprador?.correo || 'el correo registrado en la compra'}. No se envió un correo real.`);
  });
  document.addEventListener('DOMContentLoaded', render);
})();