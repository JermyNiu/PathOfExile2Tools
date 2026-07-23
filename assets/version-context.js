(function () {
  const storageKey = 'poe2-tools:selected-version';

  async function readJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} ${response.status}`);
    return response.json();
  }

  function label(version) {
    return `${version.season} / Tree ${version.poe2dbPassiveTreeVersion}`;
  }

  function getSavedVersionId() {
    return localStorage.getItem(storageKey);
  }

  function saveVersionId(versionId) {
    localStorage.setItem(storageKey, versionId);
  }

  function history(versions) {
    return (versions.history || []).filter((version) => version.status !== 'draft');
  }

  function selectedVersion(versions) {
    const list = history(versions);
    const saved = getSavedVersionId();
    return (saved && list.find((item) => item.id === saved)) || versions.current;
  }

  function normalizeVersionToken(value) {
    return String(value || '').trim().toLowerCase();
  }

  function findVersion(versions, token) {
    const list = history(versions);
    const normalized = normalizeVersionToken(token);
    if (!normalized) return null;
    return list.find((item) => normalizeVersionToken(item.id) === normalized)
      || list.find((item) => normalizeVersionToken(item.poe2dbPassiveTreeVersion) === normalized)
      || list.find((item) => normalizeVersionToken(item.pobbTreeSvgVersion) === normalized)
      || null;
  }

  function resolveVersion(versions, token) {
    return findVersion(versions, token) || selectedVersion(versions);
  }

  function fillSelect(select, versions, selectedId) {
    const list = history(versions);
    const activeId = selectedId || selectedVersion(versions).id;
    select.innerHTML = '';
    list.forEach((version) => {
      const option = document.createElement('option');
      option.value = version.id;
      option.textContent = label(version);
      option.selected = version.id === activeId;
      select.appendChild(option);
    });
    return list.find((version) => version.id === activeId) || versions.current;
  }

  window.POE2Versions = {
    storageKey,
    readJson,
    label,
    getSavedVersionId,
    saveVersionId,
    history,
    selectedVersion,
    findVersion,
    resolveVersion,
    fillSelect
  };
}());
