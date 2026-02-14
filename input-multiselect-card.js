class InputMultiselectCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass || !this._config || this._rendered) return;

    const schema = [
      { name: "entity", selector: { entity: { domain: "input_multiselect" } } },
      { name: "name", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
      {
        name: "tap_action",
        label: "Action on Submit",
        selector: { ui_action: {} }
      }
    ];

    this.shadowRoot.innerHTML = `
      <ha-form
        .hass=${this._hass}
        .data=${this._config}
        .schema=${schema}
        .computeLabel=${(s) => s.label || s.name}
      ></ha-form>
    `;

    this.shadowRoot.querySelector("ha-form").addEventListener("value-changed", (ev) => {
      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: ev.detail.value },
        bubbles: true,
        composed: true,
      }));
    });
    this._rendered = true;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
}
customElements.define('input-multiselect-card-editor', InputMultiselectCardEditor);


class InputMultiselectCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._isOpen = false;
    this._localSelection = [];
  }

  static getConfigElement() { return document.createElement('input-multiselect-card-editor'); }
  static getStubConfig() { return { entity: "", name: "", icon: "", tap_action: { action: "none" } }; }

  setConfig(config) { this.config = config; }

  set hass(hass) {
    const oldState = this._stateObj;
    this._hass = hass;
    this._stateObj = hass.states[this.config.entity];

    if (!this._stateObj) return;

    this._options = this._stateObj.attributes.options || [];
    this._selectedOptions = this._stateObj.attributes.selected_options || [];

    if (!this._isOpen) {
      this._localSelection = [...this._selectedOptions];
    }

    if (!this._isRendered) {
      this._render();
      this._isRendered = true;
    }
    this._updateUI();
  }

  _render() {
    const icon = this.config.icon || this._stateObj.attributes.icon || 'mdi:format-list-checks';
    const name = this.config.name || this._stateObj.attributes.friendly_name || 'Multiselect';

    this.shadowRoot.innerHTML = `
      <style>
        .card {
          background: var(--ha-card-background, var(--card-background-color, white));
          border-radius: var(--bubble-border-radius, 24px);
          padding: 12px;
          overflow: hidden;
        }
        .header { display: flex; align-items: center; cursor: pointer; user-select: none; }
        .icon-container {
          display: flex; justify-content: center; align-items: center;
          width: 42px; height: 42px; border-radius: 50%;
          background: var(--primary-color); color: white; margin-right: 12px;
        }
        .info { flex: 1; }
        .name { font-weight: 600; font-size: 14px; color: var(--primary-text-color); }
        .state { font-size: 12px; color: var(--secondary-text-color); }
        .chevron { transition: transform 0.3s ease; color: var(--secondary-text-color); }
        .chevron.open { transform: rotate(180deg); }
        .dropdown {
          max-height: 0; overflow: hidden; transition: max-height 0.4s ease;
          display: flex; flex-direction: column; gap: 8px;
        }
        .dropdown.open { max-height: 1000px; margin-top: 12px; }
        .option-row {
          display: flex; align-items: center; background: var(--secondary-background-color);
          padding: 12px; border-radius: 12px; cursor: pointer;
        }
        .option-row input { margin-right: 12px; width: 18px; height: 18px; accent-color: var(--primary-color); }
        .submit-btn {
          background: var(--primary-color); color: white; border: none; border-radius: 12px;
          padding: 14px; margin-top: 8px; font-weight: bold; cursor: pointer;
        }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      </style>

      <div class="card">
        <div class="header" id="toggle">
          <div class="icon-container"><ha-icon icon="${icon}"></ha-icon></div>
          <div class="info">
            <div class="name">${name}</div>
            <div id="status" class="state"></div>
          </div>
          <ha-icon icon="mdi:chevron-down" class="chevron" id="chev"></ha-icon>
        </div>
        <div class="dropdown" id="drop">
          <div id="list"></div>
          <button id="sub" class="submit-btn" disabled>SUBMIT</button>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('toggle').onclick = () => {
      this._isOpen = !this._isOpen;
      this.shadowRoot.getElementById('drop').classList.toggle('open', this._isOpen);
      this.shadowRoot.getElementById('chev').classList.toggle('open', this._isOpen);
      if (this._isOpen) this._localSelection = [...this._selectedOptions];
      this._updateUI();
    };

    this.shadowRoot.getElementById('sub').onclick = () => this._submit();

    const list = this.shadowRoot.getElementById('list');
    this._options.forEach(opt => {
      const row = document.createElement('div');
      row.className = 'option-row';
      row.innerHTML = `<input type="checkbox" id="c-${opt}"><span>${opt}</span>`;
      row.onclick = (e) => {
        const cb = row.querySelector('input');
        if (e.target.tagName !== 'INPUT') cb.checked = !cb.checked;
        this._handleToggle(opt, cb.checked);
      };
      list.appendChild(row);
    });
  }

  _updateUI() {
    this.shadowRoot.getElementById('status').innerText = this._stateObj.state;
    this._options.forEach(opt => {
      const cb = this.shadowRoot.getElementById(`c-${opt}`);
      if (cb) cb.checked = this._localSelection.includes(opt);
    });
    const changed = JSON.stringify([...this._selectedOptions].sort()) !== JSON.stringify([...this._localSelection].sort());
    this.shadowRoot.getElementById('sub').disabled = !changed;
  }

  _handleToggle(opt, isChecked) {
    if (isChecked) { if (!this._localSelection.includes(opt)) this._localSelection.push(opt); }
    else { this._localSelection = this._localSelection.filter(o => o !== opt); }
    this._updateUI();
  }

  _submit() {
    this._hass.callService('input_multiselect', 'set_options', {
      entity_id: this.config.entity,
      options: this._localSelection
    });

    if (this.config.tap_action && this.config.tap_action.action !== "none") {
        // Usiamo il motore interno di HA per gestire l'azione (navigazione, chiamata servizio, ecc)
        const event = new CustomEvent("hass-action", {
            detail: { config: this.config, action: "tap_action" },
            bubbles: true, composed: true
        });
        this.dispatchEvent(event);
    }

    this._isOpen = false;
    this.shadowRoot.getElementById('drop').classList.remove('open');
    this.shadowRoot.getElementById('chev').classList.remove('open');
  }
}
customElements.define('input-multiselect-card', InputMultiselectCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "input-multiselect-card",
  name: "Input Multiselect",
  description: "Advanced multiselect card with UI action support."
});