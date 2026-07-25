(function () {
  const script = document.currentScript;
  const config = script?.dataset || {};
  const root = (config.root || '').replace(/\/$/, '');
  const active = config.active || 'home';
  const title = config.title || 'POE2 Tools';

  const navItems = [
    { id: 'home', text: '首页', href: 'index.html', i18n: 'home' },
    { id: 'builds', text: '开荒', href: 'builds/index.html', i18n: 'buildsNav' },
    { id: 'hideout', text: '藏身处战神', href: 'tools/hideout-flip.html', i18n: 'hideoutNav' },
    { id: 'value', text: '价值曲线', href: 'tools/value-curve.html', i18n: 'valueCurveNav' },
    { id: 'gem', text: '技能倒卖', href: 'tools/gem-flip.html', i18n: 'gemFlipNav' },
    { id: 'ninja', text: '忍者网配置解析', href: 'tools/ninja-import.html', i18n: 'ninjaImportNav' }
  ];

  function href(path) {
    if (!root || root === '.') return path;
    return `${root}/${path}`;
  }

  function ensureStyle() {
    if (document.getElementById('siteHeaderStyle')) return;
    const style = document.createElement('style');
    style.id = 'siteHeaderStyle';
    style.textContent = `
      .site-header {
        position: sticky;
        top: 0;
        z-index: 20;
        min-height: 68px;
        padding: 14px 20px;
        border-bottom: 1px solid var(--line);
        background: #0b1120;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .site-header-left,
      .site-header-nav,
      .site-header-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .site-header-left { gap: 18px; }
      .site-header h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 650;
        letter-spacing: 0;
      }
      .site-header .nav-link {
        display: inline-flex;
        min-height: 36px;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 7px 12px;
        background: #0b1120;
        color: var(--text);
        font-size: 14px;
        text-decoration: none;
      }
      .site-header .nav-link.active {
        border-color: #0ea5e9;
        background: #075985;
      }
      .site-header-controls:empty { display: none; }
    `;
    document.head.appendChild(style);
  }

  function takeHeaderControls(oldHeader) {
    if (!oldHeader) return null;
    const explicit = oldHeader.querySelector('[data-site-header-controls]');
    if (explicit) return explicit;
    const topControls = oldHeader.querySelector('.top-controls');
    if (topControls) return topControls;
    const guideLang = oldHeader.querySelector('#guideLangSwitch');
    if (guideLang) {
      const wrap = document.createElement('div');
      wrap.className = 'top-controls';
      wrap.appendChild(guideLang);
      return wrap;
    }
    return null;
  }

  function render() {
    ensureStyle();
    const oldHeader = document.querySelector('header');
    const controls = takeHeaderControls(oldHeader);
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `
      <div class="site-header-left">
        <h1>${title}</h1>
        <nav class="site-header-nav" aria-label="工具导航">
          ${navItems.map((item) => `
            <a class="nav-link${item.id === active ? ' active' : ''}" href="${href(item.href)}" data-i18n="${item.i18n}">${item.text}</a>
          `).join('')}
        </nav>
      </div>
      <div class="site-header-controls"></div>
    `;
    if (controls) {
      controls.classList.add('site-header-controls-inner');
      header.querySelector('.site-header-controls').appendChild(controls);
    }
    if (oldHeader) oldHeader.replaceWith(header);
    else document.body.prepend(header);
    document.body.dataset.siteHeader = 'shared-v1';
    document.body.dataset.siteHeaderActive = active;
  }

  if (document.body) render();
  else document.addEventListener('DOMContentLoaded', render, { once: true });
}());
