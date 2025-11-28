---
id: pedestrian-dead-reckoning
title: Pedestrian Dead Reckoning with Deep Learning
excerpt: AI-powered indoor positioning system using smartphone IMU sensors and anomaly detection.
description: Research project implementing deep learning models for accurate pedestrian navigation without GPS.
category: Research
categorySlug: research
tags: [deep-learning, positioning, python, tensorflow, signal-processing]
featured: true
image: assets/images/deep_learning.png
imageCaption: Neural network architecture for step detection
status: in-progress
date: 2025-01-10
technologies: [Python, TensorFlow, NumPy, Matplotlib, Scikit-learn]
---

# Pedestrian Dead Reckoning with Deep Learning

Research project on implementing deep learning models for accurate pedestrian indoor navigation using smartphone IMU sensors.

## Research Overview

This project is part of my PhD research at Université Gustave Eiffel, focusing on improving pedestrian dead reckoning (PDR) accuracy through anomaly detection and deep learning techniques.

## Problem Statement

Traditional PDR systems suffer from:
- Cumulative drift errors
- Step detection failures
- Heading estimation errors
- Sensor noise and anomalies

## Approach

We propose a novel approach using:

1. **Segment-Based Autoencoders** for anomaly detection
2. **LSTM Networks** for step detection
3. **Attention Mechanisms** for heading estimation

## Architecture

```
┌──────────────────────────────────────────────┐
│               Input Layer                     │
│         (IMU Signals: Acc, Gyro)             │
├──────────────────────────────────────────────┤
│           Preprocessing                       │
│    (Normalization, Segmentation)             │
├──────────────────────────────────────────────┤
│         Autoencoder                          │
│    (Anomaly Detection & Filtering)           │
├──────────────────────────────────────────────┤
│           LSTM + Attention                   │
│      (Step Detection & Heading)              │
├──────────────────────────────────────────────┤
│            Position Estimation               │
│         (PDR Integration)                    │
└──────────────────────────────────────────────┘
```

## Implementation

### Autoencoder for Anomaly Detection

```python
class SegmentAutoencoder(tf.keras.Model):
    def __init__(self, latent_dim=32):
        super().__init__()
        self.encoder = tf.keras.Sequential([
            layers.Dense(128, activation='relu'),
            layers.Dense(64, activation='relu'),
            layers.Dense(latent_dim)
        ])
        self.decoder = tf.keras.Sequential([
            layers.Dense(64, activation='relu'),
            layers.Dense(128, activation='relu'),
            layers.Dense(segment_size * 6)
        ])

    def call(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded
```

### Step Detection Model

```python
def build_step_detector():
    model = tf.keras.Sequential([
        layers.LSTM(64, return_sequences=True),
        layers.Attention(),
        layers.LSTM(32),
        layers.Dense(1, activation='sigmoid')
    ])
    return model
```

## Results

| Metric | Traditional PDR | Our Method | Improvement |
|--------|-----------------|------------|-------------|
| Position Error (m) | 5.2 | 2.1 | 60% |
| Step Detection Accuracy | 87% | 96% | 9% |
| Heading Error (°) | 8.5 | 3.2 | 62% |

## Publications

1. **PLANS 2025**: "Anomaly Filtering for Pedestrian Dead Reckoning Using Segment-Based Autoencoders"
2. **APSCON 2025**: "Step Detection Enhanced by Anomaly Filtering"

## Future Work

- Real-time implementation on smartphone
- Integration with visual odometry
- Multi-floor navigation
- Crowdsourced map building

## Acknowledgments

This research is conducted at the GEOLOC laboratory, Université Gustave Eiffel, under the supervision of Prof. Valérie Renaudin.
