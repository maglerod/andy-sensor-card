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
- [WindDirection](#winddirection)
  - [WindDirection — with current speed & max in a vertical stack](#winddirection--speed--vertical--stack)
  - [WindDirection plain](#winddirection--plain)
- [SunFlow](#sunflow)
  - [SunFlow — with intervals and vertical stack](#sunflow--intervals--vertical--stack)
  - [SunFLow plain](#sunflow--plain)


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

## WindDirection

### WindDirection — speed vertical stack

```yaml
type: vertical-stack
cards:
  - name: Wind direction
    entity: sensor.hp2551ae_pro_v2_0_9_wind_direction
    entity2: ""
    badge_drag_enabled: false
    symbol: wind_direction
    min: 0
    max: 100
    unit: ""
    decimals: 0
    value_position: inside
    value_font_size: 13
    name_font_size: 0
    glass: false
    orientation: vertical
    show_scale: true
    wind_show_degrees: true
    wind_show_direction: true
    wind_show_direction_markers: true
    wind_direction_language: en
    wind_degree_font_size: 44
    wind_direction_font_size: 31
    wind_direction_marker_font_size: 10
    wind_outline_width: 0.4
    wind_arrow_size: 36
    wind_arrow_thickness: 55
    wind_gauge_enabled: true
    wind_gauge_show_values: true
    wind_gauge_show_scale: true
    wind_gauge_speed_entity: sensor.hp2551ae_pro_v2_0_9_wind_speed
    wind_gauge_max_entity: sensor.hp2551ae_pro_v2_0_9_max_daily_gust
    wind_gauge_position: bottom
    wind_gauge_mode: single_max_marker
    wind_gauge_speed_label: Wind
    wind_gauge_max_label: Max
    wind_gauge_value_color: "#ffffff"
    wind_gauge_value_outline: true
    wind_gauge_value_outline_color: "#000000"
    wind_gauge_min: 0
    wind_gauge_max: 30
    wind_gauge_decimals: 1
    wind_gauge_opacity: 90
    wind_gauge_track_opacity: 12
    wind_gauge_arc_width: 4.5
    wind_gauge_font_size: 7
    wind_gauge_intervals:
      - id: wgi0
        to: 3
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
      - id: wgi1
        to: 8
        color: "#84cc16"
        outline: "#ffffff"
        scale_color: "#84cc16"
        gradient:
          enabled: false
          from: "#84cc16"
          to: "#84cc16"
        match: ""
        new_value: ""
        icon: ""
        icon_color: ""
        seconds: null
      - id: wgi2
        to: 14
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
      - id: wgi3
        to: 20
        color: "#f97316"
        outline: "#ffffff"
        scale_color: "#f97316"
        gradient:
          enabled: false
          from: "#f97316"
          to: "#f97316"
        match: ""
        new_value: ""
        icon: ""
        icon_color: ""
        seconds: null
      - id: wgi4
        to: 100
        color: "#F3B9B9"
        outline: "#ffffff"
        scale_color: "#ef4444"
        gradient:
          enabled: true
          from: "#EBDBDB"
          to: "#ef4444"
        match: ""
        new_value: ""
        icon: ""
        icon_color: ""
        seconds: null
    scale_color_mode: active_interval
    show_stats: false
    stats_hours: 24
    card_scale: 2
    card_width: ""
    card_height: ""
    intervals:
      - id: it0
        to: 30
        color: "#F3C4C4"
        outline: "#ffffff"
        scale_color: "#CC7575"
        gradient:
          enabled: false
          from: "#ef4444"
          to: "#ef4444"
        match: ""
        new_value: Andy Sensor Card
        icon: ""
        icon_color: ""
        seconds: 2
      - id: it2
        to: 60
        color: "#F56200"
        outline: "#ffffff"
        scale_color: "#fbbf24"
        gradient:
          enabled: false
          from: "#fbbf24"
          to: "#fbbf24"
        match: ""
        new_value: Just search for
        icon: ""
        icon_color: ""
        seconds: 2
      - id: it_94668e85dc5c38_19c27950f6c
        to: 80
        color: "#E4F500"
        outline: "#ffffff"
        scale_color: "#fbbf24"
        gradient:
          enabled: false
          from: "#fbbf24"
          to: "#fbbf24"
        match: ""
        new_value: Just search for
        icon: ""
        icon_color: ""
        seconds: 2
      - id: it4
        to: 100
        color: "#0077FF"
        outline: "#C9C9C9"
        scale_color: "#C9C9C9"
        gradient:
          enabled: true
          from: "#00244D"
          to: "#C2C5F5"
        match: ""
        new_value: in HACS
        icon: ""
        icon_color: ""
        seconds: 2
    badges: []
    window_blind_entity: ""
    window_light_entity: ""
    type: custom:andy-sensor-card
    name_position: top_left
    stats_position: bottom_center
    gate_type: sliding
    gate_side: left
    outline_value: false
```

### WindDirection — Plain

```yaml
name: Sensor
entity: sensor.hp2551ae_pro_v2_0_9_wind_direction
entity2: ""
badge_drag_enabled: false
symbol: wind_direction
min: 0
max: 360
unit: ""
decimals: 0
value_position: hide
value_font_size: 0
name_font_size: 0
glass: false
orientation: vertical
show_scale: true
wind_show_degrees: true
wind_show_direction: true
wind_show_direction_markers: true
wind_direction_language: en
wind_degree_font_size: 0
wind_direction_font_size: 0
wind_direction_marker_font_size: 11
wind_outline_width: 0.6
wind_arrow_size: 68
wind_arrow_thickness: 60
wind_gauge_enabled: false
wind_gauge_show_values: true
wind_gauge_show_scale: false
wind_gauge_speed_entity: ""
wind_gauge_max_entity: ""
wind_gauge_position: bottom
wind_gauge_mode: dual
wind_gauge_speed_label: Wind
wind_gauge_max_label: Max
wind_gauge_value_color: "#ffffff"
wind_gauge_value_outline: true
wind_gauge_value_outline_color: "#000000"
wind_gauge_min: 0
wind_gauge_max: 30
wind_gauge_decimals: 1
wind_gauge_opacity: 90
wind_gauge_track_opacity: 18
wind_gauge_arc_width: 5
wind_gauge_font_size: 8
wind_gauge_intervals:
  - id: wgi0
    to: 3
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
  - id: wgi1
    to: 8
    color: "#84cc16"
    outline: "#ffffff"
    scale_color: "#84cc16"
    gradient:
      enabled: false
      from: "#84cc16"
      to: "#84cc16"
    match: ""
    new_value: ""
    icon: ""
    icon_color: ""
    seconds: null
  - id: wgi2
    to: 14
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
  - id: wgi3
    to: 20
    color: "#f97316"
    outline: "#ffffff"
    scale_color: "#f97316"
    gradient:
      enabled: false
      from: "#f97316"
      to: "#f97316"
    match: ""
    new_value: ""
    icon: ""
    icon_color: ""
    seconds: null
  - id: wgi4
    to: 100
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
scale_color_mode: per_interval
show_stats: false
stats_hours: 24
card_scale: 2
card_width: "400"
card_height: ""
intervals:
  - id: it4
    to: 100
    color: "#16a34a"
    outline: "#ffffff"
    scale_color: "#FFFFFF"
    gradient:
      enabled: true
      from: "#5987F3"
      to: "#01122D"
    match: ""
    new_value: ""
    icon: ""
    icon_color: ""
    seconds: null
badges: []
type: custom:andy-sensor-card
```

---

- [SunFlow](#sunflow)
  - [SunFlow — with intervals and vertical stack](#sunflow--intervals--vertical--stack)
  - [SunFLow plain](#sunflow--plain)


## SunFlow

### SunFlow — intervals vertical stack

```yaml
type: vertical-stack
cards:
  - name: SunFlow
    entity: sun.sun
    entity2: ""
    badge_drag_enabled: false
    charging_state_entity: ""
    charging_power_entity: ""
    charging_state_entity2: ""
    charging_power_entity2: ""
    symbol: sun_flow
    min: 0
    max: 100
    unit: ""
    decimals: 0
    value_position: hide
    value_font_size: 13
    name_font_size: 0
    glass: false
    orientation: vertical
    fan_show_frame: false
    fan_blade_count: 3
    garage_door_type: single
    blind_style: persienne
    blind_position_entity: ""
    blind_position_entity2: ""
    image_source: url
    image_url: ""
    image_media: ""
    image_fit: cover
    image_full_card: false
    image_opacity: 1
    image_radius: 0
    image_frame: false
    image_frame_color: rgba(255,255,255,0.22)
    image_frame_width: 2
    image_tint: false
    image_tint_color: "#000000"
    image_tint_opacity: 0
    image_dim_off: false
    image_dim_off_opacity: 0.45
    show_scale: true
    sunflow_sun_entity: ""
    sunflow_sunrise_entity: ""
    sunflow_sunset_entity: ""
    sunflow_elevation_entity: ""
    sunflow_azimuth_entity: ""
    sunflow_rising_entity: ""
    sunflow_show_sunrise: true
    sunflow_show_sunset: true
    sunflow_show_daylight: true
    sunflow_show_now: true
    sunflow_show_elevation: true
    sunflow_show_azimuth: false
    sunflow_show_remaining: true
    sunflow_show_scale: true
    sunflow_sunrise_label: Sunrise
    sunflow_sunset_label: Sunset
    sunflow_daylight_label: Daylight
    sunflow_now_label: Now
    sunflow_elevation_label: Elevation
    sunflow_azimuth_label: Azimuth
    sunflow_remaining_label: remaining
    sunflow_until_sunrise_label: until sunrise
    sunflow_hours_label: h
    sunflow_minutes_label: min
    sunflow_unavailable_label: Sun data unavailable
    sunflow_glow_strength: 85
    sunflow_sun_size: 7
    sunflow_arc_width: 2
    sunflow_font_scale: 95
    sunflow_value_color: "#FBBF24"
    sunflow_sunrise_color: "#FBBF24"
    sunflow_sunset_color: "#FBBF24"
    sunflow_remaining_color: "#FBBF24"
    sunflow_remaining_outline: false
    sunflow_remaining_outline_color: "#000000"
    sunflow_secondary_color: "#FBBF24"
    scale_color_mode: active_interval
    show_stats: false
    stats_hours: 24
    card_scale: 2
    card_width: ""
    card_height: ""
    intervals:
      - id: it0
        to: 30
        color: "#FA7000"
        outline: "#ffffff"
        scale_color: "#CC7575"
        gradient:
          enabled: true
          from: "#FBBF24"
          to: "#ef4444"
        match: ""
        new_value: Andy Sensor Card
        icon: ""
        icon_color: ""
        seconds: 2
      - id: it2
        to: 60
        color: "#FFE32E"
        outline: "#F2F2F2"
        scale_color: "#fbbf24"
        gradient:
          enabled: true
          from: "#fbbf24"
          to: "#FE1706"
        match: ""
        new_value: Just search for
        icon: ""
        icon_color: ""
        seconds: 2
      - id: it_94668e85dc5c38_19c27950f6c
        to: 80
        color: "#E4F500"
        outline: "#ffffff"
        scale_color: "#fbbf24"
        gradient:
          enabled: false
          from: "#fbbf24"
          to: "#fbbf24"
        match: ""
        new_value: Just search for
        icon: ""
        icon_color: ""
        seconds: 2
      - id: it4
        to: 100
        color: "#0077FF"
        outline: "#C9C9C9"
        scale_color: "#C9C9C9"
        gradient:
          enabled: true
          from: "#00244D"
          to: "#C2C5F5"
        match: ""
        new_value: in HACS
        icon: ""
        icon_color: ""
        seconds: 2
    badges: []
    window_blind_entity: ""
    window_light_entity: ""
    type: custom:andy-sensor-card
    name_position: top_left
    stats_position: bottom_center
    outline_value: false

```

### SunFlow — plain

```yaml
name: Sensor
entity: sun.sun
entity2: ""
badge_drag_enabled: false
symbol: sun_flow
min: 0
max: 100
unit: ""
decimals: 0
value_position: hide
value_font_size: 0
name_font_size: 0
glass: true
orientation: vertical
show_scale: false
sunflow_sun_entity: ""
sunflow_sunrise_entity: ""
sunflow_sunset_entity: ""
sunflow_elevation_entity: ""
sunflow_azimuth_entity: ""
sunflow_rising_entity: ""
sunflow_show_sunrise: true
sunflow_show_sunset: true
sunflow_show_daylight: true
sunflow_show_now: true
sunflow_show_elevation: true
sunflow_show_azimuth: false
sunflow_show_remaining: true
sunflow_show_scale: true
sunflow_sunrise_label: Sunrise
sunflow_sunset_label: Sunset
sunflow_daylight_label: Daylight
sunflow_now_label: Now
sunflow_elevation_label: Elevation
sunflow_azimuth_label: Azimuth
sunflow_remaining_label: remaining
sunflow_until_sunrise_label: until sunrise
sunflow_hours_label: h
sunflow_minutes_label: min
sunflow_unavailable_label: Sun data unavailable
sunflow_glow_strength: 85
sunflow_sun_size: 14
sunflow_arc_width: 2.5
sunflow_font_scale: 100
sunflow_value_color: "#ffffff"
sunflow_sunrise_color: "#ffffff"
sunflow_sunset_color: "#ffffff"
sunflow_remaining_color: "#ffffff"
sunflow_remaining_outline: true
sunflow_remaining_outline_color: "#000000"
sunflow_secondary_color: "#ffffff"
scale_color_mode: per_interval
show_stats: false
stats_hours: 24
card_scale: 2
card_width: "400"
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
type: custom:andy-sensor-card

```

---
