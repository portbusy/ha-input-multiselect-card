class InputMultiselectCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._render();
      this._rendered = true;
    }
    this.querySelectorAll('ha-entity-picker, ha-icon-picker').forEach(el => el.hass = hass);
  }

  _render() {
    this.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px;">
        <ha-entity-picker 
          id="ep-entity" 
          label="Entity (input_multiselect)*" 
          include-domains='["input_multiselect"]'>
        </ha-entity-picker>
        
        <ha-textfield 
          id="tf-name" 
          label="Custom Name (Optional)">
        </ha-textfield>
        
        <ha-icon-picker 
          id="ip-icon" 
          label="Custom Icon (Optional)">
        </ha-icon-picker>
        
        <ha-entity-picker 
          id="ep-action" 
          label="Action on Submit (Optional Script/Automation)" 
          include-domains='["script", "automation", "scene"]'>
        </ha-entity-picker>
      </div>
    `;

    const epEntity = this.querySelector('#ep-entity');
    epEntity.value = this._config.entity || '';
    epEntity.addEventListener('value-changed', (e) => this._updateConfig('entity', e.detail.value));

    const tfName = this.querySelector('#tf-name');
    tfName.value = this._config.name || '';
    tfName.addEventListener('input', (e) => this._updateConfig('name', e.target.value));

    const ipIcon = this.querySelector('#ip-icon');
    ipIcon.value = this._config.icon || '';
    ipIcon.addEventListener('value-changed', (e) => this._updateConfig('icon', e.detail.value));

    const epAction = this.querySelector('#ep-action');
    epAction.value = this._config.action_entity || '';
    epAction.addEventListener('value-changed', (e) => this._updateConfig('action_entity', e.detail.value));
  }

  _updateConfig(key, value) {
    if (!this._config) return;
    const newConfig = { ...this._config };
    if (value === '' || value === undefined) {
      delete newConfig[key];
    } else {
      newConfig[key] = value;
    }
    this._config = newConfig;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig }, bubbles: true, composed: true }));
  }
}
customElements.define('input-multiselect-card-editor', InputMultiselectCardEditor);


class InputMultiselectCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._isOpen = false;
    this._localSelection = []; // Stato locale per le spunte
    this._isRendered = false;
  }

  static getConfigElement() {
    return document.createElement('input-multiselect-card-editor');
  }

  static getStubConfig() {
    return { entity: "" };
  }

  setConfig(config) {
    if (!config.entity || !config.entity.startsWith('input_multiselect.')) {
      throw new Error('Please select a valid input_multiselect entity.');
    }
    this.config = { ...config };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config || !this.config.entity) return;

    const stateObj = hass.states[this.config.entity];
    if (!stateObj) return;

    this._stateObj = stateObj;
    this._options = stateObj.attributes.options || [];
    this._selectedOptions = stateObj.attributes.selected_options || [];

    if (!this._isOpen) {
      this._localSelection = [...this._selectedOptions];
    }

    // Forza il render totale se le opzioni backend sono cambiate (es. aggiunta una stanza)
    const currentOptionsStr = JSON.stringify(this._options);
    if (this._lastOptionsStr !== currentOptionsStr) {
      this._lastOptionsStr = currentOptionsStr;
      this._isRendered = false;
    }

    if (!this._isRendered) {
      this._render();
      this._isRendered = true;
    }

    this._updateUI();
  }

  _render() {
    const icon = this.config.icon || this._stateObj.attributes.icon || 'mdi:format-list-checks';
    const name = this.config.name || this._stateObj.attributes.friendly_name || this.config.entity;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --bc-background: var(--card-background-color, var(--ha-card-background, #fff));
          --bc-border-radius: var(--bubble-border-radius, 24px);
        }
        .card {
          background: var(--bc-background);
          border-radius: var(--bc-border-radius);
          box-shadow: var(--ha-card-box-shadow, none);
          padding: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .header {
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }
        .icon-container {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          margin-right: 12px;
        }
        .info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .name {
          font-weight: 600;
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .state {
          font-size: 12px;
          color: var(--secondary-text-color);
        }
        .chevron {
          transition: transform 0.3s ease;
          color: var(--secondary-text-color);
        }
        .chevron.open {
          transform: rotate(180deg);
        }
        .dropdown {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.4s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .dropdown.open {
          max-height: 800px;
          margin-top: 12px;
        }
        .option-row {
          display: flex;
          align-items: center;
          background: var(--secondary-background-color);
          padding: 12px 14px;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .option-row:active {
          background: var(--divider-color);
        }
        .option-row input[type="checkbox"] {
          margin-right: 14px;
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--primary-color);
        }
        .option-name {
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .submit-btn {
          background: var(--primary-color);
          color: var(--text-primary-color, #ffffff);
          border: none;
          border-radius: 12px;
          padding: 14px;
          margin-top: 4px;
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .submit-btn:disabled {
          background: var(--disabled-color, #bdbdbd);
          color: rgba(255,255,255, 0.7);
          cursor: not-allowed;
          opacity: 0.6;
        }
      </style>

      <div class="card">
        <div class="header" id="toggle-btn">
          <div class="icon-container">
            <ha-icon icon="${icon}"></ha-icon>
          </div>
          <div class="info">
            <div class="name">${name}</div>
            <div class="state" id="state-text">${this._stateObj.state}</div>
          </div>
          <ha-icon icon="mdi:chevron-down" class="chevron" id="chevron-icon"></ha-icon>
        </div>
        
        <div class="dropdown" id="dropdown-content">
          <div id="options-container" style="display: flex; flex-direction: column; gap: 8px;"></div>
          <button id="submit-btn" class="submit-btn" disabled>Submit</button>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('toggle-btn').addEventListener('click', () => {
      this._isOpen = !this._isOpen;

      if (this._isOpen) {
        this._localSelection = [...this._selectedOptions];
        this._updateUI();
      }

      this.shadowRoot.getElementById('dropdown-content').classList.toggle('open', this._isOpen);
      this.shadowRoot.getElementById('chevron-icon').classList.toggle('open', this._isOpen);
    });

    this.shadowRoot.getElementById('submit-btn').addEventListener('click', () => this._submit());

    const container = this.shadowRoot.getElementById('options-container');
    this._options.forEach(option => {
      const row = document.createElement('div');
      row.className = 'option-row';
      row.innerHTML = `
        <input type="checkbox" id="chk-${option}">
        <span class="option-name">${option}</span>
      `;

      row.addEventListener('click', (e) => {
        const checkbox = row.querySelector('input');
        if (e.target.tagName !== 'INPUT') {
          checkbox.checked = !checkbox.checked;
        }
        this._handleToggle(option, checkbox.checked);
      });

      container.appendChild(row);
    });
  }

  _updateUI() {
    if (!this.shadowRoot.getElementById('state-text')) return;

    this.shadowRoot.getElementById('state-text').innerText = this._stateObj.state;

    this._options.forEach(option => {
      const chk = this.shadowRoot.getElementById(`chk-${option}`);
      if (chk) {
        chk.checked = this._localSelection.includes(option);
      }
    });

    this._evaluateSubmitButton();
  }

  _handleToggle(option, isChecked) {
    if (isChecked) {
      if (!this._localSelection.includes(option)) this._localSelection.push(option);
    } else {
      this._localSelection = this._localSelection.filter(o => o !== option);
    }
    this._evaluateSubmitButton();
  }

  _evaluateSubmitButton() {
    const sortedOriginal = [...this._selectedOptions].sort();
    const sortedLocal = [...this._localSelection].sort();

    const isDifferent = JSON.stringify(sortedOriginal) !== JSON.stringify(sortedLocal);

    const btn = this.shadowRoot.getElementById('submit-btn');
    if (btn) btn.disabled = !isDifferent;
  }

  _submit() {
    this._hass.callService('input_multiselect', 'set_options', {
      entity_id: this.config.entity,
      options: this._localSelection
    });

    if (this.config.action_entity) {
      const domain = this.config.action_entity.split('.')[0];
      if (domain === 'script') {
        this._hass.callService('script', this.config.action_entity.split('.')[1]);
      } else if (domain === 'automation') {
        this._hass.callService('automation', 'trigger', { entity_id: this.config.action_entity });
      } else {
        this._hass.callService('homeassistant', 'turn_on', { entity_id: this.config.action_entity });
      }
    }

    this._isOpen = false;
    this.shadowRoot.getElementById('dropdown-content').classList.remove('open');
    this.shadowRoot.getElementById('chevron-icon').classList.remove('open');
    this.shadowRoot.getElementById('submit-btn').disabled = true;
  }
}

customElements.define('input-multiselect-card', InputMultiselectCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "input-multiselect-card",
  name: "Input Multiselect",
  preview: true,
  description: "A dropdown card with multiple checkboxes."
});