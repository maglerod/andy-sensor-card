# Andy Sensor Card — EXAMPLES

Each example is shown as properly formatted YAML so it’s easy to copy into your Lovelace dashboard.

---

## Table of contents
- [Battery Segments](#battery-segments)
  - [Battery Segments — Full example](#battery-segments--full-example)
  - [Battery Segments — Minimal example](#battery-segments--minimal-example)
- [Battery Splitted Segments](#battery-splitted-segments)
  - [Splitted — Two entities (left/right)](#splitted--two-entities-leftright)
  - [Splitted — Charging animation + power](#splitted--charging-animation--power)
- [Battery Liquid](#battery-liquid)
  - [Battery Liquid — Basic](#battery-liquid--basic)
  - [Battery Liquid — Charging state + power](#battery-liquid--charging-state--power)
- [Garage Door](#garage-door)
  - [Single — Open/closed sensor (5 panels + timing)](#single--openclosed-sensor-5-panels--timing)
  - [Double — Two doors + interior lamp](#double--two-doors--interior-lamp)
- [Fan](#fan)
  - [Fan — Percentage sensor](#fan--percentage-sensor)
  - [Fan — On/off entity](#fan--onoff-entity)
- [Heatpump](#heatpump)
  - [Heatpump — Climate entity](#heatpump--climate-entity)
  - [Heatpump — Binary sensor + match intervals](#heatpump--binary-sensor--match-intervals)

---

## Battery Segments

### Battery Segments — Full example

```yaml
type: custom:andy-sensor-card
name: ""
entity: sensor.0x00158d0007ee189e_battery
entity2: ""
badge_drag_enabled: false
charging_state_entity: ""
charging_power_entity: ""
charging_state_entity2: ""
charging_power_entity2: ""
symbol: battery_segments
min: 0
max: 100
unit: ""
decimals: 0
value_position: inside
value_font_size: 0
glass: true
orientation: vertical
fan_blade_count: 3
garage_door_type: single
blind_style: persienne
show_scale: false
scale_color_mode: per_interval
show_stats: false
stats_hours: 24
card_scale: 1
card_width: ""
card_height: ""
intervals:
  - id: it0
    to: 0
    color: "#ef4444"
    outline: "#ffffff"
    scale_color: "#ef4444"
    gradient:
      enabled: false
      from: "#ef4444"
      to: "#ef4444"
    match: ""
    new_value: ""
    icon: ""
    icon_color: ""
    seconds: null
  - id: it1
    to: 20
    color: "#f59e0b"
    outline: "#ffffff"
    scale_color: "#f59e0b"
    gradient:
      enabled: false
      from: "#f59e0b"
      to: "#f59e0b"
    match: ""
    new_value: ""
    icon: ""
    icon_color: ""
    seconds: null
  - id: it2
    to: 40
    color: "#fbbf24"
    outline: "#ffffff"
    scale_color: "#fbbf24"
    gradient:
      enabled: false
      from: "#fbbf24"
      to: "#fbbf24"
    match: ""
    new_value: ""
    icon: ""
    icon_color: ""
    seconds: null
  - id: it3
    to: 60
    color: "#22c55e"
    outline: "#ffffff"
    scale_color: "#22c55e"
    gradient:
      enabled: false
      from: "#22c55e"
      to: "#22c55e"
    match: ""
    new_value: ""
    icon: ""
    icon_color: ""
    seconds: null
  - id: it4
    to: 100
    color: "#16a34a"
    outline: "#ffffff"
    scale_color: "#16a34a"
    gradient:
      enabled: false
      from: "#16a34a"
      to: "#16a34a"
    match: ""
    new_value: ""
    icon: ""
    icon_color: ""
    seconds: null
badges: []
tap_action: more-info
name_position: top_left
stats_position: bottom_center
gate_type: sliding
gate_side: left
industrial_look: true
outline_value: true
```

### Battery Segments — Minimal example

```yaml
type: custom:andy-sensor-card
name: "Battery"
symbol: battery_segments

entity: sensor.0x00158d0007ee189e_battery
min: 0
max: 100
decimals: 0

glass: true
industrial_look: true
scale_color_mode: per_interval

intervals:
  - id: low
    to: 20
    color: "#ef4444"
    outline: "#ffffff"
    scale_color: "#ef4444"
  - id: mid
    to: 80
    color: "#f59e0b"
    outline: "#ffffff"
    scale_color: "#f59e0b"
  - id: high
    to: 100
    color: "#22c55e"
    outline: "#ffffff"
    scale_color: "#22c55e"
```

---

## Battery Splitted Segments

### Splitted — Two entities (left/right)

```yaml
type: custom:andy-sensor-card
name: "EV Batteries"
symbol: battery_splitted_segments

entity: sensor.ev1_battery
entity2: sensor.ev2_battery
show_split_entity_names: true

min: 0
max: 100
decimals: 0

glass: true
industrial_look: true
scale_color_mode: per_interval

intervals:
  - id: low
    to: 20
    color: "#ef4444"
    outline: "#ffffff"
    scale_color: "#ef4444"
  - id: mid
    to: 80
    color: "#f59e0b"
    outline: "#ffffff"
    scale_color: "#f59e0b"
  - id: high
    to: 100
    color: "#22c55e"
    outline: "#ffffff"
    scale_color: "#22c55e"
```

### Splitted — Charging animation + power

```yaml
type: custom:andy-sensor-card
name: "EV Charging"
symbol: battery_splitted_segments

entity: sensor.ev1_battery
entity2: sensor.ev2_battery
show_split_entity_names: true

charging_state_entity: binary_sensor.ev1_charging
charging_power_entity: sensor.ev1_charging_power
charging_state_entity2: binary_sensor.ev2_charging
charging_power_entity2: sensor.ev2_charging_power

min: 0
max: 100
glass: true

intervals:
  - id: low
    to: 20
    color: "#ef4444"
    outline: "#ffffff"
    scale_color: "#ef4444"
  - id: mid
    to: 80
    color: "#f59e0b"
    outline: "#ffffff"
    scale_color: "#f59e0b"
  - id: high
    to: 100
    color: "#22c55e"
    outline: "#ffffff"
    scale_color: "#22c55e"
```

---

## Battery Liquid

### Battery Liquid — Basic

```yaml
type: custom:andy-sensor-card
name: "Phone Battery"
symbol: battery_liquid

entity: sensor.phone_battery
min: 0
max: 100
decimals: 0

glass: true
industrial_look: true

intervals:
  - id: low
    to: 20
    color: "#ef4444"
    outline: "#ffffff"
  - id: mid
    to: 80
    color: "#f59e0b"
    outline: "#ffffff"
  - id: high
    to: 100
    color: "#22c55e"
    outline: "#ffffff"
```

### Battery Liquid — Charging state + power

```yaml
type: custom:andy-sensor-card
name: "Phone Battery (Charging)"
symbol: battery_liquid

entity: sensor.phone_battery
charging_state_entity: binary_sensor.phone_is_charging
charging_power_entity: sensor.phone_charging_power

min: 0
max: 100
decimals: 0
glass: true

intervals:
  - id: low
    to: 20
    color: "#ef4444"
    outline: "#ffffff"
  - id: mid
    to: 80
    color: "#f59e0b"
    outline: "#ffffff"
  - id: high
    to: 100
    color: "#22c55e"
    outline: "#ffffff"
```

---

## Garage Door

### Single — Open/closed sensor (5 panels + timing)

```yaml
type: custom:andy-sensor-card
name: "Garage Door"
symbol: garage_door

entity: binary_sensor.garage_contact

garage_door_type: single
garage_door_lamp_entity: light.garage_inside

intervals:
  - id: p1
    match: "closed"
    color: "#6b7280"
    outline: "#ffffff"
    seconds: 2
  - id: p2
    match: ""
    color: "#9ca3af"
    outline: "#ffffff"
    seconds: 2
  - id: p3
    match: ""
    color: "#9ca3af"
    outline: "#ffffff"
    seconds: 2
  - id: p4
    match: ""
    color: "#9ca3af"
    outline: "#ffffff"
    seconds: 2
  - id: p5
    match: "open"
    color: "#22c55e"
    outline: "#ffffff"
    seconds: 2
```

### Double — Two doors + interior lamp

```yaml
type: custom:andy-sensor-card
name: "Double Garage"
symbol: garage_door

entity: cover.garage_left
garage_door_entity2: cover.garage_right

garage_door_type: double
garage_door_width: 46
garage_door_gap: 6

garage_door_lamp_entity: light.garage_inside
garage_door_lamp_entity2: light.garage_inside

min: 0
max: 100

intervals:
  - id: p1
    to: 20
    color: "#6b7280"
    outline: "#ffffff"
  - id: p2
    to: 40
    color: "#9ca3af"
    outline: "#ffffff"
  - id: p3
    to: 60
    color: "#9ca3af"
    outline: "#ffffff"
  - id: p4
    to: 80
    color: "#9ca3af"
    outline: "#ffffff"
  - id: p5
    to: 100
    color: "#22c55e"
    outline: "#ffffff"
```

---

## Fan

### Fan — Percentage sensor

```yaml
type: custom:andy-sensor-card
name: "Ventilation"
symbol: fan

entity: sensor.ventilation_speed_percent
min: 0
max: 100

fan_blade_count: 5
fan_show_frame: true

tap_action: more-info
```

### Fan — On/off entity

```yaml
type: custom:andy-sensor-card
name: "Extractor Fan"
symbol: fan

entity: switch.bathroom_fan

fan_blade_count: 3
fan_show_frame: false

tap_action: toggle
```

---

## Heatpump

### Heatpump — Climate entity

```yaml
type: custom:andy-sensor-card
name: "Heatpump"
symbol: heatpump

entity: climate.downstairs
fan_blade_count: 4

tap_action: more-info
```

### Heatpump — Binary sensor + match intervals

```yaml
type: custom:andy-sensor-card
name: "Heatpump Running"
symbol: heatpump

entity: binary_sensor.heatpump_running
fan_blade_count: 4

intervals:
  - id: st0
    match: "off"
    color: "#6b7280"
    outline: "#ffffff"
  - id: st1
    match: "on"
    color: "#22c55e"
    outline: "#ffffff"
```

---

# End of examples
