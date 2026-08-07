(function () {
  const icpNumber = '京ICP备2026047780号';
  const footerId = 'site-compliance-footer';

  function ensureStyle() {
    if (document.getElementById(`${footerId}-style`)) return;
    const style = document.createElement('style');
    style.id = `${footerId}-style`;
    style.textContent = `
      #${footerId} {
        border-top: 1px solid rgba(148, 163, 184, 0.22);
        margin-top: 24px;
        padding: 16px 20px 20px;
        color: #94a3b8;
        font-size: 13px;
        line-height: 1.5;
        text-align: center;
      }
      #${footerId} a {
        color: inherit;
        text-decoration: none;
      }
      #${footerId} a:hover {
        color: #e5e7eb;
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }

  function renderFooter() {
    if (document.getElementById(footerId)) return;
    ensureStyle();
    const footer = document.createElement('footer');
    footer.id = footerId;
    footer.innerHTML = `<a href="https://beian.miit.gov.cn/" target="_blank">${icpNumber}</a>`;
    document.body.appendChild(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderFooter);
  } else {
    renderFooter();
  }
}());
