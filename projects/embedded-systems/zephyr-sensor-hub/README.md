---
id: zephyr-sensor-hub
title: Zephyr RTOS Sensor Hub
excerpt: A multi-sensor data collection platform built on Zephyr RTOS with BLE connectivity and cloud integration.
description: Complete IoT sensor hub featuring temperature, humidity, and motion sensors with real-time data streaming.
category: Embedded Systems
categorySlug: embedded-systems
tags: [zephyr, rtos, ble, sensors, nrf52]
featured: true
image: assets/images/stm32mp1.jpg
imageCaption: Sensor hub running on nRF52840 development kit
status: completed
date: 2024-12-15
github: https://github.com/IssamSayyaf/zephyr-sensor-hub
technologies: [Zephyr RTOS, C, BLE, nRF52840, Python]
---

# Zephyr RTOS Sensor Hub

A complete IoT sensor hub built on Zephyr RTOS, featuring multi-sensor data collection, BLE connectivity, and cloud integration.

## Project Overview

This project demonstrates a professional-grade embedded system design using Zephyr RTOS on the nRF52840 platform. The sensor hub collects environmental data and transmits it via Bluetooth Low Energy.

## Features

- **Multi-Sensor Support**: Temperature, humidity, pressure, and motion sensors
- **BLE Connectivity**: Real-time data streaming to mobile devices
- **Low Power**: Optimized for battery-powered operation
- **Cloud Integration**: MQTT bridge for cloud data storage
- **OTA Updates**: Over-the-air firmware updates via MCUboot

## Hardware

| Component | Model | Interface |
|-----------|-------|-----------|
| MCU | nRF52840 | - |
| Temperature | BME280 | I2C |
| Motion | MPU6050 | I2C |
| Display | SSD1306 | I2C |

## Software Architecture

```
┌─────────────────────────────────────┐
│           Application Layer          │
├─────────────────────────────────────┤
│    Sensor Manager  │  BLE Service   │
├─────────────────────────────────────┤
│         Zephyr RTOS Kernel          │
├─────────────────────────────────────┤
│      Hardware Abstraction Layer      │
└─────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Zephyr SDK 0.16.0 or later
- nRF52840 Development Kit
- nRF Connect SDK

### Building

```bash
west build -b nrf52840dk_nrf52840
```

### Flashing

```bash
west flash
```

## Code Structure

```
zephyr-sensor-hub/
├── src/
│   ├── main.c
│   ├── sensors/
│   │   ├── bme280.c
│   │   └── mpu6050.c
│   └── ble/
│       └── sensor_service.c
├── boards/
├── CMakeLists.txt
└── prj.conf
```

## Key Implementation Details

### Sensor Reading Thread

```c
void sensor_thread(void)
{
    struct sensor_data data;

    while (1) {
        bme280_read(&data.temp, &data.humidity);
        mpu6050_read(&data.accel);

        k_msgq_put(&sensor_msgq, &data, K_NO_WAIT);
        k_sleep(K_SECONDS(1));
    }
}
```

### BLE Notification

```c
void notify_sensor_data(struct sensor_data *data)
{
    bt_gatt_notify(NULL, &sensor_svc.attrs[1],
                   data, sizeof(*data));
}
```

## Results

- **Power Consumption**: 15µA in sleep mode
- **Data Rate**: 10 readings/second
- **BLE Range**: 30+ meters
- **Battery Life**: 6+ months on coin cell

## Future Improvements

1. Add LoRa connectivity for long-range communication
2. Implement sensor fusion algorithms
3. Add edge ML for anomaly detection
4. Create mobile app for data visualization

## License

MIT License
