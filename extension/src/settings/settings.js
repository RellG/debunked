const DEFAULTS = {
  autoAnalyze: true,
  showLoader: true,
  customDomains: []
};

document.addEventListener('DOMContentLoaded', async () => {
  const autoAnalyze = document.getElementById('auto-analyze');
  const showLoader = document.getElementById('show-loader');
  const domainInput = document.getElementById('domain-input');
  const addDomainBtn = document.getElementById('add-domain');
  const domainList = document.getElementById('domain-list');
  const backBtn = document.getElementById('back-btn');

  // Load settings
  const stored = await chrome.storage.sync.get('settings');
  const settings = { ...DEFAULTS, ...stored.settings };

  autoAnalyze.checked = settings.autoAnalyze;
  showLoader.checked = settings.showLoader;
  renderDomains(settings.customDomains);

  // Save on toggle change
  autoAnalyze.addEventListener('change', () => save({ autoAnalyze: autoAnalyze.checked }));
  showLoader.addEventListener('change', () => save({ showLoader: showLoader.checked }));

  // Add domain
  addDomainBtn.addEventListener('click', () => addDomain());
  domainInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addDomain(); });

  async function addDomain() {
    const domain = domainInput.value.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
    if (!domain || !domain.includes('.')) return;

    const current = await getSettings();
    if (current.customDomains.includes(domain)) return;

    current.customDomains.push(domain);
    await save({ customDomains: current.customDomains });
    renderDomains(current.customDomains);
    domainInput.value = '';
  }

  async function removeDomain(domain) {
    const current = await getSettings();
    current.customDomains = current.customDomains.filter(d => d !== domain);
    await save({ customDomains: current.customDomains });
    renderDomains(current.customDomains);
  }

  function renderDomains(domains) {
    domainList.innerHTML = domains.map(d => `
      <li>
        <span>${d}</span>
        <button class="remove-domain" data-domain="${d}">&times;</button>
      </li>
    `).join('');

    domainList.querySelectorAll('.remove-domain').forEach(btn => {
      btn.addEventListener('click', () => removeDomain(btn.dataset.domain));
    });
  }

  async function getSettings() {
    const stored = await chrome.storage.sync.get('settings');
    return { ...DEFAULTS, ...stored.settings };
  }

  async function save(partial) {
    const current = await getSettings();
    const updated = { ...current, ...partial };
    await chrome.storage.sync.set({ settings: updated });
  }

  backBtn.addEventListener('click', () => {
    window.location.href = '../popup/popup.html';
  });
});
