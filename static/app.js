document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('fetchForm');
  const symbolInput = document.getElementById('symbol');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const intervalSelect = document.getElementById('interval');
  
  const btnPreview = document.getElementById('btnPreview');
  const btnDownload = document.getElementById('btnDownload');
  const btnDownloadTable = document.getElementById('btnDownloadTable');
  
  const errorAlert = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');
  const resultsCard = document.getElementById('resultsCard');
  
  const resultTitle = document.getElementById('resultTitle');
  const resultSubtitle = document.getElementById('resultSubtitle');
  const statRows = document.getElementById('statRows');
  const statClose = document.getElementById('statClose');
  const statHigh = document.getElementById('statHigh');
  const statLow = document.getElementById('statLow');
  
  const tableHead = document.getElementById('tableHead');
  const tableBody = document.getElementById('tableBody');

  // Set default dates: Start = 1 year ago, End = today
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  endDateInput.value = today.toISOString().split('T')[0];
  startDateInput.value = oneYearAgo.toISOString().split('T')[0];

  // Quick pick buttons
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      symbolInput.value = btn.getAttribute('data-symbol');
      triggerPreview();
    });
  });

  function showError(msg) {
    errorMessage.textContent = msg;
    errorAlert.style.display = 'flex';
  }

  function hideError() {
    errorAlert.style.display = 'none';
    errorMessage.textContent = '';
  }

  function setLoading(isLoading) {
    if (isLoading) {
      btnPreview.disabled = true;
      btnDownload.disabled = true;
      btnPreview.innerHTML = '<span class="spinner"></span> <span>Fetching Data...</span>';
    } else {
      btnPreview.disabled = false;
      btnDownload.disabled = false;
      btnPreview.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <span>Fetch & Preview Data</span>
      `;
    }
  }

  async function triggerPreview() {
    hideError();
    const symbol = symbolInput.value.trim().toUpperCase();
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const interval = intervalSelect.value;

    if (!symbol) {
      showError('Please enter a valid stock ticker symbol.');
      symbolInput.focus();
      return;
    }

    if (!startDate || !endDate) {
      showError('Please select both Start and End dates.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      showError('Start date cannot be later than End date.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol,
          start_date: startDate,
          end_date: endDate,
          interval: interval
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Failed to retrieve equity data.');
        resultsCard.style.display = 'none';
        return;
      }

      renderResults(data);
    } catch (err) {
      showError('Network error occurred while fetching stock data.');
      resultsCard.style.display = 'none';
    } finally {
      setLoading(false);
    }
  }

  function renderResults(data) {
    const { columns, rows, summary } = data;
    resultTitle.textContent = `${summary.symbol} Historical Market Data`;
    resultSubtitle.textContent = `Range: ${summary.start} to ${summary.end} • Showing first ${rows.length} records`;

    statRows.textContent = summary.total_rows.toLocaleString();
    statClose.textContent = summary.latest_close !== null ? `$${summary.latest_close.toFixed(2)}` : 'N/A';
    statHigh.textContent = summary.max_high !== null ? `$${summary.max_high.toFixed(2)}` : 'N/A';
    statLow.textContent = summary.min_low !== null ? `$${summary.min_low.toFixed(2)}` : 'N/A';

    // Render table headers
    tableHead.innerHTML = `<tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>`;

    // Render table rows
    tableBody.innerHTML = rows.map(row => {
      return `<tr>${columns.map(col => {
        let val = row[col];
        if (typeof val === 'number') {
          // If column is volume, format as integer with commas
          if (col.toLowerCase().includes('volume')) {
            val = Math.round(val).toLocaleString();
          } else {
            val = val.toFixed(2);
          }
        }
        return `<td>${val ?? '-'}</td>`;
      }).join('')}</tr>`;
    }).join('');

    resultsCard.style.display = 'block';
    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function initiateDownload() {
    hideError();
    const symbol = symbolInput.value.trim().toUpperCase();
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const interval = intervalSelect.value;

    if (!symbol) {
      showError('Please enter a ticker symbol to download CSV.');
      symbolInput.focus();
      return;
    }

    if (!startDate || !endDate) {
      showError('Please select both Start and End dates.');
      return;
    }

    const downloadUrl = `/api/download?symbol=${encodeURIComponent(symbol)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&interval=${encodeURIComponent(interval)}`;
    window.location.href = downloadUrl;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    triggerPreview();
  });

  btnDownload.addEventListener('click', initiateDownload);
  btnDownloadTable.addEventListener('click', initiateDownload);
});
