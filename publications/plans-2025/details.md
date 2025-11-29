# Anomaly Filtering for Pedestrian Dead Reckoning Using Segment-Based Autoencoders

## Conference Information
**Conference:** 2025 IEEE/ION Position, Location and Navigation Symposium (PLANS)  
**Location:** Salt Lake City, UT, USA  
**Date:** April 2025  
**Pages:** 53-62

## Authors
- Mohamad Issam SAYYAF
- Ni Zhu
- Valerie Renaudin

## Abstract
Accurate step detection is a cornerstone of Pedestrian Dead Reckoning (PDR), enabling applications such as indoor navigation, fitness monitoring and immersive gaming. However, step detection models often generate false detections during non-walking motions, such as hand gestures or sudden shaking. This paper introduces Robust SmartStep, a hybrid approach combining a reliable step detection algorithm SmartStep with a semi-supervised anomaly filtering framework based on a deep autoencoder. The method starts with the pre-processing of acceleration signals, including the generation of a time-frequency spectrogram and local normalization to enhance gait-specific features. An autoencoder trained on normal gait data identifies anomalous segments based on their higher reconstruction error, allowing the anomaly filter to effectively reject false steps. The experimental results of 14 km in different scenarios (pocket carrying, phone swinging, SMS, tests with visually impaired and sighted people) show that Robust SmartStep reduces over-detection errors by 20% compared to SmartStep and by 15% compared to the Android step counter and improves PDR accuracy. In addition, Robust SmartStep achieves PDR positioning performance that approaches the performance of highly personalized models tailored to the individual and one specific carrying mode of the device without the need for re-training. The method's lightweight design, coupled with open-source availability of datasets, code and an Android application facilitate integration into existing navigation systems.https://gitlab.univ-eiffel.fr/issam/robust-smartstep.

## Citation

Sayyaf, M. I., Zhu, N., & Renaudin, V. (2025). Anomaly Filtering for Pedestrian Dead Reckoning Using Segment-Based Autoencoders. *Proceedings of the 2025 IEEE/ION Position, Location and Navigation Symposium (PLANS)*, Salt Lake City, UT, USA, pp. 53-62.

## Links

- [ION Publications](https://www.ion.org/publications/abstract.cfm?articleID=20203)
- [GitLab Repository](https://gitlab.univ-eiffel.fr/issam/robust-smartstep)
