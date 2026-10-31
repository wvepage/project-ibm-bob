/**
 * ============================================================
 *  Indonesia Health Insight Dashboard — script.js
 *  Vanilla JavaScript: data loading, chart rendering, filters
 * ============================================================
 */

// ============================================================
// 1. GLOBAL STATE
// ============================================================
let healthData = null;          // Raw JSON data
let charts     = {};            // Chart.js instances registry
let activeFilters = {
  province : '',
  year     : '',
  category : '',
  indicator: ''
};

// ============================================================
// 2. ENTRY POINT — Load data then initialise dashboard
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  showLoading(true);
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    healthData = await response.json();
    initDashboard();
  } catch (err) {
    console.error('[Dashboard] Gagal memuat data:', err);
    showError('Gagal memuat file data.json. Pastikan file tersedia dan server berjalan.');
  } finally {
    showLoading(false);
  }
});

// ============================================================
// 3. INITIALISE DASHBOARD
// ============================================================
function initDashboard() {
  buildFilterOptions();
  renderKPICards();
  renderMaternalKPI();
  renderSourcesSection();
  renderAllCharts();
}

// ============================================================
// 4. CHART.JS GLOBAL DEFAULTS
// ============================================================
Chart.defaults.font.family = '-apple-system, "Segoe UI", Roboto, sans-serif';
Chart.defaults.font.size   = 12;
Chart.defaults.color       = '#6b7280';
Chart.defaults.plugins.legend.labels.boxWidth  = 12;
Chart.defaults.plugins.legend.labels.padding   = 16;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17,24,39,.9)';
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.cornerRadius    = 8;
Chart.defaults.plugins.tooltip.titleFont       = { size: 12, weight: 'bold' };
Chart.defaults.plugins.tooltip.bodyFont        = { size: 12 };

// ============================================================
// 5. FILTER SETUP
// ============================================================
function buildFilterOptions() {
  const opts = healthData.filter_options;

  // Province
  const pSel = document.getElementById('filterProvince');
  opts.provinces.forEach(p => {
    if (p === 'Semua Provinsi') return; // already in HTML as default
    pSel.add(new Option(p, p));
  });

  // Year
  const ySel = document.getElementById('filterYear');
  opts.years.forEach(y => ySel.add(new Option(y, y)));

  // Category
  const cSel = document.getElementById('filterCategory');
  opts.categories.forEach(c => {
    if (c === 'Semua Kategori') return;
    cSel.add(new Option(c, c));
  });

  // Indicator — populated when category changes
  document.getElementById('filterCategory').addEventListener('change', updateIndicatorOptions);
}

function updateIndicatorOptions() {
  const cat  = document.getElementById('filterCategory').value;
  const iSel = document.getElementById('filterIndicator');
  iSel.innerHTML = '<option value="">Semua Indikator</option>';

  if (cat && healthData.filter_options.indicators[cat]) {
    healthData.filter_options.indicators[cat].forEach(ind => {
      iSel.add(new Option(ind, ind));
    });
  }
}

// Called on every filter change (except category, which also calls updateIndicatorOptions above)
function applyFilters() {
  activeFilters.province  = document.getElementById('filterProvince').value;
  activeFilters.year      = document.getElementById('filterYear').value;
  activeFilters.category  = document.getElementById('filterCategory').value;
  activeFilters.indicator = document.getElementById('filterIndicator').value;

  showFilterInfo();
  updateAllCharts();
}

function resetFilters() {
  document.getElementById('filterProvince').value  = '';
  document.getElementById('filterYear').value      = '';
  document.getElementById('filterCategory').value  = '';
  document.getElementById('filterIndicator').innerHTML = '<option value="">Semua Indikator</option>';
  activeFilters = { province:'', year:'', category:'', indicator:'' };
  document.getElementById('filterInfo').classList.add('hidden');
  updateAllCharts();
}

function showFilterInfo() {
  const parts = [];
  if (activeFilters.province)  parts.push(`Provinsi: ${activeFilters.province}`);
  if (activeFilters.year)      parts.push(`Tahun: ${activeFilters.year}`);
  if (activeFilters.category)  parts.push(`Kategori: ${activeFilters.category}`);
  if (activeFilters.indicator) parts.push(`Indikator: ${activeFilters.indicator}`);

  const el = document.getElementById('filterInfo');
  if (parts.length > 0) {
    el.textContent = 'Filter aktif: ' + parts.join(' · ');
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// ============================================================
// 6. NAVIGATION
// ============================================================
function navigateTo(sectionId) {
  // Hide all sections
  document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
  // Show target
  const target = document.getElementById(`section-${sectionId}`);
  if (target) target.classList.add('active');

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === sectionId);
  });

  // Close sidebar on mobile
  if (window.innerWidth <= 768) closeSidebar();

  // Ensure charts resize properly on reveal
  setTimeout(resizeAllCharts, 50);
}

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const isOpen   = sidebar.classList.toggle('open');
  overlay.classList.toggle('active', isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ============================================================
// 7. KPI CARDS
// ============================================================
const KPI_CONFIG = [
  {
    key  : 'total_population',
    label: 'Total Penduduk',
    color: 'kpi-blue',
    icon : 'blue',
    svgPath: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>',
    format : v => formatNumber(v)
  },
  {
    key  : 'total_hospitals',
    label: 'Rumah Sakit',
    color: 'kpi-green',
    icon : 'green',
    svgPath: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    format : v => formatNumber(v)
  },
  {
    key  : 'total_puskesmas',
    label: 'Puskesmas',
    color: 'kpi-purple',
    icon : 'purple',
    svgPath: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>',
    format : v => formatNumber(v)
  },
  {
    key  : 'stunting_prevalence',
    label: 'Prevalensi Stunting',
    color: 'kpi-orange',
    icon : 'orange',
    svgPath: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
    format : v => v
  }
];

function renderKPICards() {
  const container = document.getElementById('kpiGrid');
  container.innerHTML = '';

  KPI_CONFIG.forEach(cfg => {
    const data = healthData.kpi[cfg.key];
    const html = `
      <div class="kpi-card ${cfg.color}">
        <div class="kpi-icon ${cfg.icon}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${cfg.svgPath}</svg>
        </div>
        <div class="kpi-label">${cfg.label}</div>
        <div class="kpi-value">${cfg.format(data.value)}<span class="kpi-unit">${data.unit}</span></div>
        <div class="kpi-year">Data tahun ${data.year}</div>
      </div>`;
    container.insertAdjacentHTML('beforeend', html);
  });
}

function renderMaternalKPI() {
  const d = healthData.maternal_child_health;
  const container = document.getElementById('maternalKpi');

  const lastMMR   = d.maternal_mortality_rate.trend.at(-1);
  const lastIMR   = d.infant_mortality_rate.trend.at(-1);
  const lastImm   = d.immunization_coverage.trend.at(-1);

  const items = [
    { label:'Kematian Ibu (2023)', value: formatNumber(lastMMR.value), unit: 'kasus',          color:'kpi-orange', icon:'orange', path:'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
    { label:'Kematian Bayi (2023)', value: lastIMR.value,              unit: 'per 1.000 KH',   color:'kpi-blue',   icon:'blue',   path:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
    { label:'Imunisasi Anak (2023)', value: lastImm.value,             unit: '%',               color:'kpi-green',  icon:'green',  path:'<polyline points="20 6 9 17 4 12"/>' }
  ];

  container.innerHTML = '';
  items.forEach(it => {
    container.insertAdjacentHTML('beforeend', `
      <div class="kpi-card ${it.color}">
        <div class="kpi-icon ${it.icon}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${it.path}</svg>
        </div>
        <div class="kpi-label">${it.label}</div>
        <div class="kpi-value">${it.value}<span class="kpi-unit">${it.unit}</span></div>
      </div>`);
  });
}

// ============================================================
// 8. SOURCES SECTION
// ============================================================
function renderSourcesSection() {
  const sources = healthData.metadata.sources;
  const container = document.getElementById('sourcesContent');
  container.innerHTML = '<div class="source-grid"></div>';
  const grid = container.querySelector('.source-grid');

  sources.forEach(src => {
    grid.insertAdjacentHTML('beforeend', `
      <div class="source-card">
        <div class="source-name">${src.name}</div>
        <div class="source-desc">${src.description}</div>
        <a class="source-link" href="${src.url}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          ${src.url}
        </a>
      </div>`);
  });

  // Indicator reference table
  const indicators = healthData.filter_options.indicators;
  let tableHTML = `
    <div class="chart-card" style="margin-bottom:0">
      <div class="chart-card-header"><h3 class="chart-title">Referensi Indikator</h3></div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f3f4f8">
            <th style="text-align:left;padding:10px 12px;border-bottom:1.5px solid #e5e7eb;font-weight:700">Kategori</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1.5px solid #e5e7eb;font-weight:700">Indikator</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1.5px solid #e5e7eb;font-weight:700">Sumber</th>
          </tr>
        </thead><tbody>`;

  const srcMap = { 'Penyakit Menular':'Kemenkes RI', 'Kesehatan Ibu & Anak':'Kemenkes RI / BPS', 'Gizi & Stunting':'SSGI – Kemenkes RI', 'Fasilitas Kesehatan':'Kemenkes RI' };
  Object.entries(indicators).forEach(([cat, inds]) => {
    tableHTML += `<tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:9px 12px;font-weight:600;vertical-align:top">${cat}</td>
      <td style="padding:9px 12px;color:#374151">${inds.join(', ')}</td>
      <td style="padding:9px 12px;color:#6b7280">${srcMap[cat] || 'Kemenkes RI'}</td>
    </tr>`;
  });
  tableHTML += '</tbody></table></div>';
  container.insertAdjacentHTML('beforeend', tableHTML);
}

// ============================================================
// 9. RENDER ALL CHARTS
// ============================================================
function renderAllCharts() {
  // Overview
  renderDiseaseTrendChart('chartDiseaseTrendOverview');
  renderNutritionPieChart('chartNutritionOverview');
  renderImmunizationTrendChart('chartImmunizationOverview');
  renderStuntingTrendChart('chartStuntingTrendOverview');

  // Diseases
  renderDiseaseTrendChart('chartDiseaseTrend');
  renderDiseaseCompareChart();
  renderDiseaseProvinceChart();
  renderMalariaProvinceChart();

  // Maternal
  renderMMRChart();
  renderIMRChart();
  renderImmunizationTrendChart('chartImmunization');
  renderMaternalProvinceChart();

  // Nutrition
  renderStuntingTrendChart('chartStuntingTrend');
  renderNutritionPieChart('chartNutritionStatus');
  renderStuntingProvinceChart();
  renderStuntingAllChart();

  // Facilities
  renderHospitalsChart();
  renderPuskesmasChart();
  renderHealthWorkersChart();
  renderFacilitiesCompareChart();
}

// Called whenever filters change
function updateAllCharts() {
  // Destroy and re-render; simplest approach given filter scope
  renderAllCharts();
  renderKPICards();
  renderMaternalKPI();
}

// ============================================================
// 10. CHART HELPERS
// ============================================================

/**
 * Safely create or replace a chart on a canvas element.
 * Destroys previous instance if it exists.
 */
function makeChart(id, config) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  charts[id] = new Chart(canvas.getContext('2d'), config);
  return charts[id];
}

/** Filter trend data by year if year filter is active */
function filterTrend(trendArr) {
  if (!activeFilters.year) return trendArr;
  return trendArr.filter(d => String(d.year) === String(activeFilters.year));
}

/** Filter province-based array. Province filter narrows down to single row. */
function filterByProvince(arr, provinceKey = 'province') {
  if (!activeFilters.province) return arr;
  return arr.filter(d => d[provinceKey] === activeFilters.province);
}

// Colour palettes
const PALETTE = {
  blue  : 'rgba(26,86,219,.85)',
  blueL : 'rgba(26,86,219,.15)',
  green : 'rgba(14,159,110,.85)',
  greenL: 'rgba(14,159,110,.15)',
  red   : 'rgba(239,68,68,.85)',
  redL  : 'rgba(239,68,68,.15)',
  orange: 'rgba(245,158,11,.85)',
  purple: 'rgba(124,58,237,.85)',
  teal  : 'rgba(20,184,166,.85)',
  pink  : 'rgba(236,72,153,.85)'
};

// ============================================================
// 11. DISEASE CHARTS
// ============================================================

function renderDiseaseTrendChart(canvasId) {
  const raw  = filterTrend(healthData.communicable_diseases.trend);
  const labels = raw.map(d => d.year);

  makeChart(canvasId, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label     : 'DBD',
          data      : raw.map(d => d.dbd),
          borderColor: PALETTE.red,
          backgroundColor: PALETTE.redL,
          tension   : 0.35,
          fill      : true,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label     : 'TBC',
          data      : raw.map(d => d.tbc),
          borderColor: PALETTE.blue,
          backgroundColor: PALETTE.blueL,
          tension   : 0.35,
          fill      : true,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label     : 'Malaria',
          data      : raw.map(d => d.malaria),
          borderColor: PALETTE.green,
          backgroundColor: PALETTE.greenL,
          tension   : 0.35,
          fill      : true,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} kasus`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => formatK(v) },
          grid : { color: 'rgba(0,0,0,.05)' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderDiseaseCompareChart() {
  const lastYearData = healthData.communicable_diseases.trend.at(-1);
  makeChart('chartDiseaseCompare', {
    type: 'bar',
    data: {
      labels  : ['DBD', 'TBC', 'Malaria'],
      datasets: [{
        label          : `Jumlah Kasus (${lastYearData.year})`,
        data           : [lastYearData.dbd, lastYearData.tbc, lastYearData.malaria],
        backgroundColor: [PALETTE.red, PALETTE.blue, PALETTE.green],
        borderRadius   : 6,
        borderSkipped  : false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString('id-ID')} kasus` }
        }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => formatK(v) }, grid: { color:'rgba(0,0,0,.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderDiseaseProvinceChart() {
  let data = filterByProvince(healthData.communicable_diseases.by_province);

  // Sort by total, take top 10
  data = data
    .map(d => ({ ...d, total: d.dbd + d.tbc + d.malaria }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  makeChart('chartDiseaseProvince', {
    type: 'bar',
    data: {
      labels  : data.map(d => d.province),
      datasets: [
        { label:'DBD',    data: data.map(d=>d.dbd),    backgroundColor: PALETTE.red,    borderRadius:4 },
        { label:'TBC',    data: data.map(d=>d.tbc),    backgroundColor: PALETTE.blue,   borderRadius:4 },
        { label:'Malaria',data: data.map(d=>d.malaria),backgroundColor: PALETTE.green,  borderRadius:4 }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.x.toLocaleString('id-ID')} kasus` }
        }
      },
      scales: {
        x: { stacked: true, ticks: { callback: v=>formatK(v) }, grid:{ color:'rgba(0,0,0,.05)' } },
        y: { stacked: true, grid: { display: false } }
      }
    }
  });
}

function renderMalariaProvinceChart() {
  let data = filterByProvince(healthData.communicable_diseases.by_province)
    .sort((a, b) => b.malaria - a.malaria)
    .slice(0, 10);

  makeChart('chartMalariaProvince', {
    type: 'bar',
    data: {
      labels  : data.map(d => d.province),
      datasets: [{
        label          : 'Kasus Malaria',
        data           : data.map(d => d.malaria),
        backgroundColor: PALETTE.green,
        borderRadius   : 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString('id-ID')} kasus` }
        }
      },
      scales: {
        y: { beginAtZero: true, ticks:{ callback: v=>formatK(v) }, grid:{ color:'rgba(0,0,0,.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ============================================================
// 12. MATERNAL & CHILD CHARTS
// ============================================================

function renderMMRChart() {
  const raw = filterTrend(healthData.maternal_child_health.maternal_mortality_rate.trend);
  makeChart('chartMMR', {
    type: 'line',
    data: {
      labels  : raw.map(d => d.year),
      datasets: [{
        label          : 'Jumlah Kematian Ibu',
        data           : raw.map(d => d.value),
        borderColor    : PALETTE.orange,
        backgroundColor: 'rgba(245,158,11,.1)',
        tension        : 0.35,
        fill           : true,
        pointRadius    : 5,
        pointHoverRadius: 7
      }]
    },
    options: chartLineOptions('kasus', 'Kematian Ibu')
  });
}

function renderIMRChart() {
  const raw = filterTrend(healthData.maternal_child_health.infant_mortality_rate.trend);
  makeChart('chartIMR', {
    type: 'line',
    data: {
      labels  : raw.map(d => d.year),
      datasets: [{
        label          : 'AKB (per 1.000 KH)',
        data           : raw.map(d => d.value),
        borderColor    : PALETTE.blue,
        backgroundColor: PALETTE.blueL,
        tension        : 0.35,
        fill           : true,
        pointRadius    : 5,
        pointHoverRadius: 7
      }]
    },
    options: chartLineOptions('per 1.000 KH', 'Kematian Bayi')
  });
}

function renderImmunizationTrendChart(canvasId) {
  const raw = filterTrend(healthData.maternal_child_health.immunization_coverage.trend);
  makeChart(canvasId, {
    type: 'line',
    data: {
      labels  : raw.map(d => d.year),
      datasets: [{
        label          : 'Cakupan Imunisasi (%)',
        data           : raw.map(d => d.value),
        borderColor    : PALETTE.green,
        backgroundColor: PALETTE.greenL,
        tension        : 0.35,
        fill           : true,
        pointRadius    : 5,
        pointHoverRadius: 7
      }]
    },
    options: chartLineOptions('%', 'Imunisasi')
  });
}

function renderMaternalProvinceChart() {
  let data = filterByProvince(healthData.maternal_child_health.by_province);

  makeChart('chartMaternalProvince', {
    type: 'bar',
    data: {
      labels  : data.map(d => d.province),
      datasets: [
        { label:'AKI (kasus)',    data: data.map(d=>d.mmr),          backgroundColor: PALETTE.orange, borderRadius:4 },
        { label:'AKB (per 1.000)', data: data.map(d=>d.imr),         backgroundColor: PALETTE.blue,   borderRadius:4 },
        { label:'Imunisasi (%)',   data: data.map(d=>d.immunization), backgroundColor: PALETTE.green,  borderRadius:4 }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position:'top' },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.x}` }
        }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' } },
        y: { grid: { display: false } }
      }
    }
  });
}

// ============================================================
// 13. NUTRITION CHARTS
// ============================================================

function renderStuntingTrendChart(canvasId) {
  const raw = filterTrend(healthData.nutrition.stunting_trend);
  makeChart(canvasId, {
    type: 'line',
    data: {
      labels  : raw.map(d => d.year),
      datasets: [{
        label          : 'Prevalensi Stunting (%)',
        data           : raw.map(d => d.value),
        borderColor    : PALETTE.orange,
        backgroundColor: 'rgba(245,158,11,.12)',
        tension        : 0.35,
        fill           : true,
        pointRadius    : 5,
        pointHoverRadius: 7,
        pointBackgroundColor: PALETTE.orange
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` Stunting: ${ctx.parsed.y}%` } }
      },
      scales: {
        y: {
          beginAtZero: false,
          min: 15, max: 35,
          ticks: { callback: v => v + '%' },
          grid: { color: 'rgba(0,0,0,.05)' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderNutritionPieChart(canvasId) {
  const data = healthData.nutrition.nutritional_status;
  makeChart(canvasId, {
    type: 'doughnut',
    data: {
      labels  : data.map(d => d.status),
      datasets: [{
        data           : data.map(d => d.value),
        backgroundColor: [PALETTE.orange, PALETTE.red, PALETTE.blue, PALETTE.purple],
        borderWidth    : 2,
        borderColor    : '#ffffff',
        hoverOffset    : 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` } }
      }
    }
  });
}

function renderStuntingProvinceChart() {
  let data = filterByProvince(healthData.nutrition.by_province)
    .sort((a, b) => b.stunting - a.stunting)
    .slice(0, 10);

  makeChart('chartStuntingProvince', {
    type: 'bar',
    data: {
      labels  : data.map(d => d.province),
      datasets: [{
        label          : 'Prevalensi Stunting (%)',
        data           : data.map(d => d.stunting),
        backgroundColor: data.map(d =>
          d.stunting >= 30 ? PALETTE.red : d.stunting >= 25 ? PALETTE.orange : PALETTE.blue
        ),
        borderRadius   : 5
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x}%` } }
      },
      scales: {
        x: { beginAtZero: true, max: 45, ticks:{ callback: v=>v+'%' }, grid:{ color:'rgba(0,0,0,.05)' } },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderStuntingAllChart() {
  let data = filterByProvince(healthData.nutrition.by_province)
    .sort((a, b) => a.stunting - b.stunting);

  makeChart('chartStuntingAll', {
    type: 'bar',
    data: {
      labels  : data.map(d => d.province),
      datasets: [{
        label          : 'Prevalensi Stunting (%)',
        data           : data.map(d => d.stunting),
        backgroundColor: data.map(d =>
          d.stunting >= 30 ? PALETTE.red : d.stunting >= 25 ? PALETTE.orange : PALETTE.green
        ),
        borderRadius   : 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}%` } }
      },
      scales: {
        y: { beginAtZero: true, max: 45, ticks:{ callback: v=>v+'%' }, grid:{ color:'rgba(0,0,0,.05)' } },
        x: { ticks: { maxRotation: 45 }, grid: { display: false } }
      }
    }
  });
}

// ============================================================
// 14. FACILITIES CHARTS
// ============================================================

function renderHospitalsChart() {
  let data = filterByProvince(healthData.health_facilities.hospitals_by_province)
    .sort((a, b) => b.hospitals - a.hospitals)
    .slice(0, 15);

  makeChart('chartHospitals', {
    type: 'bar',
    data: {
      labels  : data.map(d => d.province),
      datasets: [{
        label          : 'Jumlah Rumah Sakit',
        data           : data.map(d => d.hospitals),
        backgroundColor: PALETTE.blue,
        borderRadius   : 5
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} RS` } }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' } },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderPuskesmasChart() {
  let data = filterByProvince(healthData.health_facilities.hospitals_by_province)
    .sort((a, b) => b.puskesmas - a.puskesmas)
    .slice(0, 15);

  makeChart('chartPuskesmas', {
    type: 'bar',
    data: {
      labels  : data.map(d => d.province),
      datasets: [{
        label          : 'Jumlah Puskesmas',
        data           : data.map(d => d.puskesmas),
        backgroundColor: PALETTE.green,
        borderRadius   : 5
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} unit` } }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' } },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderHealthWorkersChart() {
  const data = healthData.health_facilities.health_workers_by_region;
  makeChart('chartHealthWorkers', {
    type: 'bar',
    data: {
      labels  : data.map(d => d.region),
      datasets: [
        { label:'Dokter',   data: data.map(d=>d.doctors),  backgroundColor: PALETTE.blue,   borderRadius:4 },
        { label:'Perawat',  data: data.map(d=>d.nurses),   backgroundColor: PALETTE.green,  borderRadius:4 },
        { label:'Bidan',    data: data.map(d=>d.midwives),  backgroundColor: PALETTE.purple, borderRadius:4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('id-ID')} orang` }
        }
      },
      scales: {
        y: { beginAtZero: true, ticks:{ callback: v=>formatK(v) }, grid:{ color:'rgba(0,0,0,.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderFacilitiesCompareChart() {
  let data = filterByProvince(healthData.health_facilities.hospitals_by_province)
    .sort((a, b) => b.hospitals - a.hospitals)
    .slice(0, 12);

  makeChart('chartFacilitiesCompare', {
    type: 'bar',
    data: {
      labels  : data.map(d => d.province),
      datasets: [
        { label:'Rumah Sakit', data: data.map(d=>d.hospitals), backgroundColor: PALETTE.blue,  borderRadius:4 },
        { label:'Puskesmas',   data: data.map(d=>d.puskesmas), backgroundColor: PALETTE.teal,  borderRadius:4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} unit` }
        }
      },
      scales: {
        y: { beginAtZero: true, ticks:{ callback: v=>formatK(v) }, grid:{ color:'rgba(0,0,0,.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ============================================================
// 15. SHARED CHART OPTION BUILDER
// ============================================================
function chartLineOptions(unit, label) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${label}: ${ctx.parsed.y} ${unit}` } }
    },
    scales: {
      y: { beginAtZero: false, ticks:{ callback: v=>v.toLocaleString('id-ID') }, grid:{ color:'rgba(0,0,0,.05)' } },
      x: { grid: { display: false } }
    }
  };
}

// ============================================================
// 16. UTILITIES
// ============================================================

/** Format large numbers with locale string */
function formatNumber(n) {
  return Number(n).toLocaleString('id-ID');
}

/** Abbreviate large numbers for axis labels */
function formatK(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'jt';
  if (v >= 1_000)     return (v / 1_000).toFixed(0) + 'rb';
  return v;
}

/** Show/hide loading overlay */
function showLoading(visible) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = visible ? 'flex' : 'none';
}

/** Show error toast */
function showError(msg) {
  const toast = document.getElementById('errorToast');
  const msgEl = document.getElementById('errorMsg');
  if (!toast) return;
  msgEl.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 6000);
}

/** Resize all active charts (called on window resize / section reveal) */
function resizeAllCharts() {
  Object.values(charts).forEach(c => {
    try { c.resize(); } catch(_) {}
  });
}

// Resize charts on window resize
window.addEventListener('resize', () => {
  clearTimeout(window._resizeTimer);
  window._resizeTimer = setTimeout(resizeAllCharts, 200);
});


// ============================================================
// 17. COMPARISON MODULE — Province vs Province & Year vs Year
// ============================================================

// ---- Province colour palette for comparison lines ----
const COMP_COLORS = [
  { border: '#1a56db', bg: 'rgba(26,86,219,.15)',  cls: 'a' },
  { border: '#0e9f6e', bg: 'rgba(14,159,110,.15)', cls: 'b' },
  { border: '#f59e0b', bg: 'rgba(245,158,11,.15)', cls: 'c' }
];

// ---- Radar normalisation max values per indicator ----
const RADAR_MAX = {
  dbd: 30000, tbc: 160000, malaria: 120000,
  stunting: 45, imr: 50, immunization: 100,
  hospitals: 400, puskesmas: 1200
};

/**
 * Initialise the comparison section selects.
 * Called once after data is loaded (inside initDashboard).
 */
function initComparisonSection() {
  const provinces = healthData.comparison.province_yearly.map(p => p.province);
  const years     = healthData.filter_options.years;

  // Province dropdowns (A, B — shared between same-year and trend sub-modes)
  const selA = document.getElementById('compProvinceA');
  const selB = document.getElementById('compProvinceB');
  const selC = document.getElementById('compProvinceC');

  provinces.forEach(p => {
    selA.add(new Option(p, p));
    selB.add(new Option(p, p));
    selC.add(new Option(p, p));
  });

  // Defaults: A = index 0, B = index 1
  selA.value = provinces[0];
  selB.value = provinces[1] || provinces[0];

  // "Pada Tahun yang Sama" year selector
  const selSY = document.getElementById('compSameYear');
  years.forEach(y => selSY.add(new Option(y, y)));
  selSY.value = String(years[years.length - 1]);   // default = latest year (2023)

  // Year-mode dropdowns
  const selYP = document.getElementById('compYearProvince');
  const selYA = document.getElementById('compYearA');
  const selYB = document.getElementById('compYearB');

  provinces.forEach(p => selYP.add(new Option(p, p)));
  years.forEach(y => {
    selYA.add(new Option(y, y));
    selYB.add(new Option(y, y));
  });

  selYP.value = provinces[0];
  selYA.value = String(years[0]);
  selYB.value = String(years[years.length - 1]);

  // Render defaults for all modes
  renderSameYearComparison();
  renderComparisonCharts();
  renderYearComparisonCharts();
}

// ---- Switch between Province / Year main comparison modes ----
function switchCompMode(mode) {
  document.querySelectorAll('.comp-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode)
  );
  document.getElementById('compModeProvince').classList.toggle('active', mode === 'province');
  document.getElementById('compModeYear').classList.toggle('active', mode === 'year');
  setTimeout(resizeAllCharts, 50);
}

// ---- Switch between "Pada Tahun yang Sama" / "Tren Semua Tahun" sub-modes ----
function switchProvinceSubMode(sub) {
  document.querySelectorAll('.submode-pill').forEach(p =>
    p.classList.toggle('active', p.dataset.sub === sub)
  );
  document.getElementById('subModeSameYear').classList.toggle('active', sub === 'sameyear');
  document.getElementById('subModeTrend').classList.toggle('active', sub === 'trend');
  setTimeout(resizeAllCharts, 50);
}

// ============================================================
// 18. PROVINCE COMPARISON CHARTS
// ============================================================

function renderComparisonCharts() {
  const indicator = document.getElementById('compIndicator').value;
  const pA        = document.getElementById('compProvinceA').value;
  const pB        = document.getElementById('compProvinceB').value;
  const pC        = document.getElementById('compProvinceC').value;

  // Collect selected provinces (skip empty C)
  const selected = [pA, pB, pC].filter(Boolean);
  const meta     = healthData.comparison.indicators_meta[indicator];

  // Lookup time series per province
  const seriesData = selected.map(name =>
    healthData.comparison.province_yearly.find(p => p.province === name)
  ).filter(Boolean);

  if (!seriesData.length) return;

  const years = seriesData[0].data.map(d => d.year);

  // Update titles
  document.getElementById('compTrendTitle').textContent =
    `Tren ${meta.label} — ${selected.join(' vs ')} (2018–2023)`;
  document.getElementById('compBarTitle').textContent =
    `Perbandingan ${meta.label} Terbaru — ${selected.join(' vs ')}`;

  // ── Trend line chart ──
  makeChart('chartCompTrend', {
    type: 'line',
    data: {
      labels: years,
      datasets: seriesData.map((s, i) => ({
        label           : s.province,
        data            : s.data.map(d => d[indicator]),
        borderColor     : COMP_COLORS[i].border,
        backgroundColor : COMP_COLORS[i].bg,
        tension         : 0.35,
        fill            : true,
        pointRadius     : 5,
        pointHoverRadius: 7
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('id-ID')} ${meta.unit}` }
        }
      },
      scales: {
        y: { beginAtZero: false, ticks: { callback: v => formatK(v) }, grid: { color: 'rgba(0,0,0,.05)' } },
        x: { grid: { display: false } }
      }
    }
  });

  // ── Bar chart (latest year) ──
  const latest = seriesData.map(s => s.data.at(-1)[indicator]);
  makeChart('chartCompBar', {
    type: 'bar',
    data: {
      labels  : seriesData.map(s => s.province),
      datasets: [{
        label          : `${meta.label} (2023)`,
        data           : latest,
        backgroundColor: seriesData.map((_, i) => COMP_COLORS[i].border),
        borderRadius   : 7,
        borderSkipped  : false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString('id-ID')} ${meta.unit}` } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => formatK(v) }, grid: { color: 'rgba(0,0,0,.05)' } },
        x: { grid: { display: false } }
      }
    }
  });

  // ── Radar chart (all 8 indicators, normalised, latest year) ──
  const allIndicators = Object.keys(RADAR_MAX);
  const indicatorLabels = allIndicators.map(k => healthData.comparison.indicators_meta[k].label);

  makeChart('chartCompRadar', {
    type: 'radar',
    data: {
      labels  : indicatorLabels,
      datasets: seriesData.map((s, i) => {
        const last = s.data.at(-1);
        return {
          label          : s.province,
          data           : allIndicators.map(k => Math.min(100, (last[k] / RADAR_MAX[k]) * 100)),
          borderColor    : COMP_COLORS[i].border,
          backgroundColor: COMP_COLORS[i].bg,
          borderWidth    : 2,
          pointRadius    : 4,
          pointHoverRadius: 6
        };
      })
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        r: {
          beginAtZero: true, max: 100,
          ticks: { display: false },
          pointLabels: { font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,.1)' }
        }
      }
    }
  });

  // ── Summary stat cards ──
  renderCompStatCards(seriesData, indicator, meta);

  // ── Delta table ──
  renderCompDeltaTable(seriesData, indicator, meta);
}

// ---- Summary cards: latest value + change from first year ----
function renderCompStatCards(seriesData, indicator, meta) {
  const container = document.getElementById('compStatCards');
  container.innerHTML = '';

  seriesData.forEach((s, i) => {
    const first = s.data[0][indicator];
    const last  = s.data.at(-1)[indicator];
    const delta = last - first;
    const pct   = first !== 0 ? ((delta / first) * 100).toFixed(1) : '–';
    const deltaClass = delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'neu';
    const sign  = delta > 0 ? '+' : '';
    const cls   = ['a','b','c'][i];

    container.insertAdjacentHTML('beforeend', `
      <div class="comp-stat-card province-${cls}">
        <div class="comp-stat-province ${cls}">${s.province}</div>
        <div>
          <span class="comp-stat-value">${last.toLocaleString('id-ID')}</span>
          <span class="comp-stat-unit">${meta.unit}</span>
        </div>
        <div class="comp-stat-label">${meta.label} · 2023</div>
        <div>
          <span class="comp-stat-delta ${deltaClass}">
            ${sign}${delta.toLocaleString('id-ID')} (${sign}${pct}%) sejak 2018
          </span>
        </div>
      </div>`);
  });
}

// ---- Delta table: value each year per province ----
function renderCompDeltaTable(seriesData, indicator, meta) {
  const container = document.getElementById('compDeltaTable');
  const years = seriesData[0].data.map(d => d.year);

  let html = `<table class="comp-delta-table">
    <thead><tr>
      <th>Tahun</th>
      ${seriesData.map(s => `<th>${s.province}</th>`).join('')}
      ${seriesData.length > 1
        ? `<th>Selisih (A−B)</th><th>Δ A-B (%)</th>`
        : ''}
    </tr></thead><tbody>`;

  years.forEach(yr => {
    const vals = seriesData.map(s => s.data.find(d => d.year === yr)[indicator]);
    const diff = seriesData.length > 1 ? (vals[0] - vals[1]) : null;
    const pct  = (seriesData.length > 1 && vals[1] !== 0)
      ? ((diff / vals[1]) * 100).toFixed(1)
      : null;

    html += `<tr>
      <td><strong>${yr}</strong></td>
      ${vals.map(v => `<td>${v.toLocaleString('id-ID')}</td>`).join('')}
      ${diff !== null
        ? `<td class="${diff > 0 ? 'cell-pos' : diff < 0 ? 'cell-neg' : ''}">${diff > 0 ? '+' : ''}${diff.toLocaleString('id-ID')}</td>
           <td class="${diff > 0 ? 'cell-pos' : diff < 0 ? 'cell-neg' : ''}">${diff > 0 ? '+' : ''}${pct}%</td>`
        : ''}
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ============================================================
// 19. YEAR COMPARISON CHARTS
// ============================================================

function renderYearComparisonCharts() {
  const provinceName = document.getElementById('compYearProvince').value;
  const yearA        = Number(document.getElementById('compYearA').value);
  const yearB        = Number(document.getElementById('compYearB').value);

  const provinceRow = healthData.comparison.province_yearly.find(p => p.province === provinceName);
  if (!provinceRow) return;

  const rowA = provinceRow.data.find(d => d.year === yearA);
  const rowB = provinceRow.data.find(d => d.year === yearB);
  if (!rowA || !rowB) return;

  const indKeys   = Object.keys(RADAR_MAX);
  const indMeta   = healthData.comparison.indicators_meta;

  // ── Update headings ──
  document.getElementById('yearCompBarTitle').textContent =
    `${provinceName} — Semua Indikator: ${yearA} vs ${yearB}`;
  document.getElementById('yearTrendTitle').textContent =
    `${provinceName} — Tren Semua Indikator Kesehatan (2018–2023)`;
  document.getElementById('yearRadarTitle').textContent =
    `${provinceName} — Radar: ${yearA} vs ${yearB}`;
  document.getElementById('yearDeltaBarTitle').textContent =
    `${provinceName} — Perubahan (Δ) ${yearA} → ${yearB}`;

  // ── Delta summary cards ──
  renderYearDeltaCards(rowA, rowB, yearA, yearB, indKeys, indMeta);

  // ── Grouped bar: yearA vs yearB (use normalised 0–100 for multi-unit) ──
  makeChart('chartYearCompBar', {
    type: 'bar',
    data: {
      labels  : indKeys.map(k => indMeta[k].label),
      datasets: [
        {
          label          : String(yearA),
          data           : indKeys.map(k => Math.min(100, (rowA[k] / RADAR_MAX[k]) * 100)),
          backgroundColor: 'rgba(26,86,219,.8)',
          borderRadius   : 5
        },
        {
          label          : String(yearB),
          data           : indKeys.map(k => Math.min(100, (rowB[k] / RADAR_MAX[k]) * 100)),
          backgroundColor: 'rgba(14,159,110,.8)',
          borderRadius   : 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const key = indKeys[ctx.dataIndex];
              const rawVal = ctx.datasetIndex === 0 ? rowA[key] : rowB[key];
              return ` ${ctx.dataset.label}: ${rawVal.toLocaleString('id-ID')} ${indMeta[key].unit}`;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, max: 105, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,.05)' } },
        x: { ticks: { maxRotation: 30 }, grid: { display: false } }
      }
    }
  });

  // ── Multi-indicator trend lines ──
  const allYears = provinceRow.data.map(d => d.year);
  const trendDatasets = indKeys.map((k, i) => {
    const hue = [210, 160, 45, 38, 270, 195, 330, 165][i % 8];
    return {
      label           : indMeta[k].label,
      data            : provinceRow.data.map(d => Math.min(100, (d[k] / RADAR_MAX[k]) * 100)),
      borderColor     : `hsl(${hue},65%,45%)`,
      backgroundColor : `hsla(${hue},65%,45%,.1)`,
      tension         : 0.35,
      fill            : false,
      pointRadius     : 3,
      pointHoverRadius: 5,
      borderWidth     : 2
    };
  });

  makeChart('chartYearTrend', {
    type: 'line',
    data: { labels: allYears, datasets: trendDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const key = indKeys[ctx.datasetIndex];
              const rawVal = provinceRow.data.find(d => d.year === allYears[ctx.dataIndex])[key];
              return ` ${ctx.dataset.label}: ${rawVal.toLocaleString('id-ID')} ${indMeta[key].unit}`;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, max: 105, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,.05)' } },
        x: { grid: { display: false } }
      }
    }
  });

  // ── Radar: yearA vs yearB ──
  makeChart('chartYearRadar', {
    type: 'radar',
    data: {
      labels  : indKeys.map(k => indMeta[k].label),
      datasets: [
        {
          label          : String(yearA),
          data           : indKeys.map(k => Math.min(100, (rowA[k] / RADAR_MAX[k]) * 100)),
          borderColor    : 'rgba(26,86,219,.9)',
          backgroundColor: 'rgba(26,86,219,.15)',
          borderWidth    : 2,
          pointRadius    : 4
        },
        {
          label          : String(yearB),
          data           : indKeys.map(k => Math.min(100, (rowB[k] / RADAR_MAX[k]) * 100)),
          borderColor    : 'rgba(14,159,110,.9)',
          backgroundColor: 'rgba(14,159,110,.15)',
          borderWidth    : 2,
          pointRadius    : 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        r: {
          beginAtZero: true, max: 100,
          ticks: { display: false },
          pointLabels: { font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,.1)' }
        }
      }
    }
  });

  // ── Delta bar: change per indicator ──
  const deltas = indKeys.map(k => {
    const vA = rowA[k], vB = rowB[k];
    // normalise delta to same %-scale for readability
    return parseFloat(((vB - vA) / RADAR_MAX[k] * 100).toFixed(2));
  });

  makeChart('chartYearDeltaBar', {
    type: 'bar',
    data: {
      labels  : indKeys.map(k => indMeta[k].label),
      datasets: [{
        label          : `Δ ${yearA} → ${yearB}`,
        data           : deltas,
        backgroundColor: deltas.map(v => v >= 0 ? 'rgba(14,159,110,.8)' : 'rgba(239,68,68,.8)'),
        borderRadius   : 5,
        borderSkipped  : false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const key = indKeys[ctx.dataIndex];
              const realDelta = rowB[key] - rowA[key];
              const sign = realDelta >= 0 ? '+' : '';
              return ` Δ ${sign}${realDelta.toLocaleString('id-ID')} ${indMeta[key].unit}`;
            }
          }
        }
      },
      scales: {
        y: { ticks: { callback: v => (v >= 0 ? '+' : '') + v + 'pt' }, grid: { color: 'rgba(0,0,0,.05)' } },
        x: { ticks: { maxRotation: 30 }, grid: { display: false } }
      }
    }
  });
}

// ---- Year delta summary cards ----
function renderYearDeltaCards(rowA, rowB, yearA, yearB, indKeys, indMeta) {
  const container = document.getElementById('yearDeltaCards');
  container.innerHTML = '';

  indKeys.forEach(k => {
    const vA    = rowA[k];
    const vB    = rowB[k];
    const delta = vB - vA;
    const pct   = vA !== 0 ? ((delta / vA) * 100).toFixed(1) : '–';
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '●';
    const aDir  = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
    const pDir  = delta > 0 ? 'pos' : delta < 0 ? 'neg' : '';
    const sign  = delta >= 0 ? '+' : '';

    container.insertAdjacentHTML('beforeend', `
      <div class="year-delta-card">
        <div class="year-delta-indicator">${indMeta[k].label}</div>
        <div class="year-delta-values">
          <span class="year-delta-val">${vA.toLocaleString('id-ID')}</span>
          <span class="year-delta-arrow ${aDir}">${arrow}</span>
          <span class="year-delta-val">${vB.toLocaleString('id-ID')}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <span style="font-size:11px;color:#6b7280">${yearA} → ${yearB}</span>
          <span class="year-delta-pct ${pDir}">${sign}${pct}%</span>
        </div>
      </div>`);
  });
}

// ============================================================
// 20. HOOK COMPARISON INIT INTO EXISTING FLOW
// ============================================================

// Extend initDashboard to also boot the comparison section
const _origInit = initDashboard;
initDashboard = function () {
  _origInit();
  initComparisonSection();
};

// ============================================================
// 21. SAME-YEAR PROVINCE COMPARISON (core new feature)
// ============================================================

/**
 * Indicators where a LOWER value is better (e.g. disease cases, mortality).
 * Used to determine which province "wins" each head-to-head.
 */
const LOWER_IS_BETTER = new Set(['dbd', 'tbc', 'malaria', 'imr']);

/**
 * Render all "Pada Tahun yang Sama" charts and UI for the two selected provinces.
 * Triggered by any change to compSameYear, compProvinceA, or compProvinceB.
 */
function renderSameYearComparison() {
  const year   = Number(document.getElementById('compSameYear').value);
  const nameA  = document.getElementById('compProvinceA').value;
  const nameB  = document.getElementById('compProvinceB').value;

  if (!year || !nameA || !nameB) return;

  const rowSrcA = healthData.comparison.province_yearly.find(p => p.province === nameA);
  const rowSrcB = healthData.comparison.province_yearly.find(p => p.province === nameB);
  if (!rowSrcA || !rowSrcB) return;

  const rowA = rowSrcA.data.find(d => d.year === year);
  const rowB = rowSrcB.data.find(d => d.year === year);
  if (!rowA || !rowB) {
    // Year not in data for one of the provinces
    document.getElementById('h2hScoreboard').innerHTML =
      `<div class="info-box"><div class="info-box-title">Data tidak tersedia untuk tahun ${year} pada salah satu provinsi yang dipilih.</div></div>`;
    return;
  }

  const indKeys = Object.keys(RADAR_MAX);
  const indMeta = healthData.comparison.indicators_meta;

  // Update all dynamic titles and source labels
  const titleSuffix = `${nameA} vs ${nameB} — ${year}`;
  document.getElementById('compSameYearBarTitle').textContent   = `Perbandingan Semua Indikator: ${titleSuffix}`;
  document.getElementById('compSameYearRadarTitle').textContent = `Profil Multidimensi: ${titleSuffix}`;
  document.getElementById('compSameYearWinnerTitle').textContent= `Head-to-Head per Indikator: ${titleSuffix}`;
  document.getElementById('compSameYearTableTitle').textContent = `Tabel Perbandingan Detail: ${titleSuffix}`;
  document.getElementById('compSameYearSource').textContent     = `Sumber: Kemenkes RI / BPS / SSGI · ${year}`;

  // ── 1. Head-to-head scoreboard ──
  renderH2HScoreboard(nameA, nameB, rowA, rowB, year, indKeys, indMeta);

  // ── 2. Grouped bar — all indicators side-by-side ──
  renderSameYearGroupedBar(nameA, nameB, rowA, rowB, year, indKeys, indMeta);

  // ── 3. Radar ──
  renderSameYearRadar(nameA, nameB, rowA, rowB, indKeys, indMeta);

  // ── 4. Winner polar/horizontal bar ──
  renderSameYearWinnerChart(nameA, nameB, rowA, rowB, indKeys, indMeta);

  // ── 5. Detail table ──
  renderSameYearTable(nameA, nameB, rowA, rowB, year, indKeys, indMeta);
}

// ---- 1. Head-to-head scoreboard banner ----
function renderH2HScoreboard(nameA, nameB, rowA, rowB, year, indKeys, indMeta) {
  const container = document.getElementById('h2hScoreboard');

  // Count wins (indicators where each province is "better")
  let winsA = 0, winsB = 0, draws = 0;
  indKeys.forEach(k => {
    const vA = rowA[k], vB = rowB[k];
    if (vA === vB) { draws++; return; }
    const aBetter = LOWER_IS_BETTER.has(k) ? vA < vB : vA > vB;
    if (aBetter) winsA++; else winsB++;
  });

  // Summary KPI stat cards (3 spotlight indicators)
  const spotlight = ['stunting', 'imr', 'immunization'];

  container.innerHTML = `
    <div class="h2h-banner">
      <!-- Province A side -->
      <div class="h2h-side a">
        <div class="h2h-province-name a">${nameA}</div>
        <div class="h2h-score a">${winsA}</div>
        <div class="h2h-score-label">indikator lebih baik</div>
      </div>
      <!-- Centre: year badge + draws -->
      <div class="h2h-center">
        <div class="h2h-year-badge">${year}</div>
        <div class="h2h-vs">VS</div>
        ${draws > 0 ? `<div class="h2h-draws">${draws} seri</div>` : ''}
      </div>
      <!-- Province B side -->
      <div class="h2h-side b">
        <div class="h2h-province-name b">${nameB}</div>
        <div class="h2h-score b">${winsB}</div>
        <div class="h2h-score-label">indikator lebih baik</div>
      </div>
    </div>

    <!-- Spotlight stat row -->
    <div class="h2h-spotlight">
      ${spotlight.map(k => {
        const vA = rowA[k], vB = rowB[k];
        const aBetter = LOWER_IS_BETTER.has(k) ? vA < vB : vA > vB;
        const bBetter = LOWER_IS_BETTER.has(k) ? vB < vA : vB > vA;
        return `
          <div class="h2h-spotlight-card">
            <div class="h2h-spotlight-label">${indMeta[k].label}</div>
            <div class="h2h-spotlight-values">
              <span class="h2h-spot-val ${aBetter ? 'winner' : bBetter ? 'loser' : ''}">${vA.toLocaleString('id-ID')}</span>
              <span class="h2h-spot-sep">${indMeta[k].unit}</span>
              <span class="h2h-spot-val ${bBetter ? 'winner' : aBetter ? 'loser' : ''}">${vB.toLocaleString('id-ID')}</span>
            </div>
            <div class="h2h-spotlight-names">
              <span>${nameA}</span><span>${nameB}</span>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ---- 2. Grouped bar all-indicators ----
function renderSameYearGroupedBar(nameA, nameB, rowA, rowB, year, indKeys, indMeta) {
  makeChart('chartCompSameYear', {
    type: 'bar',
    data: {
      labels  : indKeys.map(k => indMeta[k].label),
      datasets: [
        {
          label          : nameA,
          data           : indKeys.map(k => parseFloat(((rowA[k] / RADAR_MAX[k]) * 100).toFixed(2))),
          backgroundColor: 'rgba(26,86,219,.82)',
          borderRadius   : 5
        },
        {
          label          : nameB,
          data           : indKeys.map(k => parseFloat(((rowB[k] / RADAR_MAX[k]) * 100).toFixed(2))),
          backgroundColor: 'rgba(14,159,110,.82)',
          borderRadius   : 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const k      = indKeys[ctx.dataIndex];
              const rawVal = ctx.datasetIndex === 0 ? rowA[k] : rowB[k];
              return ` ${ctx.dataset.label}: ${rawVal.toLocaleString('id-ID')} ${indMeta[k].unit}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true, max: 110,
          ticks: { callback: v => v + ' pt' },
          grid : { color: 'rgba(0,0,0,.05)' },
          title: { display: true, text: 'Skor relatif (0–100)', font: { size: 11 }, color: '#6b7280' }
        },
        x: { ticks: { maxRotation: 25 }, grid: { display: false } }
      }
    }
  });
}

// ---- 3. Radar snapshot ----
function renderSameYearRadar(nameA, nameB, rowA, rowB, indKeys, indMeta) {
  makeChart('chartCompSameYearRadar', {
    type: 'radar',
    data: {
      labels  : indKeys.map(k => indMeta[k].label),
      datasets: [
        {
          label          : nameA,
          data           : indKeys.map(k => Math.min(100, (rowA[k] / RADAR_MAX[k]) * 100)),
          borderColor    : 'rgba(26,86,219,.9)',
          backgroundColor: 'rgba(26,86,219,.15)',
          borderWidth    : 2,
          pointRadius    : 4,
          pointHoverRadius: 6
        },
        {
          label          : nameB,
          data           : indKeys.map(k => Math.min(100, (rowB[k] / RADAR_MAX[k]) * 100)),
          borderColor    : 'rgba(14,159,110,.9)',
          backgroundColor: 'rgba(14,159,110,.15)',
          borderWidth    : 2,
          pointRadius    : 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const k      = indKeys[ctx.dataIndex];
              const rawVal = ctx.datasetIndex === 0 ? rowA[k] : rowB[k];
              return ` ${ctx.dataset.label}: ${rawVal.toLocaleString('id-ID')} ${indMeta[k].unit}`;
            }
          }
        }
      },
      scales: {
        r: {
          beginAtZero: true, max: 100,
          ticks: { display: false },
          pointLabels: { font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,.1)' }
        }
      }
    }
  });
}

// ---- 4. Winner horizontal bar (green = winner, red = loser per province context) ----
function renderSameYearWinnerChart(nameA, nameB, rowA, rowB, indKeys, indMeta) {
  // Build delta scores: positive = A better, negative = B better
  // All normalised to 0–100 scale so bars are comparable
  const scores = indKeys.map(k => {
    const nA = (rowA[k] / RADAR_MAX[k]) * 100;
    const nB = (rowB[k] / RADAR_MAX[k]) * 100;
    // For lower-is-better, invert so "less" = higher bar
    const scoreA = LOWER_IS_BETTER.has(k) ? (100 - nA) : nA;
    const scoreB = LOWER_IS_BETTER.has(k) ? (100 - nB) : nB;
    return parseFloat((scoreA - scoreB).toFixed(2));
  });

  makeChart('chartCompSameYearWinner', {
    type: 'bar',
    data: {
      labels  : indKeys.map(k => indMeta[k].label),
      datasets: [{
        label          : `Keunggulan (positif = ${nameA} lebih baik)`,
        data           : scores,
        backgroundColor: scores.map(v => v > 0 ? 'rgba(26,86,219,.82)' : 'rgba(14,159,110,.82)'),
        borderRadius   : 5,
        borderSkipped  : false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.x;
              if (Math.abs(v) < 0.5) return ' Setara';
              return v > 0
                ? ` ${nameA} unggul (+${v.toFixed(1)} pt)`
                : ` ${nameB} unggul (+${Math.abs(v).toFixed(1)} pt)`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { callback: v => (v >= 0 ? '+' : '') + v + ' pt' },
          grid : { color: 'rgba(0,0,0,.06)' }
        },
        y: { grid: { display: false } }
      }
    }
  });
}

// ---- 5. Detail comparison table ----
function renderSameYearTable(nameA, nameB, rowA, rowB, year, indKeys, indMeta) {
  const container = document.getElementById('compSameYearTable');

  let html = `
    <table class="comp-delta-table">
      <thead>
        <tr>
          <th>Indikator</th>
          <th>Satuan</th>
          <th style="color:#1a56db">${nameA}</th>
          <th style="color:#0e9f6e">${nameB}</th>
          <th>Selisih (A−B)</th>
          <th>Selisih (%)</th>
          <th>Lebih Baik</th>
        </tr>
      </thead>
      <tbody>`;

  indKeys.forEach(k => {
    const vA   = rowA[k];
    const vB   = rowB[k];
    const diff = vA - vB;
    const pct  = vB !== 0 ? ((diff / vB) * 100).toFixed(1) : '–';

    const aBetter = LOWER_IS_BETTER.has(k) ? vA < vB : vA > vB;
    const bBetter = LOWER_IS_BETTER.has(k) ? vB < vA : vB > vA;
    const winner  = vA === vB ? '—' : aBetter ? `✓ ${nameA}` : `✓ ${nameB}`;
    const winCls  = vA === vB ? '' : aBetter ? 'cell-pos' : 'cell-neg';
    const signDiff = diff >= 0 ? '+' : '';
    const signPct  = parseFloat(pct) >= 0 ? '+' : '';
    const diffCls  = diff === 0 ? '' : diff > 0 ? 'cell-pos' : 'cell-neg';

    html += `
      <tr>
        <td>${indMeta[k].label}</td>
        <td style="color:#6b7280;font-size:12px">${indMeta[k].unit}</td>
        <td><strong>${vA.toLocaleString('id-ID')}</strong></td>
        <td><strong>${vB.toLocaleString('id-ID')}</strong></td>
        <td class="${diffCls}">${signDiff}${diff.toLocaleString('id-ID')}</td>
        <td class="${diffCls}">${signPct}${pct}%</td>
        <td class="${winCls}" style="font-weight:700">${winner}</td>
      </tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}
