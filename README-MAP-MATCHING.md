# VRUGUARD Map Matching Module

This document explains the lightweight map matching algorithm implemented in VRUGUARD for improving the precision of GPS trajectories in urban environments, heavily inspired by "A Hybrid Map-Matching Approach for GPS-Based Analysis of Cyclist Behaviour and Infrastructure Use in Urban Environments".

## Concept

Unlike complex HMM (Hidden Markov Model) approaches which are computationally expensive for real-time mobile tracking, VRUGUARD uses a lightweight, multi-criteria deterministic approach designed specifically for micro-mobility (cyclists and scooters). It leverages context-oriented infrastructure data from OpenStreetMap.

### The Algorithm

For every GPS point received `p(n)`, the algorithm queries surrounding OSM infrastructure geometry.

1. **Candidates Selection**: All segments within a `searchRadius` (default 15 meters) are selected as potential candidates.
2. **Bikeability Scoring (Beta/K)**: Segments receive a bikeability index between 0 and 5 based on their OSM tags, favoring cycleways, cycle tracks, and safe shared paths (larger is better).
3. **Heading (Angle) Scoring (Gamma)**: Checks if the VRU's trajectory (derived from `p(n-1)` to `p(n)`, or device compass) aligns with the network segment path.
4. **Distance Scoring (Lambda)**: Distance projection from `p(n)` to the segment.
5. **Global Scoring (Zeta)**: `Zeta = a*Gamma + b*Lambda + c*Beta`, balancing geometry and context (default weights: a=3, b=1, c=1). 
6. **Snap**: Point `p(n)` is projected perpendicularly on the maximum scoring segment.
7. **Consistency Fallback**: Real-time topological checks maintain temporal stability to avoid erratic jumping (e.g., penalties if consecutive snaps belong to disconnected ways or score variance is high).

## Fallback Mechanism
If the maximum confidence (`Zeta / (a+b+c)`) scores below `0.6`, map matching is aborted for the tick, gracefully falling back to the raw `gpsPosition` obtained from quantum/classical sensor fusion. This ensures that when the user leaves a mapped road or when GPS noise vastly out-scales search bounds, risk routing continues effectively using raw metrics.

## Configuration & UI
Map matching can be enabled/disabled on the fly inside the **Dashboard > Tracking & Logic** panel. 
A **Debug mode** can also be toggled, which persists the raw GPS points (grey nodes) alongside the snapped map-matched points (blue) inside `MapVisualization.tsx`, making evaluation transparent.
