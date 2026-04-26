# Khymera Dashboard

A real-time control and telemetry interface for embedded systems, designed as the command layer of a modular robotic platform.

---

## 🚀 Overview

Khymera Dashboard is a web-based control system that bridges software and hardware in real time. It provides a unified interface to monitor sensors, control actuators, and interact with an AI assistant capable of executing commands on physical devices.

The dashboard acts as the central nervous system of a broader engineering project: a modular robotic platform focused on accessible, functional prosthetic and manipulation systems.

---

## 🧠 System Context

This dashboard is not a standalone app. It is part of a larger physical system:

- A modular robotic gripper / prosthetic prototype
- Built using 3D-printed components (PLA + TPU)
- Actuated by servomotors
- Controlled by an ESP32-based embedded system
- Designed with a focus on:
  - Mechanical efficiency over biomimicry  
  - Low cost and accessibility  
  - Iterative engineering and modularity  

The dashboard provides visibility and control over this system in real time.

---

## ⚙️ Core Features

### 📡 Real-Time Telemetry
- Live sensor data via Server-Sent Events (SSE)
- Continuous updates without polling
- Structured telemetry pipeline with historical tracking

### 📊 Data Visualization
- Dynamic sparkline charts for each sensor
- Rolling history buffer for trend analysis
- Lightweight canvas-based rendering

### 🎛 Actuator Control
- Interactive UI for controlling hardware (e.g. servos)
- Multiple input methods:
  - Sliders
  - Preset positions
  - Manual numeric input
- Value clamping and validation before transmission

### 🧠 AI Integration
- Natural language interface for hardware control
- AI interprets user intent and maps it to actuator actions
- Structured response format:
  json   { "act": "", "inst": "", "mess": "" }   

### 🎤 Voice Control
- Audio input via browser
- Speech-to-text processing
- Direct execution of spoken commands

### 🔁 Resilient Communication
- Automatic SSE reconnection
- Fault-tolerant event handling
- Connection status monitoring

### 🧾 Activity Logging
- Real-time system logs
- Categorized events:
  - info
  - warnings
  - errors
  - AI actions

---

## 🧱 Architecture

### Frontend
- Next.js (React)
- Component-based UI:
  - MetricCard
  - SparklineChart
  - ActuatorPanel
  - AssistantPanel

### Backend
- Next.js API Routes
- Endpoints:
  - /api/sensor
  - /api/actuator
  - /api/assistant

### Communication Layer
- SSE (Server-Sent Events) for telemetry
- HTTP (REST) for actuator control

### Hardware Layer
- ESP32 microcontroller
- Sensors (configurable via JSON)
- Actuators (servo-based)

---

## 🔧 Configuration

All sensors and actuators are defined in:

/app/config.json

Example:

json {   "actuators": {     "servo": {       "label": "Servo",       "min": 0,       "max": 180,       "unit": "°"     }   },   "sensors": {     "temp": {       "label": "Temperature",       "unit": "°C"     }   } } 

This allows the dashboard to dynamically adapt without hardcoding UI elements.

---

## 🛠 Installation

bash git clone https://github.com/yourusername/khymera-dashboard cd khymera-dashboard pnpm install pnpm dev 

---

## 🔐 Environment Variables

env OPENAI_API_KEY=your_api_key MCU_URL=http://your-esp32-ip 

---

## 🎮 Usage

1. Start the development server  
2. Power and connect the ESP32 device  
3. Open the dashboard in your browser  
4. Monitor live sensor data  
5. Control actuators manually or via AI  
6. Use voice commands for hands-free interaction  

Example command:
Move the servo to 90 degrees

---

## 🔄 Design Philosophy

Khymera is built on a different assumption than most robotic systems:

> Instead of replicating human anatomy, prioritize mechanical efficiency, modularity, and accessibility.

This philosophy extends to the dashboard:

- Minimal latency over visual complexity  
- Functional UI over decorative design  
- Direct control over abstraction  

---

## 🧪 Development Approach

The system follows an iterative engineering model:

- Rapid prototyping  
- Real-world testing  
- Continuous refinement  

The dashboard evolved alongside the hardware, ensuring tight integration between control logic and physical behavior.

---

## 🧬 Project Vision

Khymera explores the intersection of:

- Embedded systems  
- Robotics  
- Human-machine interfaces  
- Accessible engineering  

The long-term goal is to develop modular, low-cost robotic systems that can evolve into functional prosthetic solutions and advanced physical interfaces.

---

## 📄 License

MIT License