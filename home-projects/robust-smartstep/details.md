# Robust SmartStep: Anomaly Filtering for Pedestrian Dead Reckoning

A novel approach to improve step detection in Pedestrian Dead Reckoning (PDR) systems using deep learning-based anomaly filtering. This project focuses on enhancing the accuracy of step detection by distinguishing between genuine walking signals and mimic walking signals.

## Key Features

- Advanced anomaly detection using segment-based autoencoders
- Real-time processing of IMU data for step detection
- Improved PDR accuracy through filtered step detection
- Robust handling of various walking patterns and anomalies
- Integration with existing positioning systems

## Technical Implementation

### Deep learning architecture
- Segment-based autoencoder for anomaly detection
- Custom loss functions for optimal performance
- Real-time inference capabilities

### Signal processing
- IMU data preprocessing and feature extraction
- Time-series analysis of walking patterns
- Integration with PDR algorithms

### Performance evaluation
- Extensive testing with various walking scenarios
- Comparison with traditional step detection methods
- Quantitative analysis of positioning accuracy

## Publication

The project demonstrates significant improvements in PDR accuracy by effectively filtering out anomalous signals that could lead to incorrect step detection. This work has been published at the IEEE/ION Position, Location and Navigation Symposium (PLANS) 2025 in Utah, USA.

**Citation:** Sayyaf, M. I., Zhu, N., & Renaudin, V. (2025). Advanced Step Detection with Anomaly Filtering for Enhanced Positioning Accuracy. *Proceedings of the 2025 IEEE/ION Position, Location and Navigation Symposium (PLANS)*, Utah, USA.

**GitLab:** [https://gitlab.univ-eiffel.fr/issam/robust-smartstep](https://gitlab.univ-eiffel.fr/issam/robust-smartstep)
