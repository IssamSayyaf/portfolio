---
id: getting-started-with-zephyr-rtos
title: Getting Started with Zephyr RTOS - A Complete Guide
excerpt: Learn how to set up Zephyr RTOS, create your first project, and understand the fundamentals of this powerful real-time operating system for embedded devices.
author: Issam Sayyaf
authorTitle: PhD Researcher & Embedded Systems Engineer
date: 2025-01-20
category: Zephyr OS
categorySlug: zephyr-os
tags: [zephyr, rtos, embedded, nrf52, stm32]
featured: true
readTime: 15 min read
image: assets/images/stm32mp1.jpg
imageCaption: Zephyr RTOS running on embedded hardware
---

# Getting Started with Zephyr RTOS

Zephyr is a scalable, real-time operating system (RTOS) supporting multiple hardware architectures, optimized for resource-constrained devices, and built with security in mind. In this comprehensive guide, we'll explore how to get started with Zephyr RTOS.

## What is Zephyr RTOS?

Zephyr is an open-source project hosted by the Linux Foundation. It provides a small, scalable, real-time operating system designed for use in resource-constrained and embedded systems.

> "Zephyr is not just another RTOS - it's a complete ecosystem for IoT development with enterprise-level support and a thriving community."

### Key Features

- **Small footprint** - Minimum 8KB footprint
- **Cross-architecture** - ARM, x86, ARC, RISC-V, and more
- **Extensive protocol support** - BLE, WiFi, LoRa, Thread, and more
- **Security-focused** - Built-in security features and certifications
- **Active community** - Supported by major industry players

## Setting Up Your Development Environment

### Prerequisites

Before we begin, ensure you have:

- A Linux, macOS, or Windows machine
- Python 3.8 or newer
- CMake 3.20 or newer
- A supported toolchain (we'll use GNU ARM Embedded)

### Step 1: Install West

West is Zephyr's meta-tool for managing multiple repositories and building projects:

```bash
pip3 install --user west
```

### Step 2: Get Zephyr Source

Create a workspace and fetch the Zephyr source:

```bash
west init ~/zephyrproject
cd ~/zephyrproject
west update
```

### Step 3: Export Zephyr CMake Package

This allows CMake to find Zephyr:

```bash
west zephyr-export
```

### Step 4: Install Python Dependencies

```bash
pip3 install --user -r ~/zephyrproject/zephyr/scripts/requirements.txt
```

## Your First Zephyr Application

Let's create a simple "Hello World" application that blinks an LED and prints to the console.

### Project Structure

Create the following directory structure:

```
my_app/
├── CMakeLists.txt
├── prj.conf
└── src/
    └── main.c
```

### CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.20.0)
find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(my_app)

target_sources(app PRIVATE src/main.c)
```

### prj.conf

```ini
CONFIG_GPIO=y
CONFIG_PRINTK=y
```

### main.c

```c
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>

/* The devicetree node identifier for the "led0" alias */
#define LED0_NODE DT_ALIAS(led0)

static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(LED0_NODE, gpios);

int main(void)
{
    int ret;

    if (!gpio_is_ready_dt(&led)) {
        return 0;
    }

    ret = gpio_pin_configure_dt(&led, GPIO_OUTPUT_ACTIVE);
    if (ret < 0) {
        return 0;
    }

    printk("Zephyr RTOS LED Blink Example\n");

    while (1) {
        gpio_pin_toggle_dt(&led);
        printk("LED toggled!\n");
        k_msleep(1000);
    }

    return 0;
}
```

### Building and Flashing

Build the application for your target board (e.g., nRF52840 DK):

```bash
west build -b nrf52840dk_nrf52840
```

Flash to your device:

```bash
west flash
```

## Understanding Zephyr Architecture

### Kernel Services

Zephyr provides various kernel services:

| Service | Description |
|---------|-------------|
| Threads | Preemptive and cooperative threading |
| Scheduling | Multiple scheduling algorithms |
| Synchronization | Mutexes, semaphores, condition variables |
| Data Passing | Message queues, pipes, FIFOs |
| Memory Management | Memory pools, heap, slabs |

### Device Tree

Zephyr uses Device Tree for hardware abstraction. This allows the same code to run on different boards with minimal changes:

```dts
/ {
    leds {
        compatible = "gpio-leds";
        led0: led_0 {
            gpios = <&gpio0 13 GPIO_ACTIVE_LOW>;
            label = "Green LED";
        };
    };

    aliases {
        led0 = &led0;
    };
};
```

## Best Practices

1. **Use Kconfig wisely** - Only enable features you need to minimize footprint
2. **Leverage Device Tree** - Abstract hardware details for portability
3. **Follow coding style** - Zephyr has strict coding guidelines
4. **Test on multiple platforms** - Ensure your code is truly portable
5. **Use the logging subsystem** - Prefer `LOG_*` macros over `printk`

## Common Pitfalls

- **Stack overflow** - Zephyr threads have fixed stack sizes. Monitor with `CONFIG_THREAD_ANALYZER`
- **Blocking in ISR** - Never use blocking APIs in interrupt context
- **Missing Kconfig options** - Always check if features are enabled

## Resources

- [Official Zephyr Documentation](https://docs.zephyrproject.org)
- [Zephyr GitHub Repository](https://github.com/zephyrproject-rtos/zephyr)
- [Nordic DevAcademy](https://academy.nordicsemi.com)

## Conclusion

Zephyr RTOS provides a powerful, flexible, and secure foundation for embedded development. With its excellent documentation, active community, and industry support, it's an excellent choice for your next embedded project.

In future articles, we'll dive deeper into advanced topics like:
- BLE application development
- Power management
- Over-the-air updates (MCUboot)
- Zephyr testing framework

Happy coding!
