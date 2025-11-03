/* containers.js — full version */

// ---------- Globals ----------
let containerData = [];
let isAdmin = false;

// Cache common DOM nodes once
const containerList = document.getElementById('container-list');
const searchBox     = document.getElementById('search-box');
const startInput    = document.getElementById('start-date');
const endInput      = document.getElementById('end-date');
const applyBtn      = document.getElementById('apply-date-filter');
const clearBtn      = document.getElementById('clear-date-filter');

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // 1) Role check first (to set isAdmin)
  await checkRoleAndSecureUI();

  // 2) Fetch and render table
  await loadContainers();

  // 3) Hook up filters/buttons
  wireUpFiltersAndActions();

  // 4) Wire up dropdown & logout
  wireUpDropdown();
  wireUpLogout();
}

/* -------------------------------
   Role check & Admin visibility
--------------------------------*/
async function checkRoleAndSecureUI() {
  try {
    const res = await fetch('/check-role');
    const data = await res.json();

    if (!data?.loggedIn) {
      window.location.href = '/login.html';
      return;
    }

    isAdmin = data.role === 'Admin';
    window.isAdmin = isAdmin; // keep your global if other scripts use it

    // Hide admin-only navbar links for non-admin
    if (!isAdmin) {
      document.querySelectorAll('.admin-only').forEach(link => link.style.display = 'none');
    }
  } catch (err) {
    console.error('Error checking user role:', err);
    window.location.href = '/login.html';
  }
}

/* -------------------------------
   Data load & render
--------------------------------*/
async function loadContainers() {
  try {
    const response = await fetch('/containers/list');
    const data = await response.json();

    containerData = data.map(container => ({
      id: container.id,
      container_number: container.container_number,
      weight: Number(container.weight) || 0,
      arrival_date: container.arrival_date,
      total_weight_sold: Number(container.total_weight_sold) || 0,
      total_weight_returned: Number(container.total_weight_returned) || 0,
      remaining_weight: Number(container.remaining_weight) || 0
    }));

    // Render full table (no filters initially)
    renderTable(containerData);
  } catch (err) {
    console.error('Error fetching containers:', err);
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) errorMsg.style.display = 'block';
  }
}

function renderTable(data) {
  containerList.innerHTML = '';
  let totalSold = 0, totalReturned = 0, totalRemaining = 0, totalWeight = 0;

  data.forEach((container, index) => {
    const formattedDate = formatDateDDMMYYYY(container.arrival_date);

    totalSold      += container.total_weight_sold || 0;
    totalReturned  += container.total_weight_returned || 0;
    totalRemaining += container.remaining_weight || 0;
    totalWeight    += container.weight || 0;

    const row = document.createElement('tr');
    row.setAttribute('data-id', container.id);
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${formattedDate}</td>
      <td>${escapeHTML(container.container_number ?? '')}</td>
      <td>
        <span class="weight-display" data-id="${container.id}">${formatNumber(container.weight)}</span>
        <input class="weight-input" type="number" value="${container.weight}" data-id="${container.id}" style="display:none;width:100px;" />
      </td>
      <td>${formatNumber(container.total_weight_sold)}</td>
      <td>${formatNumber(container.total_weight_returned)}</td>
      <td>${formatNumber(container.remaining_weight)}</td>
      <td>
		<button class="edit-btn" data-id="${container.id}"><span class="edit-text">Edit</span><i class="fas fa-edit"></i></button>
		<button class="delete-btn" data-id="${container.id}"><span class="delete-text">Delete</span><i class="fas fa-trash-alt"></i></button>	
      </td>
    `;
    containerList.appendChild(row);
  });

  // Totals row
  const totalRow = document.createElement('tr');
  totalRow.className = 'total-row';
  totalRow.innerHTML = `
    <td colspan="3"><strong>Totals:</strong></td>
    <td><strong>${formatNumber(totalWeight)}</strong></td>
    <td><strong>${formatNumber(totalSold)}</strong></td>
    <td><strong>${formatNumber(totalReturned)}</strong></td>
    <td><strong>${formatNumber(totalRemaining)}</strong></td>
    <td></td>
  `;
  containerList.appendChild(totalRow);

  // Wire up per-row buttons
  containerList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', handleEditContainer);
  });
  containerList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', handleDeleteContainer);
  });

  // Apply admin visibility on the freshly rendered table
  applyAdminVisibility();
}

function applyAdminVisibility() {
  const actionHeader = document.getElementById('action-column');

  if (!isAdmin) {
    // Hide Action header
    if (actionHeader) actionHeader.style.display = 'none';

    // Hide delete buttons
    containerList.querySelectorAll('.delete-btn').forEach(btn => btn.style.display = 'none');

    // Hide 8th column (Action) in all rows
    containerList.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length > 7 && cells[7]) {
        cells[7].style.display = 'none';
      }
    });
  } else {
    // Ensure visible for admins
    if (actionHeader) actionHeader.style.display = '';
    containerList.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length > 7 && cells[7]) {
        cells[7].style.display = '';
      }
    });
  }
}

/* -------------------------------
   Filters (search + date range)
--------------------------------*/

// Unified filter for search + date (inclusive)
function applyFilters() {
  const q = (searchBox?.value || '').toLowerCase().trim();

  const startDate = startInput?.value ? new Date(startInput.value + 'T00:00:00.000') : null;
  const endDate   = endInput?.value   ? new Date(endInput.value   + 'T23:59:59.999') : null;

  const filtered = containerData.filter(c => {
    const matchesSearch = (c.container_number ?? '').toLowerCase().includes(q);

    const ad = toStartOfDay(c.arrival_date);
    if (!ad) return false;

    const inRange =
      (!startDate || ad >= startDate) &&
      (!endDate   || ad <= endDate);

    return matchesSearch && inRange;
  });

  renderTable(filtered);
}

function wireUpFiltersAndActions() {
  // Apply button
  applyBtn?.addEventListener('click', applyFilters);

  // Clear button
  clearBtn?.addEventListener('click', () => {
    if (startInput) startInput.value = '';
    if (endInput)   endInput.value   = '';
    applyFilters();
  });

  // Re-filter as the user types in the search box
  searchBox?.addEventListener('input', applyFilters);

  // Convenience: Enter key on date inputs
  [startInput, endInput].forEach(inp => {
    inp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyFilters();
    });
  });
}

/* -------------------------------
   Row actions: edit & delete
--------------------------------*/
function handleEditContainer(e) {
  const containerId = Number(e.currentTarget.dataset.id);
  const container = containerData.find(c => Number(c.id) === containerId);

  if (!container) {
    alert('Container not found!');
    return;
  }

  const weightInput  = document.querySelector(`.weight-input[data-id="${containerId}"]`);
  const weightDisplay = document.querySelector(`.weight-display[data-id="${containerId}"]`);

  if (!weightInput || !weightDisplay) return;

  // Show input
  weightInput.style.display = 'inline';
  weightDisplay.style.display = 'none';
  weightInput.focus();

  const onBlur = async () => {
    const newWeight = Number(weightInput.value);
    const oldWeight = Number(container.weight);

    // If changed, confirm and update
    if (!Number.isNaN(newWeight) && newWeight !== oldWeight) {
      const ok = confirm('Are you sure you want to change the weight?');
      if (ok) {
        const diff = newWeight - oldWeight;
        let updatedRemaining = Number(container.remaining_weight);

        if (diff > 0) updatedRemaining += diff;
        else          updatedRemaining -= Math.abs(diff);

        try {
          const res = await fetch(`/container/update/${containerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight: newWeight, remaining_weight: updatedRemaining })
          });
          const data = await res.json();
          if (data?.success) {
            alert('Container weight updated successfully.');
            container.weight = newWeight;
            container.remaining_weight = updatedRemaining;
            applyFilters(); // re-render with current filters
          } else {
            alert('Failed to update container weight.');
          }
        } catch (err) {
          console.error('Error updating container:', err);
          alert('Error updating container.');
        }
      } else {
        // Revert in UI
        weightInput.value = oldWeight;
      }
    }

    // Hide input, show display
    weightInput.style.display = 'none';
    weightDisplay.style.display = 'inline';
    weightInput.removeEventListener('blur', onBlur);
  };

  weightInput.addEventListener('blur', onBlur);
}

async function handleDeleteContainer(e) {
  const containerId = e.currentTarget.dataset.id;
  const ok = confirm('Are you sure you want to delete this container?');
  if (!ok) return;

  try {
    const res = await fetch(`/container/delete/${containerId}`, { method: 'DELETE' });
    const data = await res.json();

    if (data?.success) {
      alert('Container deleted successfully.');
      // Refresh list
      await loadContainers();
      applyFilters(); // keep current filters after reload
    } else {
      alert('Failed to delete container.');
    }
  } catch (err) {
    console.error('Error deleting container:', err);
    alert('Failed to delete container.');
  }
}

/* -------------------------------
   Export functions (Excel/PDF)
   (Used by onclick on buttons)
--------------------------------*/
window.exportToExcel = function exportToExcel() {
  // We export the visible body rows (excluding totals row, which we add manually)
  const tableEl = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  [
    'ID','Arrival Date','Container Number','Weight','Sold','Returned','Remaining Weight'
  ].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  tableEl.appendChild(thead);

  const tbody = document.createElement('tbody');

  // Build rows from current rendered rows (excluding totals row)
  const rows = containerList.querySelectorAll('tr:not(.total-row)');
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if (cells.length >= 7) {
      const tr = document.createElement('tr');
      for (let i = 0; i < 7; i++) {
        const td = document.createElement('td');
        td.textContent = cells[i].innerText.trim();
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  });

  // Append totals row if present
  const totals = document.querySelector('.total-row');
  if (totals) {
    const cells = totals.querySelectorAll('td');
    const tr = document.createElement('tr');
    for (let i = 0; i < 7; i++) {
      const td = document.createElement('td');
      td.textContent = cells[i]?.innerText.trim() || '';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  tableEl.appendChild(tbody);

  // Use xlsx
  const wb = XLSX.utils.table_to_book(tableEl, { sheet: 'Container List' });
  XLSX.writeFile(wb, 'Container_List.xlsx');
};

window.exportToPDF = function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Date/time for file name
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).replace(/\//g, '-');

  let formattedTime = currentDate.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  formattedTime = formattedTime.replace(/[:\s]/g, '-').toUpperCase();

  const fileName = `Container_List_${formattedDate}_${formattedTime}.pdf`;

  generatePDF(doc, formattedDate, fileName);
};

function generatePDF(doc, formattedDate, fileName) {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const headerBarHeight = 18;
  let firstPage = true;

  const watermarkImg = new Image();
  watermarkImg.src = '/public/watermark.png';

  watermarkImg.onload = () => {
    // 1) header + watermark (every page)
    function drawHeaderAndWatermark() {
      // watermark
      doc.setGState(new doc.GState({ opacity: 0.2 }));
      const watermarkX = pageWidth / 4;
      const watermarkY = pageHeight / 3;
      const watermarkWidth = pageWidth / 2;
      const watermarkHeight = pageHeight / 4;
      doc.addImage(watermarkImg, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight);
      doc.setGState(new doc.GState({ opacity: 1 }));

      // header
      doc.setFillColor(49, 178, 230);
      doc.rect(0, 0, pageWidth, headerBarHeight, 'F');

      try {
        doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);
      } catch (e) {
        // ignore if missing
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Container List', pageWidth - 50, 11);

      // date only on first page
      if (firstPage) {
        const dateLabel = 'Date:';
        const dateText = formattedDate;
        const dateLabelWidth = doc.getTextWidth(dateLabel);
        const xPosition = pageWidth - dateLabelWidth - 40;
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(dateLabel, xPosition, 25);
        doc.setFont('helvetica', 'normal');
        doc.text(dateText, xPosition + dateLabelWidth + 5, 25);
        firstPage = false;
      }
    }

    // 2) build table body (same as yours)
    const rows = document
      .getElementById('container-list')
      .querySelectorAll('tr:not(.total-row)');

    const bodyRows = [];
    let totalWeight = 0,
        totalSold = 0,
        totalReturned = 0,
        totalRemaining = 0;

    rows.forEach(r => {
      const cells = r.querySelectorAll('td');
      if (cells.length >= 7) {
        bodyRows.push([
          cells[0].innerText.trim(),
          cells[1].innerText.trim(),
          cells[2].innerText.trim(),
          cells[3].innerText.trim(),
          cells[4].innerText.trim(),
          cells[5].innerText.trim(),
          cells[6].innerText.trim()
        ]);

        totalWeight    += parseFloat((cells[3].innerText || '0').replace(/,/g, '')) || 0;
        totalSold      += parseFloat((cells[4].innerText || '0').replace(/,/g, '')) || 0;
        totalReturned  += parseFloat((cells[5].innerText || '0').replace(/,/g, '')) || 0;
        totalRemaining += parseFloat((cells[6].innerText || '0').replace(/,/g, '')) || 0;
      }
    });

    const foot = [[
      { content: 'Totals:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
      totalWeight.toLocaleString('en-US'),
      totalSold.toLocaleString('en-US'),
      totalReturned.toLocaleString('en-US'),
      totalRemaining.toLocaleString('en-US')
    ]];

    // 3) create the table
    doc.autoTable({
      head: [['ID', 'Arrival Date', 'Container Number', 'Weight', 'Sold', 'Returned', 'Remaining Weight']],
      body: bodyRows,
      foot,
      showFoot: 'lastPage',           // totals only on last page ✅
      theme: 'grid',
      startY: headerBarHeight + 10,
      margin: { horizontal: 10, top: 20, bottom: 40 },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0]
      },
      footStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontSize: 8,
        fontStyle: 'bold'
      },
      didDrawPage: function () {
        // ONLY header + watermark here
        drawHeaderAndWatermark();
      }
    });

    // 4) NOW draw footer ONCE on the very last page ✅
    const totalPages = doc.internal.getNumberOfPages();
    doc.setPage(totalPages);  // jump to last page

    const line1 = 'Thank You For Your Business';
    const line2 = 'Generated by bYTE Ltd.';
    const line3 = 'For inquiries, contact support@lsgroup.com.bd';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(line1, (pageWidth - doc.getTextWidth(line1)) / 2, pageHeight - 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(line2, (pageWidth - doc.getTextWidth(line2)) / 2, pageHeight - 20);
    doc.text(line3, (pageWidth - doc.getTextWidth(line3)) / 2, pageHeight - 15);

    // 5) save
    doc.save(fileName);
  };
}



/* -------------------------------
   Navbar dropdown & Logout
--------------------------------*/
function wireUpDropdown() {
  const dropdownButton = document.querySelector('.dropbtn');
  const dropdownContent = document.querySelector('.dropdown-content');
  if (!dropdownButton || !dropdownContent) return;

  dropdownButton.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
  });

  document.addEventListener('click', () => {
    dropdownContent.style.display = 'none';
  });
}

function wireUpLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/logout', { method: 'POST' });
      const data = await res.json();
      if (data?.success) window.location.href = '/login.html';
      else alert('Logout failed.');
    } catch (err) {
      console.error('Logout error:', err);
      alert('Something went wrong during logout.');
    }
  });
}

/* -------------------------------
   Helpers
--------------------------------*/
function formatNumber(n) {
  const num = Number(n);
  return Number.isFinite(num) ? num.toLocaleString('en-US') : '0';
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateDDMMYYYY(value) {
  // Accepts ISO strings or dd/mm/yyyy
  const iso = new Date(value);
  if (!isNaN(iso)) {
    return new Intl.DateTimeFormat('en-GB').format(iso);
  }
  const m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(String(value).trim());
  if (m) {
    const day = Number(m[1]).toString().padStart(2, '0');
    const month = Number(m[2]).toString().padStart(2, '0');
    const year = m[3];
    return `${day}/${month}/${year}`;
  }
  return '';
}

function toStartOfDay(d) {
  // Accepts ISO-ish or dd/mm/yyyy
  const dt = new Date(d);
  if (!isNaN(dt)) {
    dt.setHours(0, 0, 0, 0);
    return dt;
  }
  const m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(String(d).trim());
  if (m) {
    const day = Number(m[1]), month = Number(m[2]) - 1, year = Number(m[3]);
    const dd = new Date(year, month, day, 0, 0, 0, 0);
    return isNaN(dd) ? null : dd;
  }
  return null;
}
