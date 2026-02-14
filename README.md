# Input Multiselect Card

A custom Lovelace card for Home Assistant designed to interact with `input_multiselect` entities. 

By default, Home Assistant does not provide a UI element to select multiple options simultaneously. This card bridges that gap by providing a clean, expandable dropdown menu with checkboxes. It features a modern, rounded design inspired by Bubble Card, making it perfectly suited for mobile-first dashboards.

**⚠️ Important:** This card is just the frontend interface. It requires the backend [Input Multiselect component](https://github.com/portbusy/ha-input-multiselect) to be installed and configured in your Home Assistant instance. It will **not** work with native `input_select` entities.

## Installation

### HACS (Recommended)
This card can be installed via [HACS](https://hacs.xyz/).

1. Go to HACS -> Frontend.
2. Click the three dots in the top right corner and select **Custom repositories**.
3. Paste the URL of this repository and select **Lovelace** as the category.
4. Click Add, search for "Input Multiselect Card", and install it.
5. When prompted, reload your browser resources.

### Manual
1. Download the `input-multiselect-card.js` file from this repository.
2. Copy it into your `config/www/` directory.
3. Go to **Settings** -> **Dashboards** -> **Three dots (top right)** -> **Resources**.
4. Add a new resource with the URL `/local/input-multiselect-card.js` and set the type to **JavaScript Module**.
5. Refresh your browser.

## Configuration

You can configure this card using the Visual Editor or manually via YAML.

### Visual Editor
1. Edit your dashboard and click **Add Card**.
2. Search for **Input Multiselect** in the custom cards section.
3. Select your `input_multiselect` entity from the dropdown.

### YAML Configuration
If you prefer writing YAML, or if you want to embed this inside other cards (like `custom:button-card` or `custom:bubble-card` popups), use the following structure:

```yaml
type: custom:input-multiselect-card
entity: input_multiselect.rooms_to_clean
name: Cleaning Zones
icon: mdi:robot-vacuum