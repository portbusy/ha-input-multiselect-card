class InputMultiselectCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    this._hass = hass;
    if (this._hass && this._config) {
      this._render();
    }
  }

  _render() {
    if (this._rendered) {
      this._updateValues();
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        .container { display: flex; flex-direction: column; gap: 16px; padding: 12px 0; }
        ha-textfield, ha-entity-picker, ha-icon-picker { display: block; width: 100%; }
      </style>
      <div class="container">
        <ha-entity-picker 
          id="entity" 
          label="Entity (input_multiselect)" 
          .hass=${this._hass} 
          .value=${this._config.entity || ''} 
          .includeDomains=${['input_multiselect']}
          allow-custom-entity>
        </ha-entity-picker>
        
        <ha-textfield 
          id="name" 
          label="Custom Name (Optional)" 
          .value=${this._config.name || ''}>
        </ha-textfield>
        
        <ha-icon-picker 
          id="icon" 
          label="Custom Icon (Optional)" 
          .hass=${this._hass} 
          .value=${this._config.icon || ''}>
        </ha-icon-picker>
        
        <ha-entity-picker 
          id="action_entity" 
          label="Action on Submit (Optional Script/Automation)" 
          .hass=${this._hass} 
          .value=${this._config.action_entity || ''} 
          .includeDomains=${['script', 'automation', 'scene', 'switch', 'light']}>
        </ha-entity-picker>
      </div>
    `;

    this._rendered = true;
    this.shadowRoot.addEventListener('value-changed', (ev) => this._handleChanged(ev));
    this.shadowRoot.addEventListener('input', (ev) => this._handleChanged(ev));
  }

  _updateValues() {
    const entityPicker = this.shadowRoot.getElementById('entity');
    if (entityPicker) {
      entityPicker.hass = this._hass;
      entityPicker.value = this._config.entity || '';
    }
    const actionPicker = this.shadowRoot.getElementById('action_entity');
    if (actionPicker) {
      actionPicker.hass = this._hass;
      actionPicker.value = this._config.action_entity || '';
    }
    const iconPicker = this.shadowRoot.getElementById('icon');
    if (iconPicker) {
      iconPicker.hass = this._hass;
      iconPicker.value = this._config.icon || '';
    }
    const nameField = this.shadowRoot.getElementById('name');
    if (nameField) {
      nameField.value = this._config.name || '';
    }
  }

  _handleChanged(ev) {
    if (!this._config || !this._hass) return;

    const target = ev.target;
    const id = target.id;
    const value = ev.detail?.value !== undefined ? ev.detail.value : target.value;

    if (this._config[id] === value) return;

    const newConfig = { ...this._config };
    if (!value) {
      delete newConfig[id];
    } else {
      newConfig[id] = value;
    }

    this._config = newConfig;

    const event = new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}
customElements.define('input-multiselect-card-editor', InputMultiselectCardEditor);

class InputMultiselectCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._isOpen = false;
    this._localSelection = [];
    this._isRendered = false;
  }

  static getConfigElement() {
    return document.createElement('input-multiselect-card-editor');
  }

  static getStubConfig() {
    return {
        entity: "",
        name: "",
        icon: ""
    };
  }

  setConfig(config) {
    this.config = { ...config };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config?.entity) return;

    const stateObj = hass.states[this.config.entity];
    if (!stateObj) return;

    this._stateObj = stateObj;
    this._options = stateObj.attributes.options || [];
    this._selectedOptions = stateObj.attributes.selected_options || [];

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
        :host { display: block; }
        .card {
          background: var(--ha-card-background, var(--card-background-color, white));
          border-radius: var(--bubble-border-radius, 24px);
          padding: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .header { display: flex; align-items: center; cursor: pointer; user-select: none; }
        .icon-container {
          display: flex; justify-content: center; align-items: center;
          width: 42px; height: 42px; border-radius: 50%;
          background: var(--primary-color); color: white; margin-right: 12px;
        }
        .info { flex: 1; display: flex; flex-direction: column; }
        .name { font-weight: 600; font-size: 14px; color: var(--primary-text-color); }
        .state { font-size: 12px; color: var(--secondary-text-color); }
        .chevron { transition: transform 0.3s ease; color: var(--secondary-text-color); }
        .chevron.open { transform: rotate(180deg); }
        .dropdown {
          max-height: 0; overflow: hidden; transition: max-height 0.4s ease;
          display: flex; flex-direction: column; gap: 8px;
        }
        .dropdown.open { max-height: 800px; margin-top: 12px; }
        .option-row {
          display: flex; align-items: center; background: var(--secondary-background-color);
          padding: 12px 14px; border-radius: 12px; cursor: pointer;
        }
        .option-row input[type="checkbox"] { margin-right: 14px; width: 18px; height: 18px; accent-color: var(--primary-color); }
        .submit-btn {
          background: var(--primary-color); color: white; border: none; border-radius: 12px;
          padding: 14px; margin-top: 4px; font-size: 14px; font-weight: bold;
          text-transform: uppercase; cursor: pointer; transition: all 0.2s ease;
        }
        .submit-btn:disabled { background: var(--disabled-color, #bdbdbd); opacity: 0.6; cursor: not-allowed; }
      </style>

      <div class="card">
        <div class="header" id="toggle-btn">
          <div class="icon-container"><ha-icon icon="${icon}"></ha-icon></div>
          <div class="info">
            <div class="name">${name}</div>
            <div id="state-text" class="state"></div>
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
      if (this._isOpen) this._localSelection = [...this._selectedOptions];
      this.shadowRoot.getElementById('dropdown-content').classList.toggle('open', this._isOpen);
      this.shadowRoot.getElementById('chevron-icon').classList.toggle('open', this._isOpen);
      this._updateUI();
    });

    this.shadowRoot.getElementById('submit-btn').addEventListener('click', () => this._submit());
    this._createOptionRows();
  }

  _createOptionRows() {
    const container = this.shadowRoot.getElementById('options-container');
    container.innerHTML = '';
    this._options.forEach(option => {
      const row = document.createElement('div');
      row.className = 'option-row';
      row.innerHTML = `<input type="checkbox" id="chk-${option}"><span class="option-name">${option}</span>`;
      row.addEventListener('click', (e) => {
        const chk = row.querySelector('input');
        if (e.target.tagName !== 'INPUT') chk.checked = !chk.checked;
        this._handleToggle(option, chk.checked);
      });
      container.appendChild(row);
    });
  }

  _updateUI() {
    const stateText = this.shadowRoot.getElementById('state-text');
    if (stateText) stateText.innerText = this._stateObj.state;

    this._options.forEach(option => {
      const chk = this.shadowRoot.getElementById(`chk-${option}`);
      if (chk) chk.checked = this._localSelection.includes(option);
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
    const isDifferent = JSON.stringify([...this._selectedOptions].sort()) !== JSON.stringify([...this._localSelection].sort());
    const btn = this.shadowRoot.getElementById('submit-btn');
    if (btn) btn.disabled = !isDifferent;
  }

  _submit() {
    this._hass.callService('input_multiselect', 'set_options', {
      entity_id: this.config.entity,
      options: this._localSelection
    });

    if (this.config.action_entity) {
        const [domain, service] = this.config.action_entity.split('.');
        const srv = domain === 'automation' ? 'trigger' : (domain === 'script' ? service : 'turn_on');
        this._hass.callService(domain === 'script' ? 'script' : (domain === 'automation' ? 'automation' : 'homeassistant'), srv, { entity_id: this.config.action_entity });
    }

    this._isOpen = false;
    this.shadowRoot.getElementById('dropdown-content').classList.remove('open');
    this.shadowRoot.getElementById('chevron-icon').classList.remove('open');
  }
}
customElements.define('input-multiselect-card', InputMultiselectCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "input-multiselect-card",
  name: "Input Multiselect",
  preview: true,
  description: "A dropdown card with checkboxes for multiselect entities."
});