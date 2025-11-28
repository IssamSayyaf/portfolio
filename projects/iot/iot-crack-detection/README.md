---
id: iot-crack-detection
title: IoT Wireless Crack Detection System
excerpt: Wireless structural health monitoring system using acoustic emission sensors and ESP32.
description: Master's thesis project - Real-time crack detection in heritage buildings using IoT and acoustic emission analysis.
category: IoT
categorySlug: iot
tags: [iot, esp32, acoustic-emission, wireless, monitoring]
featured: true
image: assets/images/arch_esp32_iot_project.jpeg
imageCaption: System architecture for wireless crack detection
status: completed
date: 2023-10-01
technologies: [ESP32, C++, MQTT, LoRa, Python]
---

# IoT Wireless Crack Detection System

A complete wireless structural health monitoring system designed for heritage building preservation using acoustic emission sensors and IoT technology.

## Project Background

This project was developed as my Master's thesis at the University of Calabria. The goal was to create a low-cost, non-invasive monitoring system for detecting and classifying cracks in heritage buildings.

## System Overview

The system consists of:

1. **Sensor Nodes**: ESP32-based units with acoustic emission sensors
2. **Gateway**: Raspberry Pi collecting data from sensor nodes
3. **Cloud Platform**: Data storage and analysis
4. **Web Dashboard**: Real-time monitoring interface

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sensor    │     │   Sensor    │     │   Sensor    │
│   Node 1    │     │   Node 2    │     │   Node N    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │ LoRa/WiFi
                    ┌──────▼──────┐
                    │   Gateway   │
                    │(Raspberry Pi)│
                    └──────┬──────┘
                           │ MQTT
                    ┌──────▼──────┐
                    │    Cloud    │
                    │  Platform   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Web      │
                    │  Dashboard  │
                    └─────────────┘
```

## Hardware Design

### Sensor Node Components

| Component | Model | Purpose |
|-----------|-------|---------|
| MCU | ESP32-WROOM-32 | Processing & Communication |
| AE Sensor | R15α | Acoustic Emission Detection |
| Amplifier | Custom 40dB | Signal Amplification |
| ADC | ADS1256 | High-resolution Sampling |
| Power | LiPo 3.7V 2000mAh | Battery Power |

### Schematic

The sensor node includes:
- High-pass filter (20kHz cutoff)
- Programmable gain amplifier
- Peak detector circuit
- ESP32 deep sleep support

## Software Implementation

### Sensor Node Firmware

```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

#define AE_THRESHOLD 100
#define SAMPLE_RATE 1000000  // 1 MHz

void setup() {
    initADC();
    initWiFi();
    initMQTT();
}

void loop() {
    int sample = readAE();

    if (sample > AE_THRESHOLD) {
        // AE event detected
        AEEvent event = captureEvent();
        publishEvent(event);
    }

    checkDeepSleep();
}
```

### Crack Classification

```python
class CrackClassifier:
    def __init__(self):
        self.model = load_model('crack_classifier.h5')

    def classify(self, ae_features):
        """
        Classify AE event into crack types:
        - Type A: Surface crack
        - Type B: Internal crack
        - Type C: Structural failure
        """
        prediction = self.model.predict(ae_features)
        return self.decode_prediction(prediction)
```

## Results

### Detection Performance

- **Sensitivity**: 95% detection rate for cracks >0.1mm
- **False Positive Rate**: <2%
- **Localization Accuracy**: ±5cm

### Power Consumption

- Active Mode: 150mA
- Sleep Mode: 10µA
- Battery Life: 6 months (with solar)

## Publications

This work was published at:
- IEEE MetroLivEnv 2023
- IMEKO TC-4 2022

## Conclusion

The system successfully demonstrates the feasibility of using low-cost IoT devices for structural health monitoring of heritage buildings. The combination of acoustic emission analysis and machine learning enables accurate crack detection and classification.

## Acknowledgments

Supervised by Prof. Francesco Lamonaca at the University of Calabria.
