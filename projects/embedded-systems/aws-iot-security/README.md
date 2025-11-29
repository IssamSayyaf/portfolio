# Secure IoT System with AWS Integration

![IoT System Architecture](../assets/images/arch_esp32_iot_project.jpeg)

## Overview

A comprehensive IoT security project focused on developing a secure system for collecting, transmitting, and storing sensor data in the cloud. The project implements robust security measures throughout the IoT pipeline while providing an intuitive user interface for monitoring and control.

## System Architecture

### ESP32-based IoT Device with Multiple Sensors
- Temperature and humidity monitoring
- Fire detection system
- Heating system control

### Security Implementation
- SSL/TLS encryption for MQTT communication
- AWS IoT Core integration with X.509 certificates
- Secure authentication and authorization
- Encrypted data storage in AWS DynamoDB

### Cloud Infrastructure
- AWS Lambda for serverless computing
- Amazon SNS for notifications
- AWS IoT Core for device management

## Features

- Real-time monitoring through Node-RED dashboard
- Automated alerts and notifications
- Remote heating system control
- Fire alarm system with instant alerts
- Secure data storage and retrieval
- Email and SMS notifications

## Impact

The project serves as a model for implementing security best practices in IoT systems, demonstrating the integration of embedded systems with cloud services while maintaining high security standards.

## Repository

[View on GitHub](https://github.com/IssamSayyaf/IoT-security)
