// ── Editor ──────────────────────────────────────────────────────────
class InputMultiselectCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._schema = [
      {
        name: "entity",
        required: true,
        selector: { entity: { domain: "input_multiselect" } },
      },
      {
        name: "name",
        selector: { text: {} },
      },
      {
        name: "icon",
        selector: { icon: {} },
        context: { icon_entity: "entity" },
      },
      {
        name: "auto_submit",
        label: "Auto-Submit (Save instantly when clicking options)",
        selector: { boolean: {} },
      },
      {
        name: "show_chips",
        label: "Show selections as Chips",
        selector: { boolean: {} },
      },
      {
        type: "expandable",
        name: "",
        title: "Interactions",
        flatten: true,
        schema: [
          {
            name: "tap_action",
            label: "Action on Submit",
            selector: { "ui-action": {} },
          },
        ],
      },
    ];
  }

  setConfig(config) {
    this._config = config;
    if (this._form) this._form.data = config;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) {
      this._form.hass = hass;
    } else {
      this._buildForm();
    }
  }

  _buildForm() {
    if (!this._hass || !this._config) return;

    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = this._config;
    form.schema = this._schema;
    form.computeLabel = (s) => s.label || s.name || "";

    form.addEventListener("value-changed", (ev) => {
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: ev.detail.value },
          bubbles: true,
          composed: true,
        })
      );
    });

    this.shadowRoot.innerHTML = "";
    this.shadowRoot.appendChild(form);
    this._form = form;
  }
}
customElements.define("input-multiselect-card-editor", InputMultiselectCardEditor);


// ── Card ────────────────────────────────────────────────────────────
class InputMultiselectCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._isOpen = false;
    this._localSelection = [];
  }

  static getConfigElement() {
    return document.createElement("input-multiselect-card-editor");
  }

  static getStubConfig() {
    return { entity: "", name: "", icon: "", auto_submit: false, show_chips: false, tap_action: { action: "none" } };
  }

  setConfig(config) {
    this.config = config;
  }

  set hass(hass) {
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
    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
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
          max-height: 0; overflow-y: hidden; transition: max-height 0.4s ease;
          display: flex; flex-direction: column; gap: 8px;
        }
        .dropdown.open { 
          max-height: 300px;
          margin-top: 12px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--scrollbar-thumb-color, var(--primary-color)) transparent;
        }
        .dropdown::-webkit-scrollbar { width: 6px; }
        .dropdown::-webkit-scrollbar-track { background: transparent; }
        .dropdown::-webkit-scrollbar-thumb { 
          background-color: var(--scrollbar-thumb-color, var(--primary-color)); 
          border-radius: 4px; 
        }
        .chips-container {
          display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;
        }
        .chip {
          background: var(--primary-color); color: white;
          font-size: 11px; font-weight: bold; border-radius: 12px;
          padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;
        }
        .chip-remove {
          cursor: pointer; opacity: 0.8; font-size: 10px; padding: 2px;
        }
        .chip-remove:hover { opacity: 1; color: #ff5252; }
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

      <ha-card>
        <div class="header" id="toggle">
          <div class="icon-container"><ha-icon id="card-icon"></ha-icon></div>
          <div class="info">
            <div id="card-name" class="name"></div>
            <div id="status" class="state"></div>
            <div id="chips" class="chips-container" style="display: none;"></div>
          </div>
          <ha-icon icon="mdi:chevron-down" class="chevron" id="chev"></ha-icon>
        </div>
        <div class="dropdown" id="drop">
          <div id="list"></div>
          <button id="sub" class="submit-btn" disabled>SUBMIT</button>
        </div>
      </ha-card>
    `;

    // ── Toggle dropdown ──
    this.shadowRoot.getElementById("toggle").onclick = () => {
      this._isOpen = !this._isOpen;
      this.shadowRoot.getElementById("drop").classList.toggle("open", this._isOpen);
      this.shadowRoot.getElementById("chev").classList.toggle("open", this._isOpen);
      if (this._isOpen) this._localSelection = [...this._selectedOptions];
      this._updateUI();
    };

    // ── Submit ──
    this.shadowRoot.getElementById("sub").onclick = () => this._submit();

    // ── Build options list ──
    this._buildOptionList();
  }

  _buildOptionList() {
    const list = this.shadowRoot.getElementById("list");
    list.innerHTML = "";
    this._options.forEach((opt) => {
      const row = document.createElement("div");
      row.className = "option-row";
      row.innerHTML = `<input type="checkbox" data-opt="${opt}"><span>${opt}</span>`;
      row.onclick = (e) => {
        const cb = row.querySelector("input");
        if (e.target.tagName !== "INPUT") cb.checked = !cb.checked;
        this._handleToggle(opt, cb.checked);
      };
      list.appendChild(row);
    });
  }

  _updateUI() {
    // ── Dynamic icon & name ──
    const icon =
      this.config.icon ||
      this._stateObj.attributes.icon ||
      "mdi:format-list-checks";
    const name =
      this.config.name ||
      this._stateObj.attributes.friendly_name ||
      "Multiselect";

    const iconEl = this.shadowRoot.getElementById("card-icon");
    if (iconEl) iconEl.setAttribute("icon", icon);

    const nameEl = this.shadowRoot.getElementById("card-name");
    if (nameEl) nameEl.textContent = name;

    // ── Status vs Chips ──
    const statusEl = this.shadowRoot.getElementById("status");
    const chipsEl = this.shadowRoot.getElementById("chips");
    
    if (this.config.show_chips) {
      if (statusEl) statusEl.style.display = "none";
      if (chipsEl) {
        chipsEl.style.display = "flex";
        chipsEl.innerHTML = ""; // clear old chips
        
        if (this._localSelection.length === 0) {
          chipsEl.innerHTML = `<span class="state" style="font-size:11px;">0 selected</span>`;
        } else {
          // Render chips
          this._localSelection.forEach(opt => {
            const chip = document.createElement("div");
            chip.className = "chip";
            chip.innerHTML = `
              <span>${opt}</span>
              <span class="chip-remove" title="Remove">✕</span>
            `;
            // Handle clicking the '✕' immediately
            chip.querySelector(".chip-remove").onclick = (e) => {
              e.stopPropagation(); // prevent toggling the main accordion dropdown
              this._handleToggle(opt, false);
            };
            chipsEl.appendChild(chip);
          });
        }
      }
    } else {
      if (chipsEl) chipsEl.style.display = "none";
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = this._stateObj.state;
      }
    }

    // ── Rebuild option list if options changed ──
    const checkboxes = this.shadowRoot.querySelectorAll("#list input[data-opt]");
    const currentOpts = Array.from(checkboxes).map((cb) => cb.dataset.opt);
    if (JSON.stringify(currentOpts) !== JSON.stringify(this._options)) {
      this._buildOptionList();
    }

    // ── Check states ──
    this._options.forEach((opt) => {
      const cb = this.shadowRoot.querySelector(`input[data-opt="${opt}"]`);
      if (cb) cb.checked = this._localSelection.includes(opt);
    });

    const subBtn = this.shadowRoot.getElementById("sub");
    if (this.config.auto_submit) {
      subBtn.style.display = "none";
    } else {
      subBtn.style.display = "block";
      const changed =
        JSON.stringify([...this._selectedOptions].sort()) !==
        JSON.stringify([...this._localSelection].sort());
      subBtn.disabled = !changed;
    }
  }

  _handleToggle(opt, isChecked) {
    if (isChecked) {
      if (!this._localSelection.includes(opt)) this._localSelection.push(opt);
    } else {
      this._localSelection = this._localSelection.filter((o) => o !== opt);
    }
    
    this._updateUI();
    
    if (this.config.auto_submit) {
      this._submit(false); // auto-save without closing the dropdown automatically
    }
  }

  _submit(closeDropdown = true) {
    // ── Default action: update the input_multiselect entity ──
    this._hass.callService("input_multiselect", "set_options", {
      entity_id: this.config.entity,
      options: this._localSelection,
    });

    // ── Execute configured tap_action ──
    const tapAction = this.config.tap_action;
    if (tapAction && tapAction.action && tapAction.action !== "none") {
      this._executeAction(tapAction);
    }

    if (closeDropdown) {
      this._isOpen = false;
      this.shadowRoot.getElementById("drop").classList.remove("open");
      this.shadowRoot.getElementById("chev").classList.remove("open");
    }
  }

  _executeAction(actionConfig) {
    switch (actionConfig.action) {
      case "more-info": {
        const entityId = actionConfig.entity || this.config.entity;
        const event = new CustomEvent("hass-more-info", {
          detail: { entityId },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(event);
        break;
      }
      case "navigate":
        if (actionConfig.navigation_path) {
          history.pushState(null, "", actionConfig.navigation_path);
          const navEvent = new CustomEvent("location-changed", {
            bubbles: true,
            composed: true,
          });
          window.dispatchEvent(navEvent);
        }
        break;
      case "url":
        if (actionConfig.url_path) {
          window.open(actionConfig.url_path, "_blank");
        }
        break;
      case "call-service":
      case "perform-action": {
        const [domain, service] = (
          actionConfig.service ||
          actionConfig.perform_action ||
          ""
        ).split(".", 2);
        if (domain && service) {
          this._hass.callService(
            domain,
            service,
            actionConfig.data || actionConfig.service_data || {},
            actionConfig.target || undefined
          );
        }
        break;
      }
      case "toggle":
        this._hass.callService("homeassistant", "toggle", {
          entity_id: actionConfig.entity || this.config.entity,
        });
        break;
      case "assist":
        // Fire the assist event used by HA frontend
        this.dispatchEvent(
          new CustomEvent("hass-start-voice-assistant", {
            bubbles: true,
            composed: true,
          })
        );
        break;
      default:
        break;
    }
  }
}
customElements.define("input-multiselect-card", InputMultiselectCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "input-multiselect-card",
  name: "Input Multiselect",
  description: "Advanced multiselect card with UI action support.",
});