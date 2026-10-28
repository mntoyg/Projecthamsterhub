# KMITL Smart Grid & AI Energy Guardian

Single-page control-room dashboard: simulated IoT sensors (current, voltage, occupancy) -> decision engine -> live red/green alerts.

## Run
    npm install
    npm run dev      # local mode, no backend
    npm test         # decision-engine unit tests

## Decision engine (`src/engine/energy.ts`)
- Rule: no occupancy AND current >= 7 A => Energy Waste
- Statistical: z-score of the reading vs. the room's recent history (needs >= 5 samples)
- Savings: P = V x I; kWh/month, baht and kg CO2 use documented assumptions (tariff 4.2 THB/kWh, 0.5 kgCO2/kWh, 14 idle h x 22 days)

## Limitations
Sensors are simulated; assumptions above are approximations, not measured campus data.
