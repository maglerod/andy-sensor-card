# Andy Sensor Card — Documentation

This guide explains every symbol and every setting in **Andy Sensor Card** in a beginner-friendly way.

Important note:  
This documentation uses the **exact field titles you see in the Visual Editor**.  
For advanced users, the internal config key is shown in small text like: *(config key: `...`)*.

If the card feels “very flexible” at first — that’s normal.  
You can start simple (just pick `entity` + `symbol`) and then add power features later:
- **Intervals** (rules for colors, segments/panels, and state matching)
- **Badges** (movable widgets with actions, images, and sliders)


---
## ☕ Support the project 
I’m a Home Automation enthusiast who spends way too many late nights building custom cards, dashboards and small tools for Home Assistant.
I love creating clean, useful UI components and sharing them for free with the community, and I try to help others whenever I can with ideas, code and support.
If you enjoy my work or use any of my cards in your setup, your support means a lot and helps me keep experimenting, improving and maintaining everything.

<a href="https://www.buymeacoffee.com/AndyBonde" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="160">
</a>

---

## Quick concepts (read once)

### What is an Entity?
In Home Assistant, everything is an entity — sensors, lights, covers, switches, etc.
Examples:
- `sensor.phone_battery`
- `cover.garage_door`
- `light.kitchen`

The card reads the entity and turns it into a visual symbol.

### Why Min/Max matters
Some entities are already 0–100 (battery %).  
Others are not (liters, kW, cm...).  
Min/Max tells the card what should count as “empty” and “full”.

### What are Intervals?
Intervals are the card’s rule system. They can:

1) Change colors / gradients / outlines based on numeric values  
2) Match exact states (text) like `on/off`, `open/closed`, etc.  
3) Define how many segments/panels some symbols should have (battery segments, garage door panels, blinds sections)

Intervals exist in two places and they are **separate**:
- **Main card Intervals**: affects the main symbol only
- **Badge Intervals**: affects only that badge (similar concept, separate list)

### What are Badges?
Badges are movable widgets placed anywhere on the card:
- show values
- show icons or images
- show sliders
- run actions on tap (toggle / more-info / call-service)

---

## Common configuration (applies to all symbols)

Below are the main settings you will see in the Visual Editor.

### Main Entity
#### **Main Entity** *(config key: `entity`)*
This is the main entity the card reads.  
Pick the entity that represents what you want the card to show.

Examples:
- `sensor.ev_battery`
- `sensor.tank_liters`
- `cover.garage_door`

---

### Symbol selection
#### **Symbol** *(config key: `symbol`)*
Selects what the card draws.

Symbols in v1.0.0:
- Batteries: `battery_liquid`, `battery_segments`, `battery_splitted_segments`
- Containers/levels: `water_level_segments`, `tank`, `ibc_tank`, `silo`, `gas_cylinder`
- Mechanics: `garage_door`, `blind`, `gate`
- Other: `fan`, `heatpump`, `image`

---

### Naming & text placement
#### **Name** *(config key: `name`)*
Optional title shown on the card. Use this if your dashboard needs a clearer label.

#### **Name position** *(config key: `name_position`)*
Where the Name/title should appear on the card.

#### **Value position** *(config key: `value_position`)*
Where the main value text should appear.

#### **Value font size (px) — 0 = auto** *(config key: `value_font_size`)*
Controls how large the value text is.
- Use `0` to let the card automatically choose a good size (recommended)
- Set a number to force a fixed size (useful for dashboards viewed from far away)

---

### Value formatting & scaling
#### **Unit (optional)** *(config key: `unit`)*
Optional unit override (for example `%`, `L`, `kWh`).  
Tip: Home Assistant usually provides the unit automatically.

#### **Decimals** *(config key: `decimals`)*
How many decimal digits to show.
- 0 = whole numbers (best for battery %)
- 1–2 = useful for temperature, voltage, etc.

#### **Min (scale)** *(config key: `min`)*
Defines what the card should treat as “0% / empty / fully closed”.

Examples:
- Tank liters 0–3000 → Min = 0
- Temperature -20..40 → Min = -20

#### **Max (scale)** *(config key: `max`)*
Defines what the card should treat as “100% / full / fully open”.

Examples:
- Tank liters 0–3000 → Max = 3000

---

### Card size & zoom
#### **Card scale (0.2–4.0) — 1 = default** *(config key: `card_scale`)*
Scales the entire content (a quick “zoom”).
- 1.0 = default
- 0.9 = slightly smaller
- 1.2 = larger

#### **Card width (optional, e.g. 180px)** *(config key: `card_width`)*
Forces a width. Use only if you need the card to fit perfectly in a grid.

#### **Card height (optional, e.g. 220px)** *(config key: `card_height`)*
Forces a height. Very useful for image tiles.

---

### Visual style toggles
#### **Modern look** *(config key: `industrial_look`)*
Enables a modern/industrial casing style for supported symbols (mainly batteries and tanks).

#### **Glass effect** *(config key: `glass`)*
Adds a glossy/glass overlay on supported symbols.

#### **Outline value** *(config key: `outline_value`)*
Adds an outline around the value text to improve readability (highly recommended on image backgrounds).

---

### Extra display options
#### **Show scale (ticks)** *(config key: `show_scale`)*
Shows scale marks (useful for level/tank style symbols).

#### **Min/Avg/Max position** *(config key: `stats_position`)*
Where the min/avg/max (history) text should appear.

#### **Show Min/Avg/Max (history)** *(config key: `show_stats`)*
Shows min/avg/max history summary if enabled in your card build.

#### **Stats lookback hours** *(config key: `stats_hours`)*
How many hours back the min/avg/max calculation should use.

---

### Orientation
#### **Orientation** *(config key: `orientation`)*
Controls vertical/horizontal orientation for symbols that support it.

---

### Tap action (main entity)
#### **Tap action (main entity)** *(config key: `tap_action`)*
What happens when you tap the card background (the main symbol area):
- `more-info` (recommended) opens entity details
- `toggle` toggles entity on/off (if supported)
- `none` disables tapping

---

### Templates (placeholders in text)
Some fields support variables like `<value>` and `<name>`.

Common placeholders:
- `<value>` formatted value (includes unit)
- `<state>` raw state
- `<name>` friendly name
- `<unit>` unit
- `<entity_id>` entity id
- `<domain>` domain (sensor/light/cover…)
- `<last_changed_rel>` “2 min ago”
- `<attr:xyz>` any attribute (example: `<attr:power>`)

---

# Batteries
<a id="batteries"></a>

This section covers:
- `battery_liquid`
- `battery_segments`
- `battery_splitted_segments`

## Battery Segments — what it is and why it’s powerful
Battery Segments is designed to show battery status in a clean “status bar” style.

Great for:
- EV battery
- phone + watch in one symbol (splitted)
- UPS battery
- solar storage battery

### Single vs Splitted
- **battery_segments** = one entity
- **battery_splitted_segments** = two entities in one symbol (left + right)

#### **Second Entity splitted symbol (Battery)** *(config key: `entity2`)*
Only used for `battery_splitted_segments`.
Example use-cases:
- EV1 + EV2
- Phone + Watch

#### **Show entity names (split battery)** *(config key: `show_split_entity_names`)*
Shows labels for both sides so users don’t confuse left vs right.

---

## Battery charging animation (optional)
You can connect extra entities to show charging behavior.

#### **Main Entity - Charging state entity (on/off) to show charging animation** *(config key: `charging_state_entity`)*
Use a binary/on-off entity that tells if the device is charging.

Examples:
- `binary_sensor.phone_charging`
- `sensor.ev_charge_state` (if it outputs `on/off` or similar)

#### **Main Entity - Charging power entity** *(config key: `charging_power_entity`)*
Optional power sensor (W/kW) to show charging intensity.

Split right side equivalents:
- `charging_state_entity2`
- `charging_power_entity2`

---

## Segments & Intervals (important!)
Battery Segments is a segmented symbol, and **Intervals can also define how many segments exist**.

In other words:
- Intervals are not only colors — they can also act like “segment steps”.

Also, the editor includes:

#### **Gap between segments (0–40)** *(config key: `segment_gap`)*
Controls the spacing between segments.
- Set to 0 for a tight, solid look
- Increase for clearer separation

#### **Scale color mode** *(config key: `scale_color_mode`)*
Controls whether the battery segments use:
- the active interval color, or
- per-segment colors

(Recommended wording for users:  
**“Active interval color”** vs **“Per segment colors”**)

---

## Battery Liquid — what it is
Battery Liquid fills the entire battery smoothly based on charge level.
It also supports charging animation using the same charging fields described above.

---

# Tanks
<a id="tanks"></a>

Covers:
- `tank`
- `ibc_tank`
- `silo`
- `gas_cylinder`
- `water_level_segments`

## Beginner setup steps
1) Choose the symbol you want (tank/IBC/silo/gas cylinder/water level)
2) Set **Min (scale)** and **Max (scale)** so the fill is correct
3) Add Intervals for colors (low=red, mid=yellow, high=green)

## Water Level Segments
`water_level_segments` is segmented, and Intervals can influence how many visible segments it has (depending on your interval setup).

---

# Garage Door
<a id="garage-door"></a>

Symbol: `garage_door`

## What it’s for
Garage Door visually shows whether your garage is open or closed, and can be configured to feel like a real door with multiple panels.

## I have two entities to control my garage port. One for open / close state and one for controlling the open / close action.
Many gates, garage doors and blinds are monitored by a contact (magnet) sensor that only reports whether something is open/closed.
However, the actual movement (open/close) is often triggered by a script, a cover entity, a switch, or another service call.
**Andy Sensor Card** supports this setup by letting you:
- Use the sensor for the visual state / animation
- Use a Tap action to trigger the real open/close command

**Recommended configuration**

**1) Main entity = your contact sensor (state)**
Set the card’s Main entity to the magnet/contact sensor, for example:
- binary_sensor.garage_contact
- binary_sensor.gate_open_sensor
- binary_sensor.blinds_closed_contact

This entity is only used to show Open/Closed state and drive the symbol/animation.
2) Tap action = Call service (control)
- Set Tap action to Call service, and call the thing that actually moves the device.
Typical options:

**A) Call a script**
Use this when you have a script that triggers open/close (toggle):
- Service: script.turn_on
- Service data:
- entity_id: script.garageport_open_close
This is perfect for a “single button” opener where the same script toggles between opening/closing.

**B) Call a cover service (if you have a cover entity)**
If your garage/blinds is exposed as a cover.* entity, you can call:
- cover.open_cover
- cover.close_cover
- cover.toggle
- …and target your cover entity.

**C) Call a switch (relay)**
If a relay triggers the opener:
- Service: switch.turn_on (or switch.toggle)
- Target: switch.garage_relay

**3) Make the animation feel responsive**
Contact sensors often update only when the device is fully open/fully closed.
That means the closing animation might otherwise start “too late”.
Enable:
- Tap starts animation (Gate/Garage/Blind)
And set:
- Confirm state in (seconds)

Set it to approximately how long the device normally takes to move (example: 10–20s).
This makes the animation start immediately when you tap, and then waits for the sensor state to confirm the final position.

Example scenario
- Main entity: binary_sensor.garage_contact (open/closed)
- Tap action: Call service → script.turn_on → script.garageport_open_close
- Tap starts animation: ON

Confirm state in: 15 seconds
Result:
- The card shows the correct final state based on the sensor.
- Tapping the card triggers the opener script.
- The animation starts instantly and feels “real”, even if the sensor updates late.



## Common entity types (important!)
Garage doors can appear as different entities in Home Assistant:
- A **cover** entity (best): `cover.garage_door` (often has position)
- A **magnet / door sensor** (very common): `binary_sensor.garage_contact`  
  states like: `open/closed` or `on/off`

This card supports both numeric/position behavior and state matching using Intervals.

---

## Panels are controlled by Intervals
Garage doors often have visible panels. In this card:
- the **number of Intervals** can define the **number of panels**
- each panel (interval) can have its own color and timing

### State-only sensors (open/closed, on/off)
If your entity only has two states, you still need at least **two Intervals**:
- Interval 1 matches `closed`
- Interval 2 matches `open`

### Example: 5 panels + realistic timing
If you want 5 panels:
- create 5 intervals
- first interval matches `closed` or 0 as value
- last interval matches `open` or 1 as value
- The other Panels / segment should have value as 0.1, 0.2, 0.3 . The entity state will never reach those states but used to follow the animation.



Now add timing:
If the door takes 10 seconds to open and you have 5 panels:
- set **Seconds to open this segment** to **2** on each interval  
(2 seconds × 5 segments = 10 seconds total)

This makes the animation feel like the real door.

---

## Garage door editor fields (as seen in UI)

#### **Door type** *(config key: `garage_door_type`)*
Choose:
- single door
- double door (two doors side-by-side)

#### **Door width** *(config key: `garage_door_width`)*
Adjusts the width of each door (mostly useful for double door layouts).

#### **Gap between doors** *(config key: `garage_door_gap`)*
Space between two doors in double mode.

#### **Second garage door entity** *(config key: `garage_door_entity2`)*
Only used for double mode (door #2).

#### **First garage inside lamp entity** *(config key: `garage_door_lamp_entity`)*
Optional lamp entity that creates a nice interior light glow effect behind the door.

#### **Second inside lamp entity** *(config key: `garage_door_lamp_entity2`)*
Same as above, but for door #2 (double mode).  
If your garage uses one lamp for both doors, you can use the same lamp entity for both fields.

---

## Creative tip: use badges around your garage
Once the door looks good, add badges for:
- outdoor lights
- an “open/close” button
- camera image badge
- plants / decoration icons  
This card is designed to let you build a “scene tile” around the main symbol.

---

# Blinds
<a id="blinds"></a>

Symbol: `blind`

## Blinds work the same way as Garage Door
Blinds reuse the same core logic:
- Intervals can match states (`open/closed`, `on/off`)
- Intervals can define how many sections the blinds have
- “Seconds per segment” can create realistic movement

## State-only sensors (open/closed)
If your blind entity is just open/closed:
- create multiple intervals
- first interval matches `closed`
- last interval matches `open`
- optionally distribute opening time across segments using “Seconds to open this segment”

## Blind type
#### **Blind style** *(config key: `blind_style`)*
Select the visual style:
- Lamella style
- Classic blinds (persienne)

## Shared door/blind layout fields
In the editor, the blind symbol uses the same sizing/double/lamp fields as garage door:
- **Door type**
- **Door width**
- **Gap between doors**
- **Second garage door entity** (acts as second blind entity)
- **First garage inside lamp entity**
- **Second inside lamp entity**

(They keep the same labels in the UI.)

---

# Fan
<a id="fan"></a>

Symbol: `fan`

## What it’s for
A fan symbol for ventilation and HVAC dashboards. By using intervals you can
control the visual look of the blades and also speed of the blades. 
On high speed it will show a cool wind animation.

#### **Blade count** *(config key: `fan_blade_count`)*
How many fan blades are drawn (visual preference).

#### **Show frame (Fan)** *(config key: `fan_show_frame`)*
Shows/hides the fan casing/frame.

---

# Heatpump
<a id="heatpump"></a>

Symbol: `heatpump`

## What it’s for
A stylized heatpump/HVAC symbol.

#### **Blade count** *(config key: `fan_blade_count`)*
Same as Fan — changes how many blades are drawn.

---

# Image
<a id="image"></a>

Symbol: `image`

## Two ways to use images (important!)
1) **Image as the main symbol** (Symbol = Image)  
2) **Image inside a Badge** (Badge “Use image instead of icon”)

These are both powerful, but configured in different places.

---

## A) Main card image (Symbol = Image)

### What it’s great for
- A dashboard tile with a photo background (garage/driveway/room)
- A “scene tile” where you place badges on top
- A themed tile per room/device

### Image fields in the editor (main card)

#### **Image URL / path** *(config key: `image_url`)*
The path to your image.  
Typical Home Assistant local path:
- `/local/your_folder/image.png`

#### **Image fit** *(config key: `image_fit`)*
- `cover` fills the card (may crop)
- `contain` shows the full image (may add borders)

#### **Full card background** *(config key: `image_full_card`)*
If enabled, the image becomes the full card background (recommended for tiles).

#### **Opacity (0-1)** *(config key: `image_opacity`)*
Controls how visible the image is.

#### **Radius (px)** *(config key: `image_radius`)*
Rounded corners for the image.

#### **Tint overlay** *(config key: `image_tint`)*
Adds a colored layer on top of the image (commonly used to darken a photo).

#### **Tint color** *(config key: `image_tint_color`)*
The tint color (black is common).

#### **Tint opacity (0-1)** *(config key: `image_tint_opacity`)*
Strength of the tint.

#### **Dim when off** *(config key: `image_dim_off`)*
If enabled, the image dims when the main entity is off.

#### **Dim factor (0-1)** *(config key: `image_dim_off_opacity`)*
How much it dims.

#### **Frame** *(config key: `image_frame`)*
Adds a border around the image.

#### **Frame color** *(config key: `image_frame_color`)*
Border color.

#### **Frame width** *(config key: `image_frame_width`)*
Border thickness.

---

## B) Badge images (images inside badges)

Badge images are powerful because they can become “clickable picture buttons”:
- tap to toggle a light
- tap to call a service
- show a decorative icon or avatar
- create a full “scene tile” look around the main image

Badge image fields are described in the Badges section below.

---

# Badges
<a id="badges"></a>

Badges are overlay widgets placed anywhere on the card.

## How to move badges (3 ways)
In the editor you can position a badge by:
1) Drag & drop on the preview  
2) Using the X/Y buttons (fine adjustments)  
3) Typing the values directly

#### **Position X (%)** *(badge field: `x`)*
Left → Right position.

#### **Position Y (%)** *(badge field: `y`)*
Top → Bottom position.

---

## Badge fields (as seen in UI)

#### **Badge entity** *(badge field: `entity`)*
The entity this badge is linked to.

#### **Badge title (optional)** *(badge field: `title`)*
Optional helper title (useful for tooltips or clarity).

#### **Label and variables** *(badge field: `label`)*
Text shown on the badge. Supports templates like:
- `Temp: <value>`
- `<name>`

#### **Show icon** *(badge field: `show_icon`)*
If off, the badge can show only text (useful for minimal layouts).

#### **Icon / Icon (mdi:...)** *(badge field: `icon`)*
The icon shown when the badge is not using an image.

#### **Change icon color based on <state>** *(badge field: `icon_color_by_state`)*
If enabled, the badge can change icon color depending on the entity state.

---

## Badge images (instead of icons)

#### **Use image (instead of icon)** *(badge field: `use_image`)*
Enable to show an image instead of an icon.

#### **Image URL / path** *(badge field: `img_url`)*
Path to the badge image. Example:
- `/local/icons/outdoor_light.png`

#### **Image fit** *(badge field: `img_fit`)*
- `cover` fills the badge area (may crop)
- `contain` shows full image (may add empty space)

#### **Image opacity (0-1)** *(badge field: `img_opacity`)*
Transparency of the badge image.

#### **Image radius** *(badge field: `img_radius`)*
Rounded corners for the badge image.

#### **Tint overlay / Tint color / Tint opacity (0-1)** *(badge fields: `img_tint`, `img_tint_color`, `img_tint_opacity`)*
Adds a colored layer over the badge image.

#### **Frame / Frame color / Frame width** *(badge fields: `img_frame`, `img_frame_color`, `img_frame_width`)*
Adds a border to badge image.

#### **Dim when off / Dim factor (0-1)** *(badge fields: `img_dim_when_off`, `img_dim_when_off_opacity`)*
Dims the badge image when the badge entity is off.

---

## Badge slider (optional)

#### **Show slider** *(badge field: `show_slider`)*
Adds a slider to the badge to control the entity.

Slider controls in the editor:
- **Orientation** *(badge field: `slider_orientation`)*
- **Update mode** *(badge field: `slider_update`)*  
  - `release`: updates when you release (stable, recommended)
  - `live`: updates while dragging (responsive)
- **Show value** *(badge field: `slider_show_value`)*
- **Min (optional)** *(badge field: `slider_min`)*
- **Max (optional)** *(badge field: `slider_max`)*
- **Step (optional)** *(badge field: `slider_step`)*
- **Length (px)** *(badge field: `slider_length`)*
- **Track thickness (px)** *(badge field: `slider_thickness`)*
- **Thumb size (px)** *(badge field: `slider_thumb_size`)*
- **Thumb color** *(badge field: `slider_thumb_color`)*
- **Thumb radius (px)** *(badge field: `slider_thumb_radius`)*
- **Track color** *(badge field: `slider_track_color`)*
- **Track radius (px)** *(badge field: `slider_track_radius`)*

Beginner tip: Start with defaults and only style after functionality works.

---

## Badge tap action (click behavior)

#### **Tap action** *(badge field: `tap_action`)*
Defines what happens when you tap the badge.
Common actions:
- `more-info` (opens entity popup)
- `toggle` (toggles entity)
- `call-service` (runs a Home Assistant service)
- `none`

If you use call-service, the editor provides:
- **Pick service from list**
- **Available services**
- **Service (domain.service)**
- **Service data (optional JSON)**

---

## Badge styles (meaning of each style)
#### **Badge style** *(badge field: `style`)*
The editor offers these styles (exact names as shown):

- **Glass** *(value: `glass`)*  
  Frosted/glossy look. Great on image tiles and dark dashboards.

- **Solid** *(value: `solid`)*  
  Strong background for maximum readability (best for beginners).

- **Outline** *(value: `outline`)*  
  Border only, clean look when you don’t want heavy blocks.

- **None** *(value: `none`)*  
  No background; minimal style.

- **Left arrow** *(value: `left_arrow`)*  
- **Right arrow** *(value: `right_arrow`)*  
- **Top arrow** *(value: `top_arrow`)*  
- **Bottom arrow** *(value: `bottom_arrow`)*  
  Arrow shaped badges. Great for directional hints or flows.

- **Recycle arrow left** *(value: `recycle_left`)*  
- **Recycle arrow right** *(value: `recycle_right`)*  
  Circular arrow styles. Great for “refresh/loop” visuals.

- **Fan (symbol)** *(value: `fan`)*  
  Uses the fan symbol as a badge style. Good for ventilation widgets.

- **Heatpump (symbol)** *(value: `heatpump`)*  
  Uses the heatpump symbol as a badge style.

### Styling badges (colors, transparency, size)
Depending on your style, the editor provides these controls to fine-tune appearance:
- **Padding (px)** *(badge field: `padding`)*
- **Radius (px)** *(badge field: `radius`)*
- **Font size (px)** *(badge field: `font_size`)*
- **Icon size (px)** *(badge field: `icon_size`)*
- **Opacity (optional)** *(badge field: `opacity`)*
These are used to make badges larger/smaller, more/less transparent, and better aligned with your dashboard theme.

---

# Intervals
<a id="intervals"></a>

Intervals are the card’s rule engine.

They can do BOTH:
- **Numeric rules** (battery %, liters, watts, etc.)
- **Exact match rules** (state text like `on/off`, `open/closed`)

They can also be used to define **segment/panel count** for segmented symbols (battery segments, garage door panels, blinds sections).

---

## Main card Intervals vs Badge Intervals (separate!)
### Main card Intervals
Configured at the card level:
```yaml
intervals:
  - ...
