# Andy Sensor Card — Documentation

This document describes **all symbols** and the **configuration fields** available in **Andy Sensor Card*.

> Tip: The card supports numeric sensors, but also *switch/binary* entities.  
> `on/true = 1` and `off/false = 0` can be useful for “open/closed” style visuals. :contentReference[oaicite:1]{index=1}

---
## ☕ Support the project 
I’m a Home Automation enthusiast who spends way too many late nights building custom cards, dashboards and small tools for Home Assistant.
I love creating clean, useful UI components and sharing them for free with the community, and I try to help others whenever I can with ideas, code and support.
If you enjoy my work or use any of my cards in your setup, your support means a lot and helps me keep experimenting, improving and maintaining everything.

<a href="https://www.buymeacoffee.com/AndyBonde" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="160">
</a>


---
## Common configuration (applies to all symbols)

### Core fields
- `entity` *(string, required)*  
  Main entity for the card.

- `name` *(string)*  
  Card title.

- `symbol` *(string)*  
  Selects what the card renders. Supported values:  
  `battery_liquid`, `battery_segments`, `battery_splitted_segments`, `water_level_segments`, `silo`, `tank`, `ibc_tank`, `gas_cylinder`, `fan`, `heatpump`, `garage_door`, `blind`, `gate`, `image`. :contentReference[oaicite:2]{index=2}

- `industrial_look` *(boolean)*  
  Enables “industrial/modern” styling for supported symbols.  
  Supported for: batteries + water level + tanks (`ibc_tank`, `tank`, `silo`, `gas_cylinder`).  
  Not used for: `fan`, `heatpump`, `garage_door`, `blind`, `gate`. :contentReference[oaicite:3]{index=3}

### Value and scaling
- `min` *(number, default 0)*  
- `max` *(number, default 100)*  
  Used to map entity state into a 0–100% (or min–max) visual fill/position.

- `unit` *(string)*  
  Optional unit string.

- `decimals` *(number)*  
  Number of decimals used for formatting.

### Layout / look & feel
- `orientation` *(string: `vertical` | `horizontal`)*  
  Controls the direction for symbols that support it.

- `glass` *(boolean)*  
  Enables “glass” overlay look for supported symbols.

- `value_position` *(string)*  
  Controls where the value is shown (example: `top_right`). :contentReference[oaicite:4]{index=4}

- `value_font_size` *(number)*  
  0 = auto, otherwise fixed size.

- `outline_value` *(boolean)*  
  Adds outline for better contrast.

### Card sizing
- `card_scale` *(number)*  
- `card_width` *(string; css size like `320px`, `100%`)*  
- `card_height` *(string; css size like `180px`)* :contentReference[oaicite:5]{index=5}

### Intervals and Badges (global)
- `intervals` *(array)*  
  Controls colors/gradients and special behaviors for several symbols. See **Intervals**. :contentReference[oaicite:6]{index=6}

- `badges` *(array)*  
  Draggable overlay elements placed freely inside the card. See **Badges**. :contentReference[oaicite:7]{index=7}

### Template variables for labels (Badges + interval override text)
You can write your own text mixed with variables (placeholders), for example:  
`Temperature: <value>`

Supported variables:
- `<value>` formatted value (incl unit)
- `<state>` raw state
- `<name>` friendly name
- `<unit>` unit
- `<entity_id>` entity id
- `<domain>` entity domain
- `<last_changed>`, `<last_updated>` local time
- `<last_changed_rel>`, `<last_updated_rel>` relative time
- `<last_changed_iso>`, `<last_updated_iso>` ISO time
- `<attr:xxx>` any attribute, e.g. `<attr:temperature>` :contentReference[oaicite:8]{index=8}

---

## Batteries

This section covers:
- `battery_liquid`
- `battery_segments`
- `battery_splitted_segments`

Related shared fields (battery + split battery):
- `charging_state_entity` *(string)*  
- `charging_power_entity` *(string)*  
- `charging_state_entity2` *(string)*  
- `charging_power_entity2` *(string)*  
Used to display/animate “charging” state (split symbol can do this per side). :contentReference[oaicite:9]{index=9}

### battery_liquid
A liquid-style battery fill.

**Key fields**
- `min`, `max` – maps state to fill level.
- `industrial_look` – enables modern casing style for supported variants. 
- `glass` – glass overlay.

**Intervals**
- Typically used to control fill color and outline by level (see Intervals).

### battery_segments
A segmented battery with discrete “blocks”.

**Key fields**
- `segment_gap` *(number)*  
  Gap between blocks (SVG units). :contentReference[oaicite:11]{index=11}
- `min`, `max`, `decimals`

**Behavior**
- Each segment becomes on/off based on current percent, and can animate if “charging” is active. :contentReference[oaicite:12]{index=12}

### battery_splitted_segments
Two-entity split battery (left/right).

**Key fields**
- `entity` – left side
- `entity2` – right side
- `segment_gap` *(number)*  
- `show_split_entity_names` *(boolean)*  
  Optional: show labels/names for the split sides. :contentReference[oaicite:13]{index=13}
- Charging entities: `charging_state_entity`, `charging_power_entity`, plus the `...2` variants for the second side. :contentReference[oaicite:14]{index=14}

**Intervals**
- Used for block colors/gradients per level, just like other segment symbols.

---

## Tanks

This section covers:
- `tank`
- `ibc_tank`
- `silo`
- `gas_cylinder`
- (Plus the “tank-like” level symbol) `water_level_segments`

All these symbols support:
- `min`, `max`

### tank
Classic storage tank level.

**Key fields**
- `min`, `max` – maps entity state to fill height.


### ibc_tank
IBC container (bulk tank) level.

**Key fields**
- `min`, `max`

### silo
Vertical silo level.

**Key fields**
- `min`, `max`

### gas_cylinder
Gas cylinder level.

**Key fields**
- `min`, `max`

### water_level_segments
Segmented fill specifically for “level”.

**Key fields**
- `segment_gap` *(number)* – spacing between segments. :contentReference[oaicite:20]{index=20}
- You decide the color and segment quantity by using intervals on main card.

---

## Garage Door

Symbol: `garage_door`

Renders a garage door that opens/closes based on entity value.

### Fields
- `garage_door_type` *(string: `single` | `double`)*  
  Single door or double door setup. 

- `garage_door_width` *(number)*  
  Door width (clamped internally). 

- `garage_door_gap` *(number)*  
  Gap between doors when `double`. 

- `garage_door_entity2` *(string)*  
  Optional second door entity (used when `double`). 

- `garage_door_lamp_entity` *(string)*  
  Optional “inside lamp” entity for door 1 (controls interior light effect). 

- `garage_door_lamp_entity2` *(string)*  
  Optional “inside lamp” entity for door 2 (double mode). 

### How opening is calculated
- The door position is mapped from the main entity state using `min`/`max` into a percentage (0–100%).  
- With `double`, door1 uses `entity` and door2 uses `garage_door_entity2`.

### Intervals for garage_door
Intervals are used to create panel blocks/segments across the door (and may be used for smooth animation behavior depending on your interval setup). :contentReference[oaicite:28]{index=28}

---

## Blinds

Symbol: `blind`

This is a window blind that reuses the garage door engine/config structure. :contentReference[oaicite:29]{index=29}

### Fields
Blind uses the *same* sizing/double/lamp fields as `garage_door`:
- `garage_door_type` (`single` | `double`)
- `garage_door_width`
- `garage_door_gap`
- `garage_door_entity2`
- `garage_door_lamp_entity`
- `garage_door_lamp_entity2` 

Additionally:
- `blind_style` *(string: `persienne` | `lamella`)*  
  Changes blind rendering style. 

### Intervals for blind
Intervals are used to build visual “panels/segments” and can also affect the look through gradients. :contentReference[oaicite:32]{index=32}

---

## Fan

Symbol: `fan`

Renders a fan. The fan speed/visual intensity is based on the main entity value mapped using `min/max`.

### Fields
- `fan_blade_count` *(integer, 2–8)*  
  Number of fan blades. Used by `fan` and `heatpump`. 

- `fan_show_frame` *(boolean)*  
  Fan-only option to show casing/frame. :contentReference[oaicite:34]{index=34}

### Typical usage
- If you use a percentage sensor, set `min: 0`, `max: 100`.
- If you use a fan entity with discrete speeds, consider converting to a numeric helper/sensor so the visual matches the real output.

---

## Heatpump

Symbol: `heatpump`

Renders a heatpump-style badge/symbol with fan blades (also uses `fan_blade_count`). 

### Fields
- `fan_blade_count` *(integer, 2–8)*  
  Same as Fan. :contentReference[oaicite:36]{index=36}

### Notes
- `industrial_look` does not apply to `heatpump`. :contentReference[oaicite:37]{index=37}

---

## Image

Symbol: `image`

Lets you show an image either from URL/path or from HA Media (if configured).

### Fields
- `image_source` *(string: `url` | `media`)*  
  Selects where image comes from. 

- `image_url` *(string)*  
  Used when `image_source: url`. :contentReference[oaicite:39]{index=39}

- `image_media` *(string)*  
  Used when `image_source: media` (a media_content_id). :contentReference[oaicite:40]{index=40}

- `image_fit` *(string: `cover` | `contain`)*  
  Fit mode. :contentReference[oaicite:41]{index=41}

- `image_full_card` *(boolean)*  
  If enabled, the image becomes a full card background. :contentReference[oaicite:42]{index=42}

- `image_opacity` *(number 0–1)*  
  Controls image opacity. :contentReference[oaicite:43]{index=43}

- `image_radius` *(number)*  
  Rounds corners. :contentReference[oaicite:44]{index=44}

#### Frame
- `image_frame` *(boolean)*  
- `image_frame_color` *(string)*  
- `image_frame_width` *(number)* :contentReference[oaicite:45]{index=45}

#### Tint overlay
- `image_tint` *(boolean)*  
- `image_tint_color` *(string)*  
- `image_tint_opacity` *(number 0–1)* :contentReference[oaicite:46]{index=46}

#### Dim when entity is off
- `image_dim_off` *(boolean)*  
- `image_dim_off_opacity` *(number 0–1)* 

---

## Badges

Badges are draggable overlay items placed freely inside the card.  
They can show:
- icon or image
- text label (with templates)
- optional slider
- individual tap-action (including call-service)

### Badge object (per item in `badges:`)
Each badge is an object with these key groups:

#### Position and identity
- `x` *(number)*, `y` *(number)*  
  Position in the card (dragging updates these).

- `entity` *(string)*  
  Entity for this badge (can be different from main `entity`).

- `title` *(string)*  
  Optional title/tooltip.

#### Label (supports templates)
- `label` *(string)*  
  Text shown under/near the badge. Supports variables like `<value>`, `<name>`, etc. :contentReference[oaicite:48]{index=48}

#### Icon / image
- `icon` *(string: mdi:...)*  
  Icon shown if image is not used.

- `use_image` *(boolean)*  
  Use image instead of icon (badge image mode).

- `img_source` *(string)*, `img_url` *(string)*, `img_media` *(string)*  
  Image selection for the badge.

- `img_fit` *(string: `cover` | `contain`)*  
  Fit mode for badge image.

- `img_tint` / `img_tint_color` / `img_tint_opacity`  
  Optional tint overlay for badge image.

- `img_frame` / `img_frame_color` / `img_frame_width`
  Optional frame.

- `img_dim_when_off` / `img_dim_when_off_opacity`
  Optional dimming when badge entity is off. :contentReference[oaicite:49]{index=49}

#### Slider (optional)
Badges can optionally show a slider control.

- `show_slider` *(boolean)*  
  Enables slider. (Older configs may have used `style: slider`, which is still accepted as fallback.) :contentReference[oaicite:50]{index=50}

- `slider_min` *(number | null)*  
- `slider_max` *(number | null)*  
- `slider_step` *(number | null)*  
  If null/empty, the card will attempt to use sensible defaults. 

- `slider_orientation` *(string: `horizontal` | `vertical`)* 
- `slider_update` *(string: `release` | `live`)*  
  `release`: update when user releases thumb  
  `live`: update while dragging 

- `slider_show_value` *(boolean)*  
  Show numeric value next to the slider. 

- `slider_length` *(number | null)*  
- `slider_thickness` *(number | null)*  
- `slider_thumb_size` *(number | null)*  
- `slider_thumb_radius` *(number | null)*  
- `slider_track_radius` *(number | null)*  
- `slider_thumb_color` *(string)*  
- `slider_track_color` *(string)* 

#### Tap action (per badge)
Each badge can have its own action:
- `tap_action.action` *(string)*  
  `more-info`, `toggle`, `call-service`, `none` 

- `tap_action.service` *(string)*  
  Example: `light.turn_on`

- `tap_action.service_data` *(object | string | null)*  
  JSON payload for the service call. :contentReference[oaicite:57]{index=57}

#### Badge intervals (optional per badge)
Badges can have their own interval list. See **Intervals**.  
Additionally badge intervals can override:
- `new_value` (replace what `<value>` expands to)
- `icon` (temporary icon override)
- `icon_color` (temporary icon color) :contentReference[oaicite:58]{index=58}

---

## Intervals

Intervals are the card’s “rule engine” for colors, gradients, outlines, and some animation behaviors.

They exist in:
- `intervals` on the main card
- `intervals` inside a badge (badge-specific overrides)

### Interval object
Common fields:
- `to` *(number)*  
  Upper threshold for the interval.

- `color` *(string)*  
  Fill color for the interval.

- `outline` *(string)*  
  Outline/stroke color for the interval.

- `gradient` *(object)*
  - `gradient.enabled` *(boolean)*
  - `gradient.from` *(string)*
  - `gradient.to` *(string)*

### Badge-only interval overrides
These fields are especially useful for badges:
- `new_value` *(string)*  
  Overrides the value that `<value>` expands to while this interval is active.  
  Supports templates/variables. 

- `icon` *(string)*  
  Overrides badge icon while interval is active. :contentReference[oaicite:60]{index=60}

- `icon_color` *(string)*  
  Overrides badge icon color while interval is active. :contentReference[oaicite:61]{index=61}

### How intervals are used by different symbols
- **Batteries / Water level / Tanks:**  
  Intervals define fill colors and optionally gradients.

- **Garage door / Blind:**  
  Intervals are used to build panel blocks/segments (each interval becomes a solid/gradient section). :contentReference[oaicite:62]{index=62}

---

# End of documentation
