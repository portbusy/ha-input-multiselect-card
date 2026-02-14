class InputMultiselectCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._isOpen = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config || !this.config.entity) return;

    const stateObj = hass.states[this.config.entity];
    if (!stateObj) return;

    this._stateObj = stateObj;
    this._options = stateObj.attributes.options || [];
    this._selectedOptions = stateObj.attributes.selected_options || [];

    if (!this._isRendered) {
      this._render();
      this._isRendered = true;
    } else {
      this._updateState();
    }
  }

  setConfig(config) {
    if (!config.entity || !config.entity.startsWith('input_multiselect.')) {
      throw new Error('Devi specificare una entità input_multiselect valida.');
    }
    this.config = {
      name: config.name || '',
      icon: config.icon || '',
      ...config
    };
  }

  static getStubConfig() {
    return { entity: "input_multiselect.tuo_multiselect" };
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
          transition: max-height 0.3s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .dropdown.open {
          max-height: 500px; 
          margin-top: 12px;
        }
        .option-row {
          display: flex;
          align-items: center;
          background: var(--secondary-background-color);
          padding: 10px 14px;
          border-radius: 12px;
          cursor: pointer;
        }
        .option-row:hover {
          background: var(--divider-color);
        }
        .option-row input[type="checkbox"] {
          margin-right: 12px;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        .option-name {
          font-size: 14px;
          color: var(--primary-text-color);
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
          </div>
      </div>
    `;

    this.shadowRoot.getElementById('toggle-btn').addEventListener('click', () => {
      this._isOpen = !this._isOpen;
      this.shadowRoot.getElementById('dropdown-content').classList.toggle('open', this._isOpen);
      this.shadowRoot.getElementById('chevron-icon').classList.toggle('open', this._isOpen);
    });

    this._updateState();
  }

  _updateState() {
    this.shadowRoot.getElementById('state-text').innerText = this._stateObj.state;

    const dropdown = this.shadowRoot.getElementById('dropdown-content');
    dropdown.innerHTML = ''; // Svuota la lista

    this._options.forEach(option => {
      const isChecked = this._selectedOptions.includes(option);

      const row = document.createElement('div');
      row.className = 'option-row';
      row.innerHTML = `
        <input type="checkbox" id="chk-${option}" ${isChecked ? 'checked' : ''}>
        <span class="option-name">${option}</span>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
            const checkbox = row.querySelector('input');
            checkbox.checked = !checkbox.checked;
        }
        this._toggleOption(option, row.querySelector('input').checked);
      });

      dropdown.appendChild(row);
    });
  }

  _toggleOption(option, isChecked) {
    const action = isChecked ? 'add_options' : 'remove_options';

    this._hass.callService('input_multiselect', action, {
      entity_id: this.config.entity,
      options: [option]
    });
  }
}

customElements.define('input-multiselect-card', InputMultiselectCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "input-multiselect-card",
  name: "Input Multiselect",
  preview: true,
  description: "Una card con checkbox per selezionare più opzioni."
});